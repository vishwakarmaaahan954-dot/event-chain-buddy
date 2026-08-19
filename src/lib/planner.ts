import { supabase } from "@/integrations/supabase/client";

export type EventRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  location: string | null;
  is_public: boolean;
  created_at: string;
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

export async function fetchPublicEvents(userId: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("is_public", true)
    .neq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as EventRow[];
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