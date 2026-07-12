import type { ClothingCategory } from '@/constants/closetData';

/**
 * clothing_items.item_type is a checked text column in Postgres (see
 * supabase/schema.sql), not a real enum, so supabase-gen types it as plain
 * `string`. This union mirrors that check constraint so the app gets a
 * literal type instead of losing type-safety to the DB's looser column type.
 */
export type ClothingItemType =
  | 'shirt'
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
  shirt: 'Top (tank, short, sweater, etc)',
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

/** How many times an outfit has been logged as worn, and whether the current user already logged it today. */
export interface OutfitWearStatus {
  wearCount: number;
  /** id of today's wear_logs row logged by the current user, or null if they haven't logged it today. */
  todayWearLogId: string | null;
}

/** Today's date as wear_logs.worn_on_date expects it (a plain date, no time component). */
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
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
}

/**
 * Hardcoded vibe/occasion labels for the "create outfit" form (single-select
 * for v1). Kept as a plain const list, same pattern as CLOTHING_ITEM_TYPES,
 * so adding/renaming a label later is a one-line change.
 */
export const OUTFIT_LABELS = [
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
] as const;

export type OutfitLabel = (typeof OUTFIT_LABELS)[number];

/**
 * Form data for the "create new outfit" flow. Name, description, label, and
 * at least one item are all required; item picking rules (one top + one
 * bottom, or one dress, etc.) are enforced by the form, not this type.
 */
export interface NewOutfitInput {
  closetId: string;
  userId: string;
  name: string;
  description: string;
  label: OutfitLabel;
  itemIds: string[];
}

/** A closet the current user has stylist (collaborator) access to. */
export interface StylistCloset {
  closet_id: string;
  closet_name: string;
}

/** The closet the current user owns - only owners can see their own passphrase. */
export interface OwnCloset extends StylistCloset {
  pass_phrase: string;
}

/** A locally-picked (not yet uploaded) photo for a new clothing item. Exactly one must be primary. */
export interface NewClosetItemPhoto {
  uri: string;
  isPrimary: boolean;
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

/** Unified contract both the preview (dummy data) and live (Supabase) providers implement. */
export interface IDataService {
  getClosetItems(closetId?: string): Promise<ClosetItem[]>;
  getClosetItemById(itemId: string): Promise<ClosetItem | null>;
  /** Creates a garment and uploads its photos. Throws if no photo is marked primary. */
  createClosetItem(input: NewClosetItemInput): Promise<ClosetItem>;
  /** Deletes a garment. Its clothing_item_photos/outfit_items/wear_logs rows cascade-delete in the DB. */
  deleteClosetItem(itemId: string): Promise<void>;
  /** Uploads a non-primary photo for an existing closet item and returns its new row. */
  addClosetItemPhoto(itemId: string, uri: string): Promise<ClosetItemPhoto>;
  /** Deletes one non-primary closet item photo (row + storage object). */
  deleteClosetItemPhoto(photo: ClosetItemPhoto): Promise<void>;
  getOutfits(closetId?: string): Promise<Outfit[]>;
  getOutfitById(outfitId: string): Promise<Outfit | null>;
  /** Creates an outfit from picked closet items. */
  createOutfit(input: NewOutfitInput): Promise<Outfit>;
  /** Deletes an outfit. The outfit_items/outfit_photos/wear_logs rows for it cascade-delete in the DB. */
  deleteOutfit(outfitId: string): Promise<void>;
  /** Uploads a "worn in the wild" photo for an outfit and returns its new row. */
  addOutfitPhoto(outfitId: string, uri: string): Promise<OutfitPhoto>;
  /** Deletes one outfit photo (row + storage object). */
  deleteOutfitPhoto(photo: OutfitPhoto): Promise<void>;
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
  /** Replaces a closet's passphrase and returns the new value. Caller must own the closet. */
  regeneratePassphrase(closetId: string): Promise<string>;
}

/** A titled group of closet items for one category, e.g. the "Tops" section on the closet screen. */
export type ClosetSection = {
  title: string;
  category: ClothingCategory;
  data: ClosetItem[];
};

const CATEGORY_ORDER: readonly ClothingCategory[] = [
  'top',
  'bottom',
  'shoes',
  'jacket',
  'dress',
  'bag',
  'accessory',
];

const CATEGORY_TITLES: Record<ClothingCategory, string> = {
  top: 'Tops',
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
