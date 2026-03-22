import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeNote } from "./smashNoteModel";

const NOTES_KEY_PREFIX = "@smashnotes:notes";

function buildNotesKey(userId) {
  return `${NOTES_KEY_PREFIX}:${userId || "local"}`;
}

export async function loadNotes(userId) {
  const json = await AsyncStorage.getItem(buildNotesKey(userId));

  if (!json) {
    return [];
  }

  const parsed = JSON.parse(json);
  return Array.isArray(parsed) ? parsed.map(normalizeNote).filter(Boolean) : [];
}

export async function saveNotes(notes, userId) {
  const normalizedNotes = Array.isArray(notes) ? notes.map(normalizeNote).filter(Boolean) : [];
  await AsyncStorage.setItem(buildNotesKey(userId), JSON.stringify(normalizedNotes));
}
