import { supabase } from "../lib/supabase";
import { normalizeNote } from "./smashNoteModel";

const NOTES_TABLE = "notes";

function fromDb(row) {
  const parsed = new Date(row.updated_at).getTime();

  // Extract extended fields from serialized body as fallback when DB columns don't exist
  let bodyExtra = {};
  const bodyStr = row.body || "";
  if (bodyStr.startsWith("__SMASHNOTE__:")) {
    try {
      bodyExtra = JSON.parse(bodyStr.slice("__SMASHNOTE__:".length));
    } catch (e) { /* ignore */ }
  }

  const normalized = normalizeNote({
    id: row.id,
    title: row.title || "",
    body: row.body || "",
    character: row.character || undefined,
    opponent: row.opponent || undefined,
    category: row.category || undefined,
    sections: row.sections || undefined,
    playerTag: row.player_tag || bodyExtra.playerTag || undefined,
    startggPlayerId: row.startgg_player_id || bodyExtra.startggPlayerId || undefined,
    setId: row.set_id || bodyExtra.setId || undefined,
    setTournament: row.set_tournament || bodyExtra.setTournament || undefined,
    setEvent: row.set_event || bodyExtra.setEvent || undefined,
    setScore: row.set_score || bodyExtra.setScore || undefined,
    vodUrl: row.vod_url || bodyExtra.vodUrl || undefined,
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
    vod_url: normalized.vodUrl || null,
    updated_at: new Date(normalized.updatedAt || Date.now()).toISOString(),
  };
}

export async function fetchNotesForUser(userId) {
  // Try with new player columns first; fall back to old schema if they don't exist yet
  let { data, error } = await supabase
    .from(NOTES_TABLE)
    .select("id, title, body, character, opponent, category, sections, player_tag, startgg_player_id, set_id, set_tournament, set_event, set_score, vod_url, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error && /player_tag|startgg_player_id|set_id|set_tournament|set_event|set_score|vod_url/.test(error.message || error.code || "")) {
    console.warn("[cloudNotes] Full SELECT failed, falling back to base columns. Error:", error.message || error.code);
    ({ data, error } = await supabase
      .from(NOTES_TABLE)
      .select("id, title, body, character, opponent, category, sections, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }));
  }

  if (error) {
    throw error;
  }

  // Log which columns are missing from the DB response
  if (data && data.length > 0) {
    const sample = data[0];
    const expectedColumns = ["player_tag", "startgg_player_id", "set_id", "set_tournament", "set_event", "set_score", "vod_url"];
    const missing = expectedColumns.filter((col) => !(col in sample));
    if (missing.length > 0) {
      console.warn(`[cloudNotes] Missing DB columns (using body fallback): ${missing.join(", ")}. Run migrations to fix.`);
    }
  }

  return (data || []).map(fromDb);
}

export async function upsertNoteForUser(userId, note) {
  const row = toDb(note, userId);

  let { error } = await supabase.from(NOTES_TABLE).upsert([row], {
    onConflict: "id",
  });

  // If upsert fails due to missing columns, retry without the new fields
  if (error && /player_tag|startgg_player_id|set_id|set_tournament|set_event|set_score|vod_url/.test(error.message || error.code || "")) {
    console.warn("[cloudNotes] Upsert failed with new columns, retrying without. Error:", error.message || error.code);
    const { player_tag, startgg_player_id, set_id, set_tournament, set_event, set_score, vod_url, ...rowWithoutPlayerFields } = row;
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
