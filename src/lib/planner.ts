import { supabase } from "@/integrations/supabase/client";

/** Returns a normalized URL only when it uses http/https; otherwise null. */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

export type EventRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  location: string | null;
  is_public: boolean;
  created_at: string;
  tags: string[];
  show_description: boolean;
  show_date: boolean;
  show_location: boolean;
  show_tags: boolean;
  show_nodes: boolean;
  show_creator: boolean;
};

/** A public event as exposed by the masked feed view. */
export type PublicEventRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  location: string | null;
  created_at: string;
  tags: string[] | null;
  show_nodes: boolean;
  show_creator: boolean;
};

export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

export type NodeRow = {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  preferences: string | null;
  concerned_parties: string | null;
  vendor_name: string | null;
  vendor_contact: string | null;
  vendor_link: string | null;
  group_label: string | null;
  scheduled_at: string | null;
  position: number;
  is_done: boolean;
};

export async function fetchMyEvents(userId: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

/** Public events from other planners, with owner-hidden fields already masked. */
export async function fetchPublicEvents(userId: string) {
  const { data, error } = await supabase
    .from("public_event_feed")
    .select("*")
    .neq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as PublicEventRow[];
}

/** Display names for a set of user ids (RLS hides profiles you may not see). */
export async function fetchProfiles(ids: string[]) {
  if (ids.length === 0) return [] as ProfileRow[];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

export async function fetchProfile(id: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ProfileRow | null;
}

/** Public events belonging to one creator. */
export async function fetchPublicEventsByOwner(ownerId: string) {
  const { data, error } = await supabase
    .from("public_event_feed")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as PublicEventRow[];
}

/** Group labels used by an event's steps, for day/group filtering. */
export async function fetchGroupLabels(eventIds: string[]) {
  if (eventIds.length === 0) return {} as Record<string, string[]>;
  const { data, error } = await supabase
    .from("event_nodes")
    .select("event_id, group_label")
    .in("event_id", eventIds);
  if (error) throw error;
  const map: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const label = row.group_label?.trim();
    if (!label) continue;
    const list = (map[row.event_id] ??= []);
    if (!list.includes(label)) list.push(label);
  }
  return map;
}


export async function fetchEvent(id: string) {
  const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as EventRow | null;
}

export async function fetchNodes(eventId: string) {
  const { data, error } = await supabase
    .from("event_nodes")
    .select("*")
    .eq("event_id", eventId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as NodeRow[];
}
export type ShareRow = {
  id: string;
  event_id: string;
  invited_email: string;
  can_edit: boolean;
  status: "pending" | "approved" | "changes_requested";
  note: string | null;
  created_at: string;
};

export async function fetchShares(eventId: string) {
  const { data, error } = await supabase
    .from("event_shares")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ShareRow[];
}

/** Shares addressed to the signed-in user (RLS filters by their email). */
export async function fetchMyInvites(email: string) {
  const { data, error } = await supabase
    .from("event_shares")
    .select("*")
    .ilike("invited_email", email)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ShareRow[];
}

export async function fetchEventsByIds(ids: string[]) {
  if (ids.length === 0) return [] as EventRow[];
  const { data, error } = await supabase.from("events").select("*").in("id", ids);
  if (error) throw error;
  return (data ?? []) as EventRow[];
}
