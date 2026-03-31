import { GENERAL_FIGHTER_NAME } from "../data/smashFighters";

const STRUCTURED_BODY_PREFIX = "__SMASHNOTE__:";
const CUSTOM_SECTION_PREFIX = "custom:";

const EMPTY_SECTIONS = {
  overview: "",
  neutral: "",
  advantage: "",
  disadvantage: "",
  stageNotes: "",
  reminders: "",
};

export const NOTE_SECTION_OPTIONS = [
  {
    key: "overview",
    label: "Overview",
    placeholder: "Game plan, key habits, primary reminder",
  },
  {
    key: "neutral",
    label: "Neutral",
    placeholder: "Spacing, buttons to respect, anti-approach plan",
  },
  {
    key: "advantage",
    label: "Advantage",
    placeholder: "Juggles, ledgetraps, kill confirms, pressure",
  },
  {
    key: "disadvantage",
    label: "Disadvantage",
    placeholder: "Landing mixups, panic options, what not to do",
  },
  {
    key: "stageNotes",
    label: "Stage Notes",
    placeholder: "Good stages, bans, platform notes",
  },
  {
    key: "reminders",
    label: "Reminders",
    placeholder: "Short tournament notes and in-set reminders",
  },
];

const NOTE_SECTION_KEYS = NOTE_SECTION_OPTIONS.map((section) => section.key);
const NOTE_SECTION_LOOKUP = NOTE_SECTION_OPTIONS.reduce((lookup, section) => {
  lookup[section.key] = section;
  return lookup;
}, {});

export function isCustomSectionKey(sectionKey) {
  return typeof sectionKey === "string" && sectionKey.startsWith(CUSTOM_SECTION_PREFIX);
}

export function getSectionLabel(sectionKey) {
  if (NOTE_SECTION_LOOKUP[sectionKey]) {
    return NOTE_SECTION_LOOKUP[sectionKey].label;
  }

  if (isCustomSectionKey(sectionKey)) {
    const customLabel = sectionKey.slice(CUSTOM_SECTION_PREFIX.length).trim();
    return customLabel || "Custom";
  }

  return sectionKey;
}

export function getSectionPlaceholder(sectionKey) {
  if (NOTE_SECTION_LOOKUP[sectionKey]) {
    return NOTE_SECTION_LOOKUP[sectionKey].placeholder;
  }

  return "Add notes for this section";
}

export function createCustomSectionKey(label, existingKeys = []) {
  const trimmedLabel = (label || "").trim();
  if (!trimmedLabel) {
    return null;
  }

  const used = new Set(existingKeys.map((key) => String(key).toLowerCase()));
  let candidate = `${CUSTOM_SECTION_PREFIX}${trimmedLabel}`;

  if (!used.has(candidate.toLowerCase())) {
    return candidate;
  }

  let suffix = 2;
  while (used.has(`${candidate} (${suffix})`.toLowerCase())) {
    suffix += 1;
  }

  return `${candidate} (${suffix})`;
}

export function getActiveSectionKeys(seed = {}) {
  const normalized = createEmptySections(seed);
  const keysWithContent = Object.keys(normalized).filter((key) => {
    const value = normalized[key];
    return typeof value === "string" && value.trim();
  });

  return keysWithContent.length ? keysWithContent : ["overview"];
}

export function createEmptySections(seed = {}) {
  const normalized = {
    overview: seed.overview || "",
    neutral: seed.neutral || "",
    advantage: seed.advantage || "",
    disadvantage: seed.disadvantage || "",
    stageNotes: seed.stageNotes || "",
    reminders: seed.reminders || "",
  };

  Object.entries(seed).forEach(([key, value]) => {
    if (NOTE_SECTION_KEYS.includes(key)) {
      return;
    }

    if (typeof value !== "string") {
      return;
    }

    normalized[key] = value;
  });

  return normalized;
}

export function buildNoteTitle(character, opponent, title = "") {
  const trimmedTitle = title.trim();

  if (trimmedTitle) {
    return trimmedTitle;
  }

  if (opponent) {
    return `${character} vs ${opponent}`;
  }

  return character === GENERAL_FIGHTER_NAME ? "Notes" : `${character} notes`;
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
  const customKeys = Object.keys(normalizedSections).filter((key) => !NOTE_SECTION_KEYS.includes(key));
  const orderedKeys = [...NOTE_SECTION_KEYS, ...customKeys];

  return orderedKeys
    .map((key) => [getSectionLabel(key), normalizedSections[key]])
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
    note.playerTag,
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
      playerTag: note.playerTag || null,
      startggPlayerId: note.startggPlayerId || null,
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
        playerTag: payload.playerTag || null,
        startggPlayerId: payload.startggPlayerId || null,
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
    playerTag: null,
    startggPlayerId: null,
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
        playerTag: normalized.playerTag || null,
        startggPlayerId: normalized.startggPlayerId || null,
      }),
  };
}