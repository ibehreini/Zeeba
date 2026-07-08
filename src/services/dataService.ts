import { previewService } from './previewService';
import { supabaseService } from './supabaseService';
import type { IDataService } from './dataService.types';

/** 'live' hits the real Supabase backend; 'preview' serves bundled dummy data
 *  (used automatically for guests who bypass sign-in via "Preview mode"). */
export type DataMode = 'live' | 'preview';

const SERVICES_BY_MODE: Record<DataMode, IDataService> = {
  live: supabaseService,
  preview: previewService,
};

export function getDataService(mode: DataMode): IDataService {
  return SERVICES_BY_MODE[mode];
}

export type { ClosetItem, IDataService, Outfit, OwnCloset, StylistCloset } from './dataService.types';
