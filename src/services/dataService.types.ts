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

/**
 * fit_notes is freeform text in the db (see schema.sql), but the create-item
 * form presents it as a select of the same common phrases already used in
 * the seed data, rather than a free text box.
 */
export const FIT_NOTES_OPTIONS: readonly string[] = [
  'True to size',
  'Runs small',
  'Runs large',
  'Fits loose/oversized',
  'Fits boxy',
  'Runs tight',
];

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
  created_at: string;
}

/**
 * App-facing shape for an outfit. Sourced from outfits + outfit_items (join
 * table -> item_ids) + outfit_photos (-> preview image) in live mode, or
 * MyOutfits_Data in preview mode.
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
  created_at: string;
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
  /** At least one photo, with exactly one marked primary. */
  photos: NewClosetItemPhoto[];
}

/** Unified contract both the preview (dummy data) and live (Supabase) providers implement. */
export interface IDataService {
  getClosetItems(closetId?: string): Promise<ClosetItem[]>;
  getClosetItemById(itemId: string): Promise<ClosetItem | null>;
  /** Creates a garment and uploads its photos. Throws if no photo is marked primary. */
  createClosetItem(input: NewClosetItemInput): Promise<ClosetItem>;
  getOutfits(closetId?: string): Promise<Outfit[]>;
  getOutfitById(outfitId: string): Promise<Outfit | null>;
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
  return CATEGORY_ORDER.map(category => ({
    title: CATEGORY_TITLES[category],
    category,
    data: items.filter(item => item.category === category),
  })).filter(section => section.data.length > 0);
}
