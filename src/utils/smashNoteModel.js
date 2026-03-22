import { GENERAL_FIGHTER_NAME } from "../data/smashFighters";

const STRUCTURED_BODY_PREFIX = "__SMASHNOTE__:";

const EMPTY_SECTIONS = {
  overview: "",
  neutral: "",
  advantage: "",
  disadvantage: "",
  stageNotes: "",
  reminders: "",
};

export function createEmptySections(seed = {}) {
  return {
    overview: seed.overview || "",
    neutral: seed.neutral || "",
    advantage: seed.advantage || "",
    disadvantage: seed.disadvantage || "",
    stageNotes: seed.stageNotes || "",
    reminders: seed.reminders || "",
  };
}

export function buildNoteTitle(character, opponent, title = "") {
  const trimmedTitle = title.trim();

  if (trimmedTitle) {
    return trimmedTitle;
  }

  if (opponent) {
    return `${character} vs ${opponent}`;
  }

  return character === GENERAL_FIGHTER_NAME ? "General Notes" : `${character} General`;
}

export function summarizeSections(sections) {
  const normalizedSections = createEmptySections(sections);
  const firstFilledSection = Object.values(normalizedSections)
    .map((value) => value.trim())
    .find(Boolean);

  return firstFilledSection || "No notes yet.";
}

export function getNoteSummaryLines(sections) {
  const normalizedSections = createEmptySections(sections);

  return [
    ["Overview", normalizedSections.overview],
    ["Neutral", normalizedSections.neutral],
    ["Advantage", normalizedSections.advantage],
    ["Disadvantage", normalizedSections.disadvantage],
    ["Stage Notes", normalizedSections.stageNotes],
    ["Reminders", normalizedSections.reminders],
  ]
    .map(([label, value]) => [label, value.trim()])
    .filter(([, value]) => Boolean(value))
    .slice(0, 3);
}

export function matchesSmashNoteSearch(note, search) {
  const query = search.trim().toLowerCase();

  if (!query) {
    return true;
  }

  const haystack = [
    note.title,
    note.character,
    note.opponent,
    ...Object.values(createEmptySections(note.sections)),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export function normalizeNote(note) {
  if (!note) {
    return null;
  }

  if (note.sections || note.character || note.opponent || note.category) {
    const normalizedSections = createEmptySections(note.sections);
    const character = note.character || GENERAL_FIGHTER_NAME;
    const opponent = note.opponent || null;

    return {
      ...note,
      title: buildNoteTitle(character, opponent, note.title || ""),
      body: summarizeSections(normalizedSections),
      character,
      opponent,
      category: note.category || (opponent ? "matchup" : "general"),
      sections: normalizedSections,
    };
  }

  const rawBody = note.body || "";
  const updatedAt = note.updatedAt || Date.now();

  if (rawBody.startsWith(STRUCTURED_BODY_PREFIX)) {
    try {
      const payload = JSON.parse(rawBody.slice(STRUCTURED_BODY_PREFIX.length));
      const normalizedSections = createEmptySections(payload.sections);
      const character = payload.character || GENERAL_FIGHTER_NAME;
      const opponent = payload.opponent || null;

      return {
        id: note.id,
        title: buildNoteTitle(character, opponent, payload.title || note.title || ""),
        body: summarizeSections(normalizedSections),
        updatedAt,
        character,
        opponent,
        category: payload.category || (opponent ? "matchup" : "general"),
        sections: normalizedSections,
      };
    } catch {
      // Fall back to legacy note parsing if the structured payload is invalid.
    }
  }

  const legacySections = createEmptySections({ overview: rawBody });

  return {
    id: note.id,
    title: buildNoteTitle(GENERAL_FIGHTER_NAME, null, note.title || ""),
    body: summarizeSections(legacySections),
    updatedAt,
    character: GENERAL_FIGHTER_NAME,
    opponent: null,
    category: "general",
    sections: legacySections,
  };
}

export function serializeNoteForStorage(note) {
  const normalized = normalizeNote(note);

  return {
    ...normalized,
    title: buildNoteTitle(normalized.character, normalized.opponent, normalized.title || ""),
    body:
      STRUCTURED_BODY_PREFIX +
      JSON.stringify({
        title: normalized.title,
        character: normalized.character,
        opponent: normalized.opponent,
        category: normalized.category,
        sections: createEmptySections(normalized.sections),
      }),
  };
}