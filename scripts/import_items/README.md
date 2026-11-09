# Bulk import clothing photos

Takes a folder of garment photos (one garment per photo, laid flat), removes the
background, drafts a name / description / category with Claude, lets you approve
or edit each one, and uploads them to your Zeeba closet.

## Setup (once)

```bash
cd scripts/import_items
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill it in
```

The first run downloads the background-removal model (~180 MB) to `~/.u2net/`.

## Run

```bash
source .venv/bin/activate
python import_items.py ~/Pictures/closet-batch-1 --closet "My Closet"
```

What happens:

1. Every photo is cut out to a transparent PNG in `<photos>/cutouts/`. The
   model's mask is then repaired automatically where it typically goes wrong:
   holes it punches through light patches of a dark garment are filled (only
   when the photo shows garment there, not sheet), strips of background it
   kept between a sleeve and the body are removed, stray specks are dropped and
   the 1-px colour fringe along the edge is cleaned up. Each repair is noted as
   `INFO` so you can glance at it during review.
   Each cutout is then quality-checked and reported as `PASS`, `WARN` or `FAIL`:
   - `FAIL`: nothing detected, or the background was kept, or a large part of
     the garment edge matches the background colour. You'll be asked to confirm
     before uploading one of these - usually re-shoot the item instead.
   - `WARN`: the garment touches the photo edge (so the photo itself clipped
     it), fuzzy edges, some background-coloured pixels along the edge (common
     and harmless for beige/grey knits on a lilac sheet), or a possible
     duplicate of an earlier photo.
   Byte-identical photos are skipped outright; near-identical cutouts
   (same garment photographed twice) get a duplicate warning so you can skip
   them in review. Duplicates of items *already in your closet* are not
   detected - check the app first if you are unsure.
2. Claude drafts a name, description, category and (if a label is readable) brand.
3. For each item you get the cutout in your image viewer and this prompt:

   ```
   [3/16] IMG_4021.jpg   QC: PASS
     name:        Red Ruched Mini Dress
     type:        dress_romper
     brand:       -
     description: Fitted red mini dress with long sleeves, V-neck and ...
     [a]ccept  [n]ame  [d]escription  [t]ype  [b]rand  [r]egenerate  [s]kip  [q]uit >
   ```

4. Accepted items are inserted into `clothing_items`, the PNG is uploaded to
   the `clothing_item_photos` bucket, and the primary photo row is written. If
   the photo step fails the item row is removed again.

Progress is saved in `<photos>/cutouts/manifest.json`. Press `q` any time and
rerun the same command to resume; already-uploaded and skipped photos are not
touched again.

## Useful flags

| Flag | Effect |
|---|---|
| `--cutout-only` | Just cut + QC, so you can eyeball the PNGs before spending anything |
| `--no-upload` | Full review flow but nothing is written to Supabase |
| `--no-describe` | Skip Claude; you type every name yourself |
| `--no-preview` | Don't pop cutouts open in the image viewer (e.g. over ssh) |
| `--redo` | Re-cut photos that were already processed |
| `--model u2net` | Faster model; in testing it clipped sleeves on dark items, so the default is `isnet-general-use` |

## Tips for photos

- Lay the garment flat on a plain, evenly lit surface with contrast to the item
  (dark garment on a light sheet, light garment on a dark one).
- Keep the whole garment inside the frame with some margin - the QC flags
  items that touch the edge.
- Shoot straight down; the cutout is never stretched, so a slanted photo stays slanted.

## Keeping in sync with the app

`ITEM_TYPES` in `import_items.py` must match the `clothing_items.item_type`
check constraint (`supabase/migrations/20261012000000_add_sweater_cardigan_item_types.sql`)
and `CLOTHING_ITEM_TYPES` in `src/services/dataService.types.ts`.
