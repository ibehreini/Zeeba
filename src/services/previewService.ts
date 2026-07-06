import { Closet_Data } from '@/constants/closetData';
import { MyOutfits_Data } from '@/constants/MyOutfitsData';
import { mapCategoryToDefaultItemType } from './dataService.types';
import type { ClosetItem, IDataService, Outfit } from './dataService.types';

const NETWORK_DELAY_MS = 400;

function delay<T>(value: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), NETWORK_DELAY_MS));
}

function toClosetItems(): ClosetItem[] {
  const now = new Date().toISOString();
  return Closet_Data.map(item => ({
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
    created_at: now,
  }));
}

function toOutfits(): Outfit[] {
  const now = new Date().toISOString();
  return MyOutfits_Data.map(outfit => ({
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
}

class PreviewDataService implements IDataService {
  async getClosetItems(): Promise<ClosetItem[]> {
    return delay(toClosetItems());
  }

  async getClosetItemById(itemId: string): Promise<ClosetItem | null> {
    const item = toClosetItems().find(candidate => candidate.item_id === itemId) ?? null;
    return delay(item);
  }

  async getOutfits(): Promise<Outfit[]> {
    return delay(toOutfits());
  }

  async getOutfitById(outfitId: string): Promise<Outfit | null> {
    const outfit = toOutfits().find(candidate => candidate.outfit_id === outfitId) ?? null;
    return delay(outfit);
  }
}

export const previewService: IDataService = new PreviewDataService();
