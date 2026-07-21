import { supabase } from '@/utils/supabase';
import { toActivityItemType, type ActivityLogEntry } from './dataService.types';

/** Most recent activity for a closet, newest first, capped at `limit`. Throws the Supabase error on failure. */
export async function getActivityLog(closetId: string, limit = 10): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, item_type, item_name, actor_name, action_type, created_at')
    .eq('closet_id', closetId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return data.map(row => ({
    id: row.id,
    item_type: toActivityItemType(row.item_type),
    item_name: row.item_name,
    actor_name: row.actor_name,
    action_type: row.action_type,
    created_at: row.created_at,
  }));
}
