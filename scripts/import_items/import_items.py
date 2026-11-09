#!/usr/bin/env python3
"""
Bulk-import clothing photos into a Zeeba closet.

For every photo in a folder:
  1. cut the garment out of the background (rembg, isnet-general-use) -> transparent PNG
  2. run automated quality checks on the cutout (background residue, specks,
     clipped edges, aspect ratio, nothing/everything detected)
  3. ask Claude for a draft name / description / category / brand
  4. show you the draft (and the cutout) for approval or edits, one item at a time
  5. insert the clothing_items row + upload the PNG + insert the primary photo row

Progress is recorded in <out>/manifest.json, so you can quit at any time and
rerun the same command to pick up where you left off.

See README.md next to this file for setup.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
import sys
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Literal, Optional

import numpy as np
from PIL import Image, ImageOps

# --- constants mirrored from the app -------------------------------------------------------
# clothing_items.item_type check constraint (supabase/migrations/20261012000000_*.sql) and
# CLOTHING_ITEM_TYPES in src/services/dataService.types.ts. Keep in sync.
ITEM_TYPES = (
    "shirt", "sweater", "cardigan", "pants", "dress_romper",
    "shoes", "jacket", "purse", "jewelry", "accessory",
)
ITEM_TYPE_HELP = {
    "shirt": "tops: tees, blouses, button-downs, bodysuits, tanks, crop tops",
    "sweater": "pullover knitwear (no front opening), incl. turtlenecks and knit tops",
    "cardigan": "knitwear that opens at the front",
    "pants": "all bottoms: trousers, jeans, leggings, shorts, skirts",
    "dress_romper": "dresses, rompers, jumpsuits, sweater dresses",
    "shoes": "all footwear",
    "jacket": "outerwear: jackets, coats, blazers, vests",
    "purse": "bags of any kind",
    "jewelry": "necklaces, earrings, rings, bracelets, watches",
    "accessory": "hats, scarves, belts, sunglasses, hair accessories, anything else",
}
NAME_MAX, BRAND_MAX, DESCRIPTION_MAX = 100, 100, 1000  # clothing_items_*_length constraints
PHOTO_BUCKET = "clothing_item_photos"  # src/services/supabasePhotoStorage.ts
MAX_LONG_SIDE = 1600  # output PNG; the app downsizes its own uploads similarly
PAD_FRACTION = 0.03  # transparent margin around the garment

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"}

CLAUDE_MODEL = "claude-opus-5-5"


# --- small helpers ---------------------------------------------------------------------------
def log(msg: str = "") -> None:
    print(msg, flush=True)


def load_dotenv_if_present() -> None:
    env_path = Path(__file__).with_name(".env")
    if env_path.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_path)
        except ImportError:
            log("python-dotenv not installed; relying on exported environment variables")


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"Missing {name}. Copy .env.example to .env in scripts/import_items and fill it in.")
    return value


def open_photo(path: Path) -> Image.Image:
    """Opens a photo, honours EXIF rotation, returns RGB."""
    if path.suffix.lower() in {".heic", ".heif"}:
        try:
            from pillow_heif import register_heif_opener
            register_heif_opener()
        except ImportError:
            sys.exit(f"{path.name} is HEIC; run: pip install pillow-heif")
    image = Image.open(path)
    image = ImageOps.exif_transpose(image)
    return image.convert("RGB")


# --- manifest (resume support) ---------------------------------------------------------------
@dataclass
class Entry:
    source: str
    status: str = "pending"  # pending | cut | failed_qc | duplicate | skipped | uploaded
    cutout: Optional[str] = None
    qc: dict = field(default_factory=dict)
    draft: Optional[dict] = None
    item_id: Optional[str] = None
    error: Optional[str] = None
    digest: Optional[str] = None  # sha256 of the source file (exact duplicates)
    phash: Optional[str] = None   # perceptual hash of the cutout (near duplicates)


class Manifest:
    def __init__(self, path: Path):
        self.path = path
        self.entries: dict[str, Entry] = {}
        if path.exists():
            raw = json.loads(path.read_text())
            self.entries = {k: Entry(**v) for k, v in raw.items()}

    def get(self, source: Path) -> Entry:
        key = source.name
        if key not in self.entries:
            self.entries[key] = Entry(source=str(source))
        return self.entries[key]

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps({k: asdict(v) for k, v in self.entries.items()}, indent=2))


# --- step 1: background removal ---------------------------------------------------------------
BG_COLOR_TOLERANCE = 40      # RGB distance within which a pixel "is" the background colour
SEPARABLE_DISTANCE = 70      # garment vs background colour distance needed to trust colour cues


def colour_distance(rgb: np.ndarray, colour: np.ndarray) -> np.ndarray:
    return np.sqrt(((rgb.astype(int) - colour) ** 2).sum(axis=-1))


def estimate_colours(photo_rgb: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """(background colour just outside the garment, garment colour well inside it)."""
    from scipy import ndimage

    band = max(6, int(np.sqrt(mask.sum()) * 0.04))
    ring = ndimage.binary_dilation(mask, iterations=band * 2) & ~mask
    inner = ndimage.binary_erosion(mask, iterations=band)
    bg = np.median(photo_rgb[ring], axis=0) if ring.sum() > 50 else np.array([0, 0, 0])
    garment = np.median(photo_rgb[inner if inner.sum() > 50 else mask], axis=0)
    return bg, garment


def fill_non_background_holes(photo_rgb: np.ndarray, mask: np.ndarray, bg: np.ndarray) -> tuple[np.ndarray, int]:
    """
    Segmentation models sometimes punch holes through light patches of a dark
    garment (white diamonds on a black sweater). A real gap - a bent sleeve
    forming a loop - shows the sheet through it. So fill every enclosed hole
    whose photo colour is not the background colour. Returns (mask, pixels filled).
    """
    from scipy import ndimage

    filled = ndimage.binary_fill_holes(mask)
    holes = filled & ~mask
    if not holes.any():
        return mask, 0
    labels, count = ndimage.label(holes)
    out = mask.copy()
    filled_px = 0
    for i in range(1, count + 1):
        hole = labels == i
        if np.median(colour_distance(photo_rgb[hole], bg)) > BG_COLOR_TOLERANCE:
            out |= hole
            filled_px += int(hole.sum())
    return out, filled_px


def remove_background_slivers(photo_rgb: np.ndarray, mask: np.ndarray, bg: np.ndarray,
                              garment: np.ndarray) -> tuple[np.ndarray, int]:
    """
    Removes background-coloured regions that the model kept, e.g. a strip of
    sheet between a sleeve and the body. A blob is removed if it reaches the
    mask edge, or if it is enclosed but substantial (the model bridged over
    both ends of a gap). Small interior patches stay, and nothing is touched
    when the garment colour is close to the background colour, so a beige knit
    on a lilac sheet is left alone. Returns (mask, pixels removed).
    """
    from scipy import ndimage

    if np.sqrt(((garment - bg) ** 2).sum()) < SEPARABLE_DISTANCE:
        return mask, 0
    candidates = mask & (colour_distance(photo_rgb, bg) < BG_COLOR_TOLERANCE)
    labels, count = ndimage.label(candidates)
    if count == 0:
        return mask, 0
    area = mask.sum()
    min_edge_blob = max(50, int(area * 0.001))
    min_enclosed_blob = int(area * 0.005)
    edge = mask & ~ndimage.binary_erosion(mask, iterations=2)
    out = mask.copy()
    removed = 0
    sizes = ndimage.sum(candidates, labels, range(1, count + 1))
    for i, size in enumerate(sizes, 1):
        if size < min_edge_blob:
            continue
        blob = labels == i
        if (blob & edge).any() or size >= min_enclosed_blob:
            out &= ~blob
            removed += int(size)
    # removing a sliver can orphan specks; keep the main piece only
    main = largest_component_mask(out)
    return (main if main is not None else out), removed


def refine_mask(photo: Image.Image, raw: Image.Image) -> tuple[Optional[np.ndarray], dict]:
    """Turns the raw model output into a clean garment mask. Returns (mask, notes)."""
    alpha = np.array(raw)[..., 3]
    main = largest_component_mask(alpha > 128)
    if main is None:
        return None, {}
    photo_rgb = np.array(photo)
    bg, garment = estimate_colours(photo_rgb, main)
    mask, removed = remove_background_slivers(photo_rgb, main, bg, garment)
    mask, filled = fill_non_background_holes(photo_rgb, mask, bg)
    notes = {
        "background_colour": [int(c) for c in bg],
        "garment_colour": [int(c) for c in garment],
        "sliver_px_removed": removed,
        "hole_px_filled": filled,
    }
    return mask, notes


def make_cutout(photo: Image.Image, raw: Image.Image, mask: np.ndarray) -> Image.Image:
    """Applies the refined mask, defringes, trims to the garment, downsizes uniformly."""
    from scipy import ndimage

    # Colour comes from the photo: rembg blacks out the RGB of pixels it made
    # transparent, which would show through any hole we fill back in.
    arr = np.dstack([np.array(photo), np.array(raw)[..., 3]])
    alpha = arr[..., 3]
    # Keep the model's soft edge only where it hugs the refined mask; make
    # filled holes fully opaque; drop everything else.
    near = ndimage.binary_dilation(mask, iterations=3)
    alpha = np.where(near, alpha, 0)
    alpha = np.where(mask, np.maximum(alpha, 255), alpha)
    arr[..., 3] = alpha

    # Defringe: edge pixels are a blend of garment and background colour, which
    # shows as a thin halo in the sheet's colour. Shave one pixel off the alpha,
    # then recolour the outer band from the nearest confidently-interior pixel.
    solid = arr[..., 3] > 128
    shaved = ndimage.binary_erosion(solid, iterations=1)
    arr[..., 3] = np.where(solid & ~shaved, 0, arr[..., 3])
    interior = ndimage.binary_erosion(shaved, iterations=3)
    if interior.any():
        band = (arr[..., 3] > 0) & ~interior
        _, (iy, ix) = ndimage.distance_transform_edt(~interior, return_indices=True)
        arr[..., :3][band] = arr[..., :3][iy[band], ix[band]]
    rgba = Image.fromarray(arr)

    bbox = rgba.getbbox()
    if bbox:
        pad = int(max(bbox[2] - bbox[0], bbox[3] - bbox[1]) * PAD_FRACTION)
        bbox = (
            max(0, bbox[0] - pad), max(0, bbox[1] - pad),
            min(rgba.width, bbox[2] + pad), min(rgba.height, bbox[3] + pad),
        )
        rgba = rgba.crop(bbox)
    # Uniform downscale only (same factor both axes), so the garment is never distorted.
    long_side = max(rgba.size)
    if long_side > MAX_LONG_SIDE:
        scale = MAX_LONG_SIDE / long_side
        rgba = rgba.resize((round(rgba.width * scale), round(rgba.height * scale)), Image.LANCZOS)
    return rgba


def largest_component_mask(binary: np.ndarray):
    from scipy import ndimage

    labels, count = ndimage.label(binary)
    if count == 0:
        return None
    sizes = ndimage.sum(binary, labels, range(1, count + 1))
    return labels == (int(np.argmax(sizes)) + 1)


# --- step 2: quality checks -----------------------------------------------------------------
def background_residue_score(photo: Image.Image, main_mask: np.ndarray) -> tuple[float, float]:
    """
    How much of the garment's *edge* looks like the background right next to it.

    Background colour is sampled from a ring just outside the mask in the original
    photo. Pixels inside the mask that match it are counted separately for an
    inner edge band and for the interior. Leftover background shows up only in the
    edge band; a garment that genuinely is background-coloured matches everywhere,
    so the interior rate is subtracted. Returns (edge_match_pct, interior_match_pct).
    """
    from scipy import ndimage

    arr = np.array(photo).astype(int)
    band = max(6, int(np.sqrt(main_mask.sum()) * 0.04))  # scale with garment size
    outside_ring = ndimage.binary_dilation(main_mask, iterations=band * 2) & ~main_mask
    if outside_ring.sum() < 50:
        return 0.0, 0.0
    bg = np.median(arr[outside_ring], axis=0)
    dist = np.sqrt(((arr - bg) ** 2).sum(axis=-1))
    matches = dist < 35

    inner_edge = main_mask & ~ndimage.binary_erosion(main_mask, iterations=band)
    interior = main_mask & ~inner_edge
    edge_pct = matches[inner_edge].mean() * 100 if inner_edge.any() else 0.0
    interior_pct = matches[interior].mean() * 100 if interior.any() else 0.0
    return float(edge_pct), float(interior_pct)


def quality_check(photo: Image.Image, cutout: Image.Image, raw_mask: np.ndarray,
                  main_mask: Optional[np.ndarray]) -> dict:
    """Returns {"verdict": PASS|WARN|FAIL, "issues": [...], "metrics": {...}}."""
    issues: list[str] = []
    alpha = np.array(cutout)[..., 3]
    metrics: dict = {"size": list(cutout.size)}

    coverage_of_photo = raw_mask.mean()
    metrics["coverage_of_photo_pct"] = round(coverage_of_photo * 100, 1)
    if coverage_of_photo < 0.02 or main_mask is None:
        issues.append("FAIL: almost nothing detected as foreground")
        return {"verdict": "FAIL", "issues": issues, "metrics": metrics}
    if coverage_of_photo > 0.85:
        issues.append("FAIL: nearly the whole photo kept - background not removed")

    # Residual background along the garment edge.
    edge_pct, interior_pct = background_residue_score(photo, main_mask)
    residue = max(0.0, edge_pct - interior_pct)
    metrics["edge_background_match_pct"] = round(edge_pct, 1)
    metrics["interior_background_match_pct"] = round(interior_pct, 1)
    # Calibrated on a lilac-sheet test batch: a cutout that kept a chunk of sheet
    # scored 17%; clean light-coloured knits (edge in shadow) scored 5-7%.
    if residue > 15:
        issues.append(f"FAIL: {residue:.0f}% of the garment edge looks like leftover background")
    elif residue > 9:
        issues.append(f"WARN: {residue:.0f}% of the garment edge looks like leftover background - check")

    # Soft / uncertain edges -> fuzzy halo
    soft = ((alpha > 30) & (alpha < 225)).sum() / max((alpha > 30).sum(), 1) * 100
    metrics["soft_edge_pct"] = round(soft, 1)
    if soft > 15:
        issues.append(f"WARN: {soft:.0f}% semi-transparent pixels - fuzzy edges")

    # Mask touching the photo frame along a real stretch -> the photo itself clipped the garment.
    h, w = main_mask.shape
    touch = max(main_mask[0].sum(), main_mask[-1].sum(), main_mask[:, 0].sum(), main_mask[:, -1].sum())
    metrics["edge_contact_px"] = int(touch)
    if touch >= 10:
        issues.append("WARN: garment touches the photo edge - part of it may be cut off in the photo")

    verdict = "PASS"
    if any(i.startswith("FAIL") for i in issues):
        verdict = "FAIL"
    elif issues:
        verdict = "WARN"
    return {"verdict": verdict, "issues": issues, "metrics": metrics}


def cut_and_check(source: Path, out_dir: Path, session) -> tuple[Path, dict]:
    photo = open_photo(source)
    from rembg import remove

    raw = remove(photo, session=session, post_process_mask=True)
    raw_mask = np.array(raw)[..., 3] > 128
    mask, notes = refine_mask(photo, raw)

    if mask is None:
        cutout = raw
    else:
        cutout = make_cutout(photo, raw, mask)
    qc = quality_check(photo, cutout, raw_mask, mask)
    qc["metrics"].update(notes)
    if notes.get("sliver_px_removed"):
        qc["issues"].append(f"INFO: removed a background sliver ({notes['sliver_px_removed']} px) the model had kept")
    if notes.get("hole_px_filled"):
        qc["issues"].append(f"INFO: filled holes the model punched in the garment ({notes['hole_px_filled']} px)")

    out_path = out_dir / f"{source.stem}.png"
    cutout.save(out_path, "PNG", optimize=True)
    qc["phash"] = perceptual_hash(cutout)
    return out_path, qc


# --- step 2b: duplicate detection ---------------------------------------------------------------
def file_digest(path: Path) -> str:
    import hashlib

    return hashlib.sha256(path.read_bytes()).hexdigest()


def perceptual_hash(cutout: Image.Image) -> str:
    """
    64-bit difference hash of the cutout flattened on white. Two photos of the
    same garment laid out the same way land within a few bits of each other even
    when the camera moved or the lighting changed; different garments do not.
    """
    flat = Image.new("RGB", cutout.size, (255, 255, 255))
    flat.paste(cutout, mask=cutout.split()[3])
    small = np.asarray(flat.convert("L").resize((9, 8), Image.LANCZOS), dtype=int)
    bits = (small[:, 1:] > small[:, :-1]).flatten()
    return "".join("1" if b else "0" for b in bits)


def hamming(a: str, b: str) -> int:
    return sum(x != y for x, y in zip(a, b))


NEAR_DUPLICATE_BITS = 6  # out of 64; calibrated so same-shape-different-colour knits stay apart


def flag_duplicates(manifest: "Manifest", sources: list[Path]) -> None:
    """Exact duplicates are skipped automatically; near duplicates get a QC warning."""
    seen: list[tuple[Path, Entry]] = []
    for source in sources:
        entry = manifest.get(source)
        if entry.status != "cut":
            continue
        for earlier_source, earlier in seen:
            if entry.digest and entry.digest == earlier.digest:
                entry.status = "duplicate"
                entry.error = f"identical file to {earlier_source.name}"
                log(f"  {source.name}: identical to {earlier_source.name} - skipped")
                break
            if entry.phash and earlier.phash and hamming(entry.phash, earlier.phash) <= NEAR_DUPLICATE_BITS:
                note = f"WARN: looks like a duplicate of {earlier_source.name} - skip if it is the same garment"
                if note not in entry.qc.setdefault("issues", []):
                    entry.qc["issues"].append(note)
                    if entry.qc.get("verdict") == "PASS":
                        entry.qc["verdict"] = "WARN"
                log(f"  {source.name}: possible duplicate of {earlier_source.name}")
                break
        if entry.status == "cut":
            seen.append((source, entry))
    manifest.save()


# --- step 3: describe with Claude --------------------------------------------------------------
def describe_with_claude(cutout_path: Path, client) -> dict:
    from pydantic import BaseModel, Field

    class ItemDraft(BaseModel):
        name: str = Field(description=f"Short display name, max {NAME_MAX} chars, e.g. 'Red Ruched Mini Dress'")
        description: str = Field(description=f"1-3 sentences on cut, fabric, colour, details. Max {DESCRIPTION_MAX} chars.")
        item_type: Literal[ITEM_TYPES]  # type: ignore[valid-type]
        brand: Optional[str] = Field(description="Brand only if a label or logo is clearly readable, else null")

    image = Image.open(cutout_path)
    image.thumbnail((1024, 1024))
    # Flatten onto white so the model is not confused by a transparent background.
    flat = Image.new("RGB", image.size, (255, 255, 255))
    flat.paste(image, mask=image.split()[3])
    buf = io.BytesIO()
    flat.save(buf, "JPEG", quality=85)
    data = base64.b64encode(buf.getvalue()).decode()

    categories = "\n".join(f"- {k}: {v}" for k, v in ITEM_TYPE_HELP.items())
    system = (
        "You catalogue clothing for a personal wardrobe app. You will see one garment photographed "
        "flat with the background removed. Describe only what is visible; do not invent brands, "
        "sizes or materials you cannot see. Use plain, concrete wording a person would use to find "
        "the item again. Names are Title Case without a trailing period.\n\n"
        f"Allowed item_type values and what they mean:\n{categories}"
    )
    response = client.messages.parse(
        model=CLAUDE_MODEL,
        max_tokens=2000,
        system=system,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}},
                {"type": "text", "text": "Catalogue this garment."},
            ],
        }],
        output_format=ItemDraft,
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("Claude declined to describe this image; enter the details manually.")
    draft = response.parsed_output
    return {
        "name": draft.name.strip()[:NAME_MAX],
        "description": draft.description.strip()[:DESCRIPTION_MAX],
        "item_type": draft.item_type,
        "brand": (draft.brand or "").strip()[:BRAND_MAX] or None,
    }


# --- step 4: interactive review ---------------------------------------------------------------
def prompt(text: str) -> str:
    try:
        return input(text)
    except EOFError:
        return "q"


def show_draft(index: int, total: int, source: Path, draft: dict, qc: dict) -> None:
    log()
    log(f"[{index}/{total}] {source.name}   QC: {qc['verdict']}")
    for issue in qc.get("issues", []):
        log(f"    ! {issue}")
    log(f"  name:        {draft['name']}")
    log(f"  type:        {draft['item_type']}")
    log(f"  brand:       {draft['brand'] or '-'}")
    log(f"  description: {draft['description']}")


def edit_text(label: str, current: str, limit: int, allow_empty: bool) -> Optional[str]:
    while True:
        value = prompt(f"  new {label} (enter to keep): ").strip()
        if not value:
            return current
        if value == "-" and allow_empty:
            return None
        if len(value) > limit:
            log(f"  too long ({len(value)} > {limit})")
            continue
        return value


def choose_type(current: str) -> str:
    for i, t in enumerate(ITEM_TYPES, 1):
        log(f"   {i:2}. {t:13} {ITEM_TYPE_HELP[t]}")
    while True:
        value = prompt(f"  type number (enter to keep {current}): ").strip()
        if not value:
            return current
        if value.isdigit() and 1 <= int(value) <= len(ITEM_TYPES):
            return ITEM_TYPES[int(value) - 1]
        if value in ITEM_TYPES:
            return value
        log("  not a valid type")


def review(index: int, total: int, source: Path, cutout: Path, draft: dict, qc: dict,
           preview: bool, describe) -> tuple[str, dict]:
    """Returns (action, draft) where action is accept | skip | quit."""
    if preview:
        try:
            Image.open(cutout).show()
        except Exception as err:  # viewer not available (ssh etc.)
            log(f"  (could not open preview: {err})")
    while True:
        show_draft(index, total, source, draft, qc)
        choice = prompt("  [a]ccept  [n]ame  [d]escription  [t]ype  [b]rand  [r]egenerate  [s]kip  [q]uit > ").strip().lower()
        if choice == "a":
            if qc["verdict"] == "FAIL":
                confirm = prompt("  QC failed for this cutout. Upload anyway? [y/N] ").strip().lower()
                if confirm != "y":
                    continue
            return "accept", draft
        if choice == "n":
            draft["name"] = edit_text("name", draft["name"], NAME_MAX, False)
        elif choice == "d":
            draft["description"] = edit_text("description", draft["description"], DESCRIPTION_MAX, False)
        elif choice == "t":
            draft["item_type"] = choose_type(draft["item_type"])
        elif choice == "b":
            draft["brand"] = edit_text("brand ('-' to clear)", draft["brand"] or "", BRAND_MAX, True) or None
        elif choice == "r":
            if describe is None:
                log("  (no Claude client in this mode)")
            else:
                try:
                    draft = describe(cutout)
                except Exception as err:
                    log(f"  regenerate failed: {err}")
        elif choice == "s":
            return "skip", draft
        elif choice == "q":
            return "quit", draft


# --- step 5: upload --------------------------------------------------------------------------
class Uploader:
    def __init__(self, url: str, anon_key: str, email: str, password: str):
        from supabase import create_client

        self.client = create_client(url, anon_key)
        auth = self.client.auth.sign_in_with_password({"email": email, "password": password})
        if not auth.user:
            sys.exit("Supabase sign-in failed")
        log(f"Signed in as {auth.user.email}")

    def pick_closet(self, wanted_name: Optional[str]) -> tuple[str, str]:
        rows = self.client.table("closets").select("id, closet_name").order("created_at").execute().data
        if not rows:
            sys.exit("You are not a member of any closet.")
        if wanted_name:
            matches = [r for r in rows if r["closet_name"].lower() == wanted_name.lower()]
            if len(matches) != 1:
                names = ", ".join(repr(r["closet_name"]) for r in rows)
                sys.exit(f"Closet {wanted_name!r} not found. Your closets: {names}")
            return matches[0]["id"], matches[0]["closet_name"]
        if len(rows) == 1:
            return rows[0]["id"], rows[0]["closet_name"]
        for i, r in enumerate(rows, 1):
            log(f"  {i}. {r['closet_name']}")
        while True:
            value = prompt("Which closet? ").strip()
            if value.isdigit() and 1 <= int(value) <= len(rows):
                return rows[int(value) - 1]["id"], rows[int(value) - 1]["closet_name"]

    def upload_item(self, closet_id: str, draft: dict, cutout: Path) -> str:
        inserted = self.client.table("clothing_items").insert({
            "closet_id": closet_id,
            "item_type": draft["item_type"],
            "name": draft["name"],
            "description": draft["description"] or None,
            "brand": draft["brand"],
        }).execute().data
        item_id = inserted[0]["id"]
        # Same path shape as uploadPhotoToBucket in src/services/supabasePhotoStorage.ts
        path = f"{item_id}/{int(time.time() * 1000)}-{uuid.uuid4().hex[:10]}.png"
        try:
            self.client.storage.from_(PHOTO_BUCKET).upload(path, cutout.read_bytes(), {"content-type": "image/png"})
            public_url = self.client.storage.from_(PHOTO_BUCKET).get_public_url(path)
            self.client.table("clothing_item_photos").insert({
                "clothing_item_id": item_id,
                "image_url": public_url,
                "is_primary": True,
            }).execute()
        except Exception:
            # Roll back so there is never an item without its photo.
            try:
                self.client.storage.from_(PHOTO_BUCKET).remove([path])
            except Exception:
                pass
            self.client.table("clothing_items").delete().eq("id", item_id).execute()
            raise
        return item_id


# --- main --------------------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("photos", type=Path, help="folder of garment photos (one garment per photo)")
    parser.add_argument("--out", type=Path, default=None, help="output folder (default: <photos>/cutouts)")
    parser.add_argument("--closet", help="closet name to import into (prompted if you have several)")
    parser.add_argument("--model", default="isnet-general-use",
                        help="rembg model (default isnet-general-use; u2net is faster but clips sleeves)")
    parser.add_argument("--cutout-only", action="store_true", help="only cut + QC; no Claude, no review, no upload")
    parser.add_argument("--no-upload", action="store_true", help="review but do not write to Supabase")
    parser.add_argument("--no-describe", action="store_true", help="skip Claude; start every draft blank")
    parser.add_argument("--no-preview", action="store_true", help="don't open cutouts in the image viewer")
    parser.add_argument("--redo", action="store_true", help="re-cut photos even if already processed")
    args = parser.parse_args()

    load_dotenv_if_present()
    photos_dir: Path = args.photos
    if not photos_dir.is_dir():
        sys.exit(f"{photos_dir} is not a folder")
    out_dir: Path = args.out or (photos_dir / "cutouts")
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = Manifest(out_dir / "manifest.json")

    sources = sorted(p for p in photos_dir.iterdir() if p.suffix.lower() in IMAGE_EXTS and p.is_file())
    if not sources:
        sys.exit(f"No photos found in {photos_dir}")

    # ---- cut + QC everything first (fast, offline), so the review is uninterrupted
    from rembg import new_session
    log(f"Loading background-removal model {args.model} ...")
    session = new_session(args.model)
    for i, source in enumerate(sources, 1):
        entry = manifest.get(source)
        if entry.status in {"uploaded", "skipped", "duplicate"} and not args.redo:
            continue
        if entry.status == "cut" and entry.cutout and Path(entry.cutout).exists() and not args.redo:
            continue
        started = time.time()
        try:
            cutout_path, qc = cut_and_check(source, out_dir, session)
        except Exception as err:
            entry.status, entry.error = "failed_qc", f"cutout error: {err}"
            manifest.save()
            log(f"[{i}/{len(sources)}] {source.name}: ERROR {err}")
            continue
        entry.cutout, entry.qc = str(cutout_path), qc
        entry.phash = qc.pop("phash", None)
        entry.digest = file_digest(source)
        entry.status = "cut"
        entry.error = None
        manifest.save()
        flag = f"  <- {qc['verdict']}: " + "; ".join(qc["issues"]) if qc["issues"] else ""
        log(f"[{i}/{len(sources)}] {source.name}: cut in {time.time() - started:.1f}s{flag}")

    log("\nChecking for duplicates ...")
    flag_duplicates(manifest, sources)

    summary = {"PASS": 0, "WARN": 0, "FAIL": 0}
    duplicates = 0
    for entry in manifest.entries.values():
        if entry.status == "duplicate":
            duplicates += 1
        elif entry.qc:
            summary[entry.qc["verdict"]] = summary.get(entry.qc["verdict"], 0) + 1
    log(f"\nCutouts: {summary['PASS']} pass, {summary['WARN']} warn, {summary['FAIL']} fail, "
        f"{duplicates} exact duplicate(s) skipped -> {out_dir}")
    if args.cutout_only:
        return

    # ---- describe + review + upload
    describe = None
    if not args.no_describe:
        import anthropic
        client = anthropic.Anthropic(api_key=require_env("ANTHROPIC_API_KEY"))
        describe = lambda path: describe_with_claude(path, client)  # noqa: E731

    uploader = None
    closet_id = closet_name = None
    if not args.no_upload:
        uploader = Uploader(require_env("SUPABASE_URL"), require_env("SUPABASE_ANON_KEY"),
                            require_env("ZEEBA_EMAIL"), require_env("ZEEBA_PASSWORD"))
        closet_id, closet_name = uploader.pick_closet(args.closet)
        log(f"Importing into closet: {closet_name}")

    pending = [s for s in sources if manifest.get(s).status == "cut"]
    for i, source in enumerate(pending, 1):
        entry = manifest.get(source)
        cutout = Path(entry.cutout)
        draft = entry.draft
        if draft is None:
            if describe is not None:
                try:
                    log(f"\nAsking Claude about {source.name} ...")
                    draft = describe(cutout)
                except Exception as err:
                    log(f"  Claude failed ({err}); starting blank")
            draft = draft or {"name": source.stem, "description": "", "item_type": "shirt", "brand": None}
            entry.draft = draft
            manifest.save()

        action, draft = review(i, len(pending), source, cutout, draft, entry.qc, not args.no_preview, describe)
        entry.draft = draft
        if action == "quit":
            manifest.save()
            log("Stopped. Rerun the same command to continue.")
            return
        if action == "skip":
            entry.status = "skipped"
            manifest.save()
            log("  skipped")
            continue
        if uploader is None:
            log("  (dry run) would upload")
            manifest.save()
            continue
        try:
            entry.item_id = uploader.upload_item(closet_id, draft, cutout)
            entry.status = "uploaded"
            log(f"  uploaded as {entry.item_id}")
        except Exception as err:
            entry.error = f"upload error: {err}"
            log(f"  UPLOAD FAILED: {err} (item left as pending; rerun to retry)")
        manifest.save()

    done = sum(1 for e in manifest.entries.values() if e.status == "uploaded")
    log(f"\nDone. {done} item(s) uploaded in total. Manifest: {manifest.path}")


if __name__ == "__main__":
    main()
