import type { ClothingCategory } from '@/constants/closetData';

/**
 * clothing_items.item_type is a checked text column in Postgres (see
 * supabase/schema.sql), not a real enum, so supabase-gen types it as plain
 * `string`. This union mirrors that check constraint so the app gets a
 * literal type instead of losing type-safety to the DB's looser column type.
 */
export type ClothingItemType =
  | 'shirt'
  | 'sweater'
  | 'cardigan'
  | 'pants'
  | 'dress_romper'
  | 'shoes'
  | 'jacket'
  | 'purse'
  | 'jewelry'
  | 'accessory';

/** All values allowed by the item_type check constraint - drives the create-item form's type select. */
export const CLOTHING_ITEM_TYPES: readonly ClothingItemType[] = [
  'shirt',
  'sweater',
  'cardigan',
  'pants',
  'dress_romper',
  'shoes',
  'jacket',
  'purse',
  'jewelry',
  'accessory',
];

/** Display label for each item type in the create-item form's type select. */
export const CLOTHING_ITEM_TYPE_LABELS: Record<ClothingItemType, string> = {
  shirt: 'Top (tank, tee, blouse, etc)',
  sweater: 'Sweater',
  cardigan: 'Cardigan',
  pants: 'Bottoms (pants, shorts, or skirt)',
  dress_romper: 'Dress/Romper',
  shoes: 'Shoes',
  jacket: 'Jacket',
  purse: 'Purse',
  jewelry: 'Jewelry',
  accessory: 'Accessory',
};

/** Narrows a raw db string into `ClothingItemType`, throwing on drift from the check constraint. */
export function toClothingItemType(value: string): ClothingItemType {
  if ((CLOTHING_ITEM_TYPES as readonly string[]).includes(value)) {
    return value as ClothingItemType;
  }
  throw new Error(`Unknown clothing_items.item_type from database: "${value}"`);
}

/** clothing_items.item_type (db) -> ClothingCategory (app/UI grouping, e.g. OutfitFlatLay columns). */
const ITEM_TYPE_TO_CATEGORY: Record<ClothingItemType, ClothingCategory> = {
  shirt: 'top',
  sweater: 'sweater',
  cardigan: 'cardigan',
  pants: 'bottom',
  dress_romper: 'dress',
  shoes: 'shoes',
  jacket: 'jacket',
  purse: 'bag',
  jewelry: 'accessory',
  accessory: 'accessory',
};

export function mapItemTypeToCategory(itemType: ClothingItemType): ClothingCategory {
  return ITEM_TYPE_TO_CATEGORY[itemType];
}

/**
 * ClothingCategory (app/UI grouping) -> a representative item_type. Lossy
 * (e.g. 'accessory' could be db 'jewelry' or 'accessory') - only used by
 * previewService, whose dummy data predates item_type and only has category.
 */
const CATEGORY_TO_DEFAULT_ITEM_TYPE: Record<ClothingCategory, ClothingItemType> = {
  top: 'shirt',
  sweater: 'sweater',
  cardigan: 'cardigan',
  bottom: 'pants',
  dress: 'dress_romper',
  shoes: 'shoes',
  jacket: 'jacket',
  bag: 'purse',
  accessory: 'accessory',
};

export function mapCategoryToDefaultItemType(category: ClothingCategory): ClothingItemType {
  return CATEGORY_TO_DEFAULT_ITEM_TYPE[category];
}

/** A require()'d local asset (number) in preview mode, or a remote URL (string) once live. */
export type ImageSource = string | number;

/**
 * react-native's own <Image> (unlike expo-image) won't take a bare string as
 * `source` - it needs `{ uri }` for remote URLs. require()'d numbers pass
 * through as-is.
 */
export function toRNImageSource(source: ImageSource): { uri: string } | number {
  return typeof source === 'number' ? source : { uri: source };
}

/**
 * App-facing shape for a garment. Sourced from clothing_items (+ its primary
 * clothing_item_photos row) in live mode, or Closet_Data in preview mode.
 */
export interface ClosetItem {
  item_id: string;
  closet_id: string;
  item_type: ClothingItemType;
  category: ClothingCategory;
  name: string;
  description: string | null;
  brand: string | null;
  fit_notes: string | null;
  care_instructions: string | null;
  purchase_url: string | null;
  img: ImageSource;
  /** Non-primary photos for this item (e.g. different lighting, fabric close-ups). May be empty. */
  secondary_photos: ClosetItemPhoto[];
  created_at: string;
  /** Bumped by a DB trigger on every update - used as the optimistic-concurrency token for edits/deletes. */
  updated_at: string;
}

/** A non-primary photo attached to a closet item, sourced from clothing_item_photos. */
export interface ClosetItemPhoto {
  id: string;
  image_url: ImageSource;
  created_at: string;
}

/** A "worn in the wild" photo attached to an outfit, sourced from outfit_photos. */
export interface OutfitPhoto {
  id: string;
  image_url: ImageSource;
  created_at: string;
}

/** Voice notes must be at least this long; shorter recordings are refused (the DB check constraint enforces it too). */
export const MIN_VOICE_NOTE_SECONDS = 3;

/** Voice notes cap out here; the recorder auto-stops and the DB check constraint rejects anything longer. */
export const MAX_VOICE_NOTE_SECONDS = 30;

/** What a voice note is attached to - exactly one of an outfit or a clothing item. */
export type VoiceNoteTarget = { outfitId: string } | { clothingItemId: string };

/** A short spoken note attached to an outfit or clothing item, sourced from voice_notes. */
export interface VoiceNote {
  id: string;
  closet_id: string;
  created_by_user_id: string;
  /** Display name of whoever recorded it (their username, else email). */
  recorded_by: string;
  audio_url: string;
  duration_seconds: number;
  created_at: string;
}

/** A finished local recording that hasn't been uploaded yet (create forms hold one of these until Save). */
export interface PendingVoiceNote {
  uri: string;
  durationSeconds: number;
}

/** How many times an outfit has been logged as worn, and whether the current user already logged it today. */
export interface OutfitWearStatus {
  wearCount: number;
  /** id of today's wear_logs row logged by the current user, or null if they haven't logged it today. */
  todayWearLogId: string | null;
}

/**
 * Today's date as wear_logs.worn_on_date expects it (a plain date, no time
 * component), in the user's local calendar day. toISOString() would give the
 * UTC day, which flips mid-evening in the Americas - resetting the
 * "Worn Today" toggle at 5pm PST and stamping late logs with tomorrow's date.
 */
export function todayDateString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * App-facing shape for an outfit. Sourced from outfits + outfit_items (join
 * table -> item_ids) + outfit_photos (-> preview image + full photo list) in
 * live mode, or MyOutfits_Data in preview mode.
 */
export interface Outfit {
  outfit_id: string;
  closet_id: string;
  name: string;
  description: string | null;
  labels: string[];
  item_ids: string[];
  compliment_count: number;
  outfit_img_preview: { img: ImageSource };
  /** "Worn in the wild" photos, oldest first. Capped at 3 by the UI, not the DB. */
  photos: OutfitPhoto[];
  created_at: string;
  /** Bumped by a DB trigger on every update - used as the optimistic-concurrency token for edits/deletes. */
  updated_at: string;
}

/**
 * The ten outfit tags every closet starts with. Mirrors the DEFAULT of
 * closets.outfit_labels (supabase/migrations/20261111000000_closet_outfit_labels.sql);
 * live closets get their list from that column, so this is only used by
 * preview mode and as the fallback for a database that predates the migration.
 * UI copy calls these "tags"; code and the database keep "label" so nothing
 * existing (outfits.labels, Outfit.labels) had to be renamed.
 */
export const DEFAULT_OUTFIT_LABELS: readonly string[] = [
  'Girly/Romantic',
  'Work',
  'Casual',
  'Date Night',
  'Athleisure',
  'Formal Event',
  'Street Style',
  'Minimalist Chic',
  'Artsy',
  'Boho',
];

/** Longest allowed tag, in characters - mirrored by the closets_outfit_labels_valid check constraint. */
export const MAX_OUTFIT_LABEL_LENGTH = 30;
/** Most tags one closet can have - mirrored by the same check constraint. */
export const MAX_OUTFIT_LABELS = 30;

/**
 * The form tags are stored and compared in - the same steps as the
 * normalize_outfit_label SQL function: invisible format characters
 * (zero-width space/joiners, word joiner, BOM) dropped, control characters
 * turned into spaces, whitespace runs collapsed to one space, ends trimmed.
 * Letter case is kept as typed.
 */
export function normalizeOutfitLabel(raw: string): string {
  return (
    raw
      .replace(/[​-‍⁠﻿]/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Key two tags are compared by: normalised and lower-cased. Matching outfits
 * to filter pills goes through this, so an outfit tagged "Date Night" still
 * shows under a pill re-added as "Date night" after the original was removed.
 */
export function outfitLabelKey(label: string): string {
  return normalizeOutfitLabel(label).toLowerCase();
}

/** True when `labels` contains `label`, ignoring case and stray spaces. */
export function hasOutfitLabel(labels: readonly string[], label: string): boolean {
  const key = outfitLabelKey(label);
  return labels.some(candidate => outfitLabelKey(candidate) === key);
}

export type OutfitLabelValidation = { ok: true; label: string } | { ok: false; message: string };

/**
 * Checks a typed tag against a closet's current list. Messages are
 * user-facing and identical to the ones add_closet_outfit_label raises, so
 * the client and server read the same whichever one catches the problem.
 */
export function validateNewOutfitLabel(raw: string, existing: readonly string[]): OutfitLabelValidation {
  const label = normalizeOutfitLabel(raw);
  if (label.length === 0) return { ok: false, message: 'Enter a tag name.' };
  if (label.length > MAX_OUTFIT_LABEL_LENGTH) {
    return { ok: false, message: `Tags can be up to ${MAX_OUTFIT_LABEL_LENGTH} characters.` };
  }
  // The Outfits filter row always starts with a built-in "All" pill.
  if (label.toLowerCase() === 'all') {
    return { ok: false, message: '"All" is already used by the outfit filter. Choose another name.' };
  }
  const match = existing.find(candidate => candidate.toLowerCase() === label.toLowerCase());
  if (match) return { ok: false, message: `You already have a tag named "${match}".` };
  if (existing.length >= MAX_OUTFIT_LABELS) {
    return { ok: false, message: `You can have up to ${MAX_OUTFIT_LABELS} tags. Remove one to add another.` };
  }
  return { ok: true, label };
}

/**
 * Form data for the "create new outfit" flow. Name (plus a description or a voice note) and at least
 * one item are required, plus at least one tag whenever the closet has tags
 * to choose from; item picking rules (one top + one bottom, or one dress,
 * etc.) are enforced by the form, not this type.
 */
export interface NewOutfitInput {
  closetId: string;
  userId: string;
  name: string;
  description: string;
  /** Chosen from the closet's tags; empty when the closet has none. */
  labels: string[];
  itemIds: string[];
}

/** activity_logs.item_type is a checked text column - mirrors the check constraint as a literal type, since the UI looks up a display label per type. */
export type ActivityItemType = 'outfit' | 'clothing_item';

/** Narrows a raw db string into `ActivityItemType`, throwing on drift from the check constraint. */
export function toActivityItemType(value: string): ActivityItemType {
  if (value === 'outfit' || value === 'clothing_item') return value;
  throw new Error(`Unknown activity_logs.item_type from database: "${value}"`);
}

/**
 * App-facing shape for one activity_logs row. item_name and actor_name are
 * snapshotted by the DB at write time, so they stay readable even after the
 * referenced outfit/clothing item (or the acting user) is later deleted.
 * action_type ('created'/'edited'/'deleted') is shown as-is, so it's kept as
 * a plain string rather than its own narrowed type.
 */
export interface ActivityLogEntry {
  id: string;
  item_type: ActivityItemType;
  item_name: string;
  actor_name: string | null;
  action_type: string;
  created_at: string;
}

/** A closet the current user has stylist (collaborator) access to. */
export interface StylistCloset {
  closet_id: string;
  closet_name: string;
  /** The closet's outfit tags in display order (closets.outfit_labels). The owner edits them in Settings > Edit tags; stylists only read them. */
  outfit_labels: string[];
}

/** The closet the current user owns - only owners can see their own passphrase. */
export interface OwnCloset extends StylistCloset {
  pass_phrase: string;
}

/** A locally-picked (not yet uploaded) photo for a new clothing item. Exactly one must be primary. */
export interface NewClosetItemPhoto {
  uri: string;
  isPrimary: boolean;
  /** True for a background-removed cutout: it is stored as a PNG so it stays transparent. */
  keepTransparency?: boolean;
}

/** Form data for the "add new item" flow. */
export interface NewClosetItemInput {
  closetId: string;
  itemType: ClothingItemType;
  name: string;
  description: string;
  fitNotes: string | null;
  careInstructions: string | null;
  brand: string | null;
  purchaseUrl: string | null;
  /** At least one photo, with exactly one marked primary. */
  photos: NewClosetItemPhoto[];
}

/**
 * Form data for the "edit item" flow. `newPrimaryPhotoUri` is only set when
 * the user picked a replacement photo. `itemType` may differ from the stored
 * one (re-categorizing a "jacket" as a "cardigan"): the item keeps its place
 * in every outfit it's part of and simply shows up in its new category there
 * - outfit composition rules are only enforced when an outfit is created.
 */
export interface UpdateClosetItemInput {
  itemType: ClothingItemType;
  name: string;
  description: string;
  fitNotes: string | null;
  careInstructions: string | null;
  brand: string | null;
  purchaseUrl: string | null;
  newPrimaryPhotoUri: string | null;
  /** True when `newPrimaryPhotoUri` is a background-removed cutout (stored as a transparent PNG). */
  newPrimaryPhotoKeepTransparency?: boolean;
}

/** Form data for the "edit outfit" flow. */
export interface UpdateOutfitInput {
  name: string;
  description: string;
  /**
   * The outfit's full tag list after the edit. May keep a tag the closet
   * owner has since removed from the closet's list (the edit form shows it so
   * it can be unticked) - outfits.labels is free text.
   */
  labels: string[];
  /** The outfit's full item list after the edit (at least one). */
  itemIds: string[];
}

/**
 * Thrown by an update/delete call when the row's `updated_at` no longer
 * matches the value the caller last read - i.e. someone else (a stylist or
 * the closet owner) already edited or deleted it. Callers should refresh
 * their data and let the user decide whether to retry.
 */
export class ConflictError extends Error {
  constructor(message = 'This was changed by someone else. Refreshing with the latest version.') {
    super(message);
    this.name = 'ConflictError';
  }
}

/** Unified contract both the preview (dummy data) and live (Supabase) providers implement. */
export interface IDataService {
  getClosetItems(closetId?: string): Promise<ClosetItem[]>;
  getClosetItemById(itemId: string): Promise<ClosetItem | null>;
  /** Creates a garment and uploads its photos. Throws if no photo is marked primary. */
  createClosetItem(input: NewClosetItemInput): Promise<ClosetItem>;
  /**
   * Updates a garment's editable fields, optionally replacing its primary
   * photo. `expectedUpdatedAt` must match the row's current `updated_at`
   * (i.e. the value from the last read) or this throws `ConflictError`
   * instead of applying the write.
   */
  updateClosetItem(itemId: string, expectedUpdatedAt: string, input: UpdateClosetItemInput): Promise<ClosetItem>;
  /**
   * Deletes a garment. Its clothing_item_photos/outfit_items/wear_logs rows
   * cascade-delete in the DB. `expectedUpdatedAt` must match the row's
   * current `updated_at` or this throws `ConflictError` instead of deleting.
   */
  deleteClosetItem(itemId: string, expectedUpdatedAt: string): Promise<void>;
  /** Uploads a non-primary photo for an existing closet item and returns its new row. */
  addClosetItemPhoto(itemId: string, uri: string): Promise<ClosetItemPhoto>;
  /** Deletes one non-primary closet item photo (row + storage object). */
  deleteClosetItemPhoto(photo: ClosetItemPhoto): Promise<void>;
  getOutfits(closetId?: string): Promise<Outfit[]>;
  getOutfitById(outfitId: string): Promise<Outfit | null>;
  /** Creates an outfit from picked closet items. */
  createOutfit(input: NewOutfitInput): Promise<Outfit>;
  /**
   * Updates an outfit's name, description, tags and items in one atomic
   * write. `expectedUpdatedAt` must match
   * the row's current `updated_at` or this throws `ConflictError` instead of
   * applying the write.
   */
  updateOutfit(outfitId: string, expectedUpdatedAt: string, input: UpdateOutfitInput): Promise<Outfit>;
  /**
   * Deletes an outfit. The outfit_items/outfit_photos/wear_logs rows for it
   * cascade-delete in the DB. `expectedUpdatedAt` must match the row's
   * current `updated_at` or this throws `ConflictError` instead of deleting.
   */
  deleteOutfit(outfitId: string, expectedUpdatedAt: string): Promise<void>;
  /** Uploads a "worn in the wild" photo for an outfit and returns its new row. */
  addOutfitPhoto(outfitId: string, uri: string): Promise<OutfitPhoto>;
  /** Deletes one outfit photo (row + storage object). */
  deleteOutfitPhoto(photo: OutfitPhoto): Promise<void>;
  /** Increments an outfit's compliment count and returns the new value. */
  logCompliment(outfitId: string): Promise<number>;
  /** Wear count for an outfit, plus whether the current user already logged it worn today. */
  getOutfitWearStatus(closetId: string, outfitId: string, userId: string): Promise<OutfitWearStatus>;
  /** Logs an outfit as worn today by `userId`. Returns the new wear_logs row id. */
  logOutfitWornToday(closetId: string, outfitId: string, userId: string): Promise<string>;
  /** Deletes a wear_logs row (e.g. undoing today's log). */
  deleteWearLog(wearLogId: string): Promise<void>;
  /**
   * Total wear count across a set of outfits (e.g. every outfit a clothing
   * item is featured in), used to show that item's own "worn X times" count
   * without a dedicated per-item log. Returns 0 for an empty `outfitIds`.
   */
  getWearCountForOutfits(closetId: string, outfitIds: string[]): Promise<number>;
  /** Closets `userId` collaborates on (stylist access), not counting ones they own. */
  getStylistClosets(userId: string): Promise<StylistCloset[]>;
  /** The closet `userId` owns, or null if they haven't created one yet. */
  getOwnCloset(userId: string): Promise<OwnCloset | null>;
  /** Creates `userId`'s own closet with a user-chosen name; the passphrase is always server-generated. */
  createOwnCloset(userId: string, closetName: string): Promise<OwnCloset>;
  /** Joins the caller to the closet matching `passphrase` as a stylist/collaborator. Throws if the passphrase is invalid or belongs to a closet the caller already owns. */
  joinClosetByPassphrase(passphrase: string): Promise<StylistCloset>;
  /** A closet's current outfit tags, in display order. Any member can read them; used to pick up edits made by the owner or on another device. */
  getClosetOutfitLabels(closetId: string): Promise<string[]>;
  /** Adds a tag to a closet's outfit tag list and returns the full updated list. `atIndex` (0-based) puts it at that position - used to undo a removal; omitted appends. Caller must own the closet. Throws with a user-facing message if the tag is empty, too long, "All", a duplicate (ignoring case) or the list is full. */
  addClosetOutfitLabel(closetId: string, label: string, atIndex?: number): Promise<string[]>;
  /** Removes a tag from a closet's outfit tag list and returns the full updated list. Outfits that already carry the tag keep it. Caller must own the closet. */
  removeClosetOutfitLabel(closetId: string, label: string): Promise<string[]>;
  /** Most recent create/edit/delete activity for a closet, newest first, capped at `limit`. */
  getActivityLog(closetId: string, limit?: number): Promise<ActivityLogEntry[]>;
  /** Voice notes attached to one outfit or clothing item, oldest first. */
  getVoiceNotes(target: VoiceNoteTarget): Promise<VoiceNote[]>;
  /** Uploads a finished recording and links it to `target`. Returns the new row. */
  addVoiceNote(target: VoiceNoteTarget, closetId: string, recording: PendingVoiceNote): Promise<VoiceNote>;
  /** Deletes one voice note (row + storage object). RLS limits this to the recorder or the closet owner. */
  deleteVoiceNote(note: VoiceNote): Promise<void>;
}

/** A titled group of closet items for one category, e.g. the "Tops" section on the closet screen. */
export type ClosetSection = {
  title: string;
  category: ClothingCategory;
  data: ClosetItem[];
};

const CATEGORY_ORDER: readonly ClothingCategory[] = [
  'top',
  'sweater',
  'cardigan',
  'bottom',
  'shoes',
  'jacket',
  'dress',
  'bag',
  'accessory',
];

/** Display title for each closet category - section headers, filter pills, and picker limit messages all read from here. */
export const CATEGORY_TITLES: Record<ClothingCategory, string> = {
  top: 'Tops',
  sweater: 'Sweaters',
  cardigan: 'Cardigans',
  bottom: 'Bottoms',
  dress: 'Dresses',
  shoes: 'Shoes',
  jacket: 'Jackets',
  bag: 'Bags',
  accessory: 'Accessories',
};

/**
 * Extracts a display message from a thrown value. Supabase throws
 * PostgrestError, a plain object with a `.message` string that is NOT an
 * `instanceof Error` - code that only checked `instanceof Error` silently
 * dropped the real message and showed the generic fallback instead.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}

/** Groups a flat item list into ordered, titled sections, dropping any empty category. */
export function groupClosetItemsBySection(items: ClosetItem[]): ClosetSection[] {
  return groupClosetItemsByAllCategories(items).filter(section => section.data.length > 0);
}

/** Same as groupClosetItemsBySection but keeps every category, even ones with no items - used by pickers that need a stable tab per category. */
export function groupClosetItemsByAllCategories(items: ClosetItem[]): ClosetSection[] {
  return CATEGORY_ORDER.map(category => ({
    title: CATEGORY_TITLES[category],
    category,
    data: items.filter(item => item.category === category),
  }));
}
