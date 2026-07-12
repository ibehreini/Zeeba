import type { IDataService } from './dataService.types';
import { createOwnCloset, getOwnCloset, getStylistClosets, regeneratePassphrase } from './supabaseClosetsService';
import {
  addClosetItemPhoto,
  createClosetItem,
  deleteClosetItem,
  deleteClosetItemPhoto,
  getClosetItemById,
  getClosetItems,
} from './supabaseClosetItemsService';
import {
  addOutfitPhoto,
  createOutfit,
  deleteOutfit,
  deleteOutfitPhoto,
  getOutfitById,
  getOutfits,
} from './supabaseOutfitsService';
import {
  deleteWearLog,
  getOutfitWearStatus,
  getWearCountForOutfits,
  logOutfitWornToday,
} from './supabaseWearLogsService';

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
  deleteClosetItem,
  addClosetItemPhoto,
  deleteClosetItemPhoto,
  getOutfits,
  getOutfitById,
  createOutfit,
  deleteOutfit,
  addOutfitPhoto,
  deleteOutfitPhoto,
  getOutfitWearStatus,
  logOutfitWornToday,
  deleteWearLog,
  getWearCountForOutfits,
  getStylistClosets,
  getOwnCloset,
  createOwnCloset,
  regeneratePassphrase,
};
