import { Closet_Data } from '@/constants/closetData';
import { MyOutfits_Data } from '@/constants/MyOutfitsData';
import { mapCategoryToDefaultItemType, mapItemTypeToCategory, todayDateString } from './dataService.types';
import type {
  ActivityLogEntry,
  ClosetItem,
  ClosetItemPhoto,
  IDataService,
  NewClosetItemInput,
  NewOutfitInput,
  Outfit,
  OutfitPhoto,
  OutfitWearStatus,
  OwnCloset,
  StylistCloset,
  UpdateClosetItemInput,
  UpdateOutfitInput,
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

// "Worn in the wild" photos added during a guest session, keyed by outfit
// id - same session-only lifetime as everything else above.
const previewOutfitPhotos = new Map<string, OutfitPhoto[]>();

// Extra closet item photos added during a guest session, keyed by item id -
// same session-only lifetime as everything else above.
const previewClosetItemPhotos = new Map<string, ClosetItemPhoto[]>();

// Edits made to bundled or session-created items/outfits during a guest
// session, keyed by item/outfit id - same session-only lifetime as
// everything else above.
const previewItemOverrides = new Map<string, Partial<ClosetItem>>();
const previewOutfitOverrides = new Map<string, Partial<Outfit>>();

// "Worn today" logs added during a guest session, keyed by outfit id - same
// session-only lifetime as everything else above.
const previewWearLogs = new Map<string, { id: string; date: string }[]>();

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
  return [...bundledItems, ...previewCreatedItems]
    .filter(item => !previewDeletedItemIds.has(item.item_id))
    .map(item => ({
      ...item,
      secondary_photos: previewClosetItemPhotos.get(item.item_id) ?? item.secondary_photos,
      ...previewItemOverrides.get(item.item_id),
    }));
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
    photos: [],
    created_at: now,
  }));
  return [...bundledOutfits, ...previewCreatedOutfits]
    .filter(outfit => !previewDeletedOutfitIds.has(outfit.outfit_id))
    .map(outfit => ({
      ...outfit,
      photos: previewOutfitPhotos.get(outfit.outfit_id) ?? outfit.photos,
      ...previewOutfitOverrides.get(outfit.outfit_id),
    }));
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
      purchase_url: input.purchaseUrl,
      img: primaryPhoto.uri,
      secondary_photos: [],
      created_at: new Date().toISOString(),
    };
    previewCreatedItems.push(created);
    return delay(created);
  }

  async updateClosetItem(itemId: string, input: UpdateClosetItemInput): Promise<ClosetItem> {
    const existing = toClosetItems().find(candidate => candidate.item_id === itemId);
    if (!existing) throw new Error('Item not found.');

    previewItemOverrides.set(itemId, {
      ...previewItemOverrides.get(itemId),
      name: input.name,
      description: input.description,
      fit_notes: input.fitNotes,
      care_instructions: input.careInstructions,
      brand: input.brand,
      purchase_url: input.purchaseUrl,
      ...(input.newPrimaryPhotoUri ? { img: input.newPrimaryPhotoUri } : {}),
    });

    const updated = toClosetItems().find(candidate => candidate.item_id === itemId);
    if (!updated) throw new Error('Item not found.');
    return delay(updated);
  }

  async deleteClosetItem(itemId: string): Promise<void> {
    previewDeletedItemIds.add(itemId);
    return delay(undefined);
  }

  async addClosetItemPhoto(itemId: string, uri: string): Promise<ClosetItemPhoto> {
    const photo: ClosetItemPhoto = {
      id: `preview-item-photo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      image_url: uri,
      created_at: new Date().toISOString(),
    };
    previewClosetItemPhotos.set(itemId, [...(previewClosetItemPhotos.get(itemId) ?? []), photo]);
    return delay(photo);
  }

  async deleteClosetItemPhoto(photo: ClosetItemPhoto): Promise<void> {
    for (const [itemId, photos] of previewClosetItemPhotos) {
      if (photos.some(candidate => candidate.id === photo.id)) {
        previewClosetItemPhotos.set(
          itemId,
          photos.filter(candidate => candidate.id !== photo.id),
        );
        break;
      }
    }
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
      photos: [],
      created_at: new Date().toISOString(),
    };
    previewCreatedOutfits.push(created);
    return delay(created);
  }

  async updateOutfit(outfitId: string, input: UpdateOutfitInput): Promise<Outfit> {
    const existing = toOutfits().find(candidate => candidate.outfit_id === outfitId);
    if (!existing) throw new Error('Outfit not found.');

    previewOutfitOverrides.set(outfitId, {
      ...previewOutfitOverrides.get(outfitId),
      name: input.name,
      description: input.description,
    });

    const updated = toOutfits().find(candidate => candidate.outfit_id === outfitId);
    if (!updated) throw new Error('Outfit not found.');
    return delay(updated);
  }

  async deleteOutfit(outfitId: string): Promise<void> {
    previewDeletedOutfitIds.add(outfitId);
    return delay(undefined);
  }

  async addOutfitPhoto(outfitId: string, uri: string): Promise<OutfitPhoto> {
    const photo: OutfitPhoto = {
      id: `preview-outfit-photo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      image_url: uri,
      created_at: new Date().toISOString(),
    };
    previewOutfitPhotos.set(outfitId, [...(previewOutfitPhotos.get(outfitId) ?? []), photo]);
    return delay(photo);
  }

  async deleteOutfitPhoto(photo: OutfitPhoto): Promise<void> {
    for (const [outfitId, photos] of previewOutfitPhotos) {
      if (photos.some(candidate => candidate.id === photo.id)) {
        previewOutfitPhotos.set(
          outfitId,
          photos.filter(candidate => candidate.id !== photo.id),
        );
        break;
      }
    }
    return delay(undefined);
  }

  async logCompliment(outfitId: string): Promise<number> {
    const existing = toOutfits().find(candidate => candidate.outfit_id === outfitId);
    if (!existing) throw new Error('Outfit not found.');

    const newCount = existing.compliment_count + 1;
    previewOutfitOverrides.set(outfitId, {
      ...previewOutfitOverrides.get(outfitId),
      compliment_count: newCount,
    });
    return delay(newCount);
  }

  async getOutfitWearStatus(_closetId: string, outfitId: string, _userId: string): Promise<OutfitWearStatus> {
    const logs = previewWearLogs.get(outfitId) ?? [];
    const todayLog = logs.find(log => log.date === todayDateString());
    return delay({ wearCount: logs.length, todayWearLogId: todayLog?.id ?? null });
  }

  async logOutfitWornToday(_closetId: string, outfitId: string, _userId: string): Promise<string> {
    const id = `preview-wear-log-${Date.now()}`;
    const logs = previewWearLogs.get(outfitId) ?? [];
    previewWearLogs.set(outfitId, [...logs, { id, date: todayDateString() }]);
    return delay(id);
  }

  async deleteWearLog(wearLogId: string): Promise<void> {
    for (const [outfitId, logs] of previewWearLogs) {
      if (logs.some(log => log.id === wearLogId)) {
        previewWearLogs.set(
          outfitId,
          logs.filter(log => log.id !== wearLogId),
        );
        break;
      }
    }
    return delay(undefined);
  }

  async getWearCountForOutfits(_closetId: string, outfitIds: string[]): Promise<number> {
    const outfitIdSet = new Set(outfitIds);
    let total = 0;
    for (const [outfitId, logs] of previewWearLogs) {
      if (outfitIdSet.has(outfitId)) total += logs.length;
    }
    return delay(total);
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

  // Preview mode has one hardcoded closet, so this just checks the guess
  // against its own passphrase rather than searching a real closets table.
  async joinClosetByPassphrase(passphrase: string): Promise<StylistCloset> {
    if (passphrase !== PREVIEW_PASS_PHRASE) {
      throw new Error('Invalid passphrase');
    }
    return delay({ closet_id: PREVIEW_CLOSET.closet_id, closet_name: PREVIEW_CLOSET.closet_name });
  }

  // Preview mode has no real activity_logs table behind it, so guest sessions
  // just see an empty feed rather than synthesizing fake history.
  async getActivityLog(_closetId: string, _limit?: number): Promise<ActivityLogEntry[]> {
    return delay([]);
  }
}

export const previewService: IDataService = new PreviewDataService();
