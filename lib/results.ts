import { supabase } from "./supabase";

export async function fetchSessionByCode(code: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, code, title, is_open")
    .eq("code", code)
    .single();

  if (error) throw error;
  return data;
}

export async function fetchOptions(sessionId: string) {
  const { data, error } = await supabase
    .from("options")
    .select("id, name, sort")
    .eq("session_id", sessionId)
    .order("sort", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchVoteCounts(sessionId: string) {
  const { data, error } = await supabase
    .from("votes")
    .select("option_id")
    .eq("session_id", sessionId);

  if (error) throw error;

  const counts = new Map<string, number>();
  for (const v of data ?? []) {
    counts.set(v.option_id, (counts.get(v.option_id) ?? 0) + 1);
  }
  return counts;
}
