import { supabase } from "../lib/supabase";
import { normalizeNote } from "./smashNoteModel";

const NOTES_TABLE = "notes";

function fromDb(row) {
  const parsed = new Date(row.updated_at).getTime();
  const normalized = normalizeNote({
    id: row.id,
    title: row.title || "",
    body: row.body || "",
    character: row.character || undefined,
    opponent: row.opponent || undefined,
    category: row.category || undefined,
    sections: row.sections || undefined,
    playerTag: row.player_tag || undefined,
    startggPlayerId: row.startgg_player_id || undefined,
    setId: row.set_id || undefined,
    setTournament: row.set_tournament || undefined,
    setEvent: row.set_event || undefined,
    setScore: row.set_score || undefined,
    updatedAt: Number.isFinite(parsed) ? parsed : Date.now(),
  });

  return {
    ...normalized,
    updatedAt: Number.isFinite(parsed) ? parsed : Date.now(),
  };
}

function toDb(note, userId) {
  const normalized = normalizeNote(note);

  return {
    id: normalized.id,
    user_id: userId,
    title: normalized.title || "",
    body: normalized.body || "",
    character: normalized.character || "General",
    opponent: normalized.opponent || null,
    category: normalized.category || (normalized.opponent ? "matchup" : "general"),
    sections: normalized.sections || {},
    player_tag: normalized.playerTag || null,
    startgg_player_id: normalized.startggPlayerId || null,
    set_id: normalized.setId || null,
    set_tournament: normalized.setTournament || null,
    set_event: normalized.setEvent || null,
    set_score: normalized.setScore || null,
    updated_at: new Date(normalized.updatedAt || Date.now()).toISOString(),
  };
}

export async function fetchNotesForUser(userId) {
  // Try with new player columns first; fall back to old schema if they don't exist yet
  let { data, error } = await supabase
    .from(NOTES_TABLE)
    .select("id, title, body, character, opponent, category, sections, player_tag, startgg_player_id, set_id, set_tournament, set_event, set_score, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error && /player_tag|startgg_player_id|set_id|set_tournament|set_event|set_score/.test(error.message || error.code || "")) {
    ({ data, error } = await supabase
      .from(NOTES_TABLE)
      .select("id, title, body, character, opponent, category, sections, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }));
  }

  if (error) {
    throw error;
  }

  return (data || []).map(fromDb);
}

export async function upsertNoteForUser(userId, note) {
  const row = toDb(note, userId);

  let { error } = await supabase.from(NOTES_TABLE).upsert([row], {
    onConflict: "id",
  });

  // If upsert fails due to missing columns, retry without the new fields
  if (error && /player_tag|startgg_player_id|set_id|set_tournament|set_event|set_score/.test(error.message || error.code || "")) {
    const { player_tag, startgg_player_id, set_id, set_tournament, set_event, set_score, ...rowWithoutPlayerFields } = row;
    ({ error } = await supabase.from(NOTES_TABLE).upsert([rowWithoutPlayerFields], {
      onConflict: "id",
    }));
  }

  if (error) {
    throw error;
  }
}

export async function deleteNoteForUser(userId, noteId) {
  const { error } = await supabase
    .from(NOTES_TABLE)
    .delete()
    .eq("id", noteId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
