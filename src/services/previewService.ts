import { Closet_Data } from '@/constants/closetData';
import { MyOutfits_Data } from '@/constants/MyOutfitsData';
import { mapCategoryToDefaultItemType, mapItemTypeToCategory } from './dataService.types';
import type {
  ClosetItem,
  IDataService,
  NewClosetItemInput,
  NewOutfitInput,
  Outfit,
  OwnCloset,
  StylistCloset,
} from './dataService.types';

/** Same stock image supabaseRowMappers falls back to when a row has no photo yet. */
const PLACEHOLDER_IMAGE = require('../../assets/images/clothes/outfit_preview.jpg');

const NETWORK_DELAY_MS = 400;
const PREVIEW_PASS_PHRASE = 'preview-phrase';
const PREVIEW_CLOSET: OwnCloset = {
  closet_id: 'preview-closet',
  closet_name: 'Preview Closet',
  pass_phrase: PREVIEW_PASS_PHRASE,
};

function delay<T>(value: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), NETWORK_DELAY_MS));
}

// Preview mode has no real backend to persist to, so items created via the
// "add new item" form during a guest session are kept here for the rest of
// the session instead - lost on app restart, which is fine for a guest.
const previewCreatedItems: ClosetItem[] = [];

// Same idea as previewCreatedItems, but for outfits created via the
// "create outfit" form during a guest session.
const previewCreatedOutfits: Outfit[] = [];

// Bundled dummy items/outfits are static imports, not real rows, so
// "deleting" one during a guest session just hides its id here instead of
// mutating Closet_Data/MyOutfits_Data - same session-only lifetime as
// previewCreatedItems/previewCreatedOutfits above.
const previewDeletedItemIds = new Set<string>();
const previewDeletedOutfitIds = new Set<string>();

function toClosetItems(): ClosetItem[] {
  const now = new Date().toISOString();
  const bundledItems = Closet_Data.map(item => ({
    item_id: item.id,
    closet_id: 'preview-closet',
    item_type: mapCategoryToDefaultItemType(item.category),
    category: item.category,
    name: item.name,
    description: item.description,
    brand: null,
    fit_notes: null,
    care_instructions: null,
    purchase_url: null,
    img: item.img,
    secondary_photos: [],
    created_at: now,
  }));
  return [...bundledItems, ...previewCreatedItems].filter(item => !previewDeletedItemIds.has(item.item_id));
}

function toOutfits(): Outfit[] {
  const now = new Date().toISOString();
  const bundledOutfits = MyOutfits_Data.map(outfit => ({
    outfit_id: outfit.outfit_id,
    closet_id: 'preview-closet',
    name: outfit.name,
    description: outfit.description,
    labels: outfit.labels,
    item_ids: outfit.item_ids,
    compliment_count: 0,
    outfit_img_preview: { img: outfit.outfit_img_preview.img },
    created_at: now,
  }));
  return [...bundledOutfits, ...previewCreatedOutfits].filter(
    outfit => !previewDeletedOutfitIds.has(outfit.outfit_id),
  );
}

class PreviewDataService implements IDataService {
  // closetId is accepted for interface parity with supabaseService but ignored -
  // preview mode only ever has the one bundled dummy closet.
  async getClosetItems(_closetId?: string): Promise<ClosetItem[]> {
    return delay(toClosetItems());
  }

  async getClosetItemById(itemId: string): Promise<ClosetItem | null> {
    const item = toClosetItems().find(candidate => candidate.item_id === itemId) ?? null;
    return delay(item);
  }

  async createClosetItem(input: NewClosetItemInput): Promise<ClosetItem> {
    const primaryPhoto = input.photos.find(photo => photo.isPrimary);
    if (!primaryPhoto) {
      throw new Error('At least one photo must be marked as primary.');
    }

    const created: ClosetItem = {
      item_id: `preview-item-${Date.now()}`,
      closet_id: input.closetId,
      item_type: input.itemType,
      category: mapItemTypeToCategory(input.itemType),
      name: input.name,
      description: input.description,
      brand: input.brand,
      fit_notes: input.fitNotes,
      care_instructions: input.careInstructions,
      purchase_url: null,
      img: primaryPhoto.uri,
      secondary_photos: [],
      created_at: new Date().toISOString(),
    };
    previewCreatedItems.push(created);
    return delay(created);
  }

  async deleteClosetItem(itemId: string): Promise<void> {
    previewDeletedItemIds.add(itemId);
    return delay(undefined);
  }

  async getOutfits(_closetId?: string): Promise<Outfit[]> {
    return delay(toOutfits());
  }

  async getOutfitById(outfitId: string): Promise<Outfit | null> {
    const outfit = toOutfits().find(candidate => candidate.outfit_id === outfitId) ?? null;
    return delay(outfit);
  }

  async createOutfit(input: NewOutfitInput): Promise<Outfit> {
    const created: Outfit = {
      outfit_id: `preview-outfit-${Date.now()}`,
      closet_id: input.closetId,
      name: input.name,
      description: input.description,
      labels: [input.label],
      item_ids: input.itemIds,
      compliment_count: 0,
      outfit_img_preview: { img: PLACEHOLDER_IMAGE },
      created_at: new Date().toISOString(),
    };
    previewCreatedOutfits.push(created);
    return delay(created);
  }

  async deleteOutfit(outfitId: string): Promise<void> {
    previewDeletedOutfitIds.add(outfitId);
    return delay(undefined);
  }

  async getStylistClosets(_userId: string): Promise<StylistCloset[]> {
    return delay([]);
  }

  async getOwnCloset(_userId: string): Promise<OwnCloset> {
    return delay(PREVIEW_CLOSET);
  }

  // Preview mode always has a closet already, so the creation form never
  // shows - this exists purely for interface parity.
  async createOwnCloset(_userId: string, _closetName: string): Promise<OwnCloset> {
    return delay(PREVIEW_CLOSET);
  }

  async regeneratePassphrase(_closetId: string): Promise<string> {
    return delay(PREVIEW_PASS_PHRASE);
  }
}

export const previewService: IDataService = new PreviewDataService();
