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
    updated_at: new Date(normalized.updatedAt || Date.now()).toISOString(),
  };
}

export async function fetchNotesForUser(userId) {
  const { data, error } = await supabase
    .from(NOTES_TABLE)
    .select("id, title, body, character, opponent, category, sections, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(fromDb);
}

export async function upsertNoteForUser(userId, note) {
  const row = toDb(note, userId);

  const { error } = await supabase.from(NOTES_TABLE).upsert([row], {
    onConflict: "id",
  });

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
