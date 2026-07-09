import type { IDataService } from './dataService.types';
import { createOwnCloset, getOwnCloset, getStylistClosets, regeneratePassphrase } from './supabaseClosetsService';
import { createClosetItem, getClosetItemById, getClosetItems } from './supabaseClosetItemsService';
import { getOutfitById, getOutfits } from './supabaseOutfitsService';

/**
 * Live `IDataService` backed by Supabase. Just wires together the
 * feature-scoped services below - closet items, outfits, and closets each
 * live in their own module (plus shared row-mapping and photo-upload
 * helpers) so this file stays a simple composition root rather than one
 * large class covering three unrelated domains.
 */
export const supabaseService: IDataService = {
  getClosetItems,
  getClosetItemById,
  createClosetItem,
  getOutfits,
  getOutfitById,
  getStylistClosets,
  getOwnCloset,
  createOwnCloset,
  regeneratePassphrase,
};
