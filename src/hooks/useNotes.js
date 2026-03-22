import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { GENERAL_FIGHTER_NAME, SMASH_FIGHTERS, getRosterFighters } from "../data/smashFighters";
import { deleteNoteForUser, fetchNotesForUser, upsertNoteForUser } from "../utils/cloudNotes";
import { buildId, isRateLimitError } from "../utils/appHelpers";
import {
  buildNoteTitle,
  createEmptySections,
  matchesSmashNoteSearch,
  normalizeNote,
} from "../utils/smashNoteModel";
import { loadNotes, saveNotes } from "../utils/storage";

export function useNotes({ userId, showStatusPopup, showServerOverloadedPopup }) {
  const [notes, setNotes] = useState([]);
  const [fighterSearch, setFighterSearch] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [opponentSearch, setOpponentSearch] = useState("");
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [activeTab, setActiveTab] = useState("general");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [titleInput, setTitleInput] = useState("");
  const [editorSections, setEditorSections] = useState(createEmptySections());
  const [draftContext, setDraftContext] = useState({
    character: GENERAL_FIGHTER_NAME,
    opponent: null,
    category: "general",
  });
  const [isNotesLoading, setIsNotesLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setNotes([]);
      setFighterSearch("");
      setNoteSearch("");
      setOpponentSearch("");
      setSelectedCharacter(null);
      setSelectedOpponent(null);
      setActiveTab("general");
      return;
    }

    let isMounted = true;

    async function hydrateNotesForUser() {
      setIsNotesLoading(true);

      try {
        const cached = await loadNotes(userId);
        if (isMounted && Array.isArray(cached)) {
          setNotes(cached);
        }

        const remote = await fetchNotesForUser(userId);
        if (isMounted) {
          setNotes(remote);
        }

        await saveNotes(remote, userId);
      } catch (error) {
        if (isRateLimitError(error)) {
          showServerOverloadedPopup();
          return;
        }

        showStatusPopup(
          "error",
          "Sync issue",
          "Could not fully sync notes. Showing cached data."
        );
      } finally {
        if (isMounted) {
          setIsNotesLoading(false);
        }
      }
    }

    hydrateNotesForUser();

    return () => {
      isMounted = false;
    };
  }, [userId, showServerOverloadedPopup, showStatusPopup]);

  const visibleFighters = useMemo(() => {
    const query = fighterSearch.trim().toLowerCase();

    if (!query) {
      return SMASH_FIGHTERS;
    }

    return SMASH_FIGHTERS.filter((fighter) => fighter.name.toLowerCase().includes(query));
  }, [fighterSearch]);

  const availableOpponents = useMemo(
    () => getRosterFighters().filter((fighter) => fighter.name !== selectedCharacter),
    [selectedCharacter]
  );

  const visibleOpponents = useMemo(() => {
    const query = opponentSearch.trim().toLowerCase();

    if (!query) {
      return availableOpponents;
    }

    return availableOpponents.filter((fighter) => fighter.name.toLowerCase().includes(query));
  }, [availableOpponents, opponentSearch]);

  const characterGeneralNotes = useMemo(() => {
    if (!selectedCharacter) {
      return [];
    }

    return notes.filter(
      (note) => note.character === selectedCharacter && !note.opponent && note.category === "general"
    );
  }, [notes, selectedCharacter]);

  const selectedMatchupNotes = useMemo(() => {
    if (!selectedCharacter || !selectedOpponent) {
      return [];
    }

    return notes.filter(
      (note) =>
        note.character === selectedCharacter &&
        note.opponent === selectedOpponent &&
        note.category === "matchup"
    );
  }, [notes, selectedCharacter, selectedOpponent]);

  const displayedNotes = useMemo(() => {
    const sourceNotes =
      activeTab === "matchups" && selectedCharacter !== GENERAL_FIGHTER_NAME
        ? selectedMatchupNotes
        : characterGeneralNotes;

    return sourceNotes.filter((note) => matchesSmashNoteSearch(note, noteSearch));
  }, [activeTab, characterGeneralNotes, noteSearch, selectedCharacter, selectedMatchupNotes]);

  const fighterNoteCounts = useMemo(() => {
    return notes.reduce((counts, note) => {
      const currentCount = counts[note.character] || 0;
      counts[note.character] = currentCount + 1;
      return counts;
    }, {});
  }, [notes]);

  const canCreateMatchupNote = Boolean(
    selectedCharacter && selectedCharacter !== GENERAL_FIGHTER_NAME && selectedOpponent
  );

  const editorContextLabel = useMemo(() => {
    if (draftContext.opponent) {
      return `${draftContext.character} vs ${draftContext.opponent}`;
    }

    return draftContext.character === GENERAL_FIGHTER_NAME
      ? "General notebook"
      : `${draftContext.character} general notes`;
  }, [draftContext]);

  function resetEditor() {
    setIsEditorOpen(false);
    setDraftId(null);
    setTitleInput("");
    setEditorSections(createEmptySections());
    setDraftContext({
      character: selectedCharacter || GENERAL_FIGHTER_NAME,
      opponent: null,
      category: "general",
    });
  }

  function selectCharacter(character) {
    setSelectedCharacter(character);
    setSelectedOpponent(null);
    setActiveTab(character === GENERAL_FIGHTER_NAME ? "general" : "general");
    setNoteSearch("");
    setOpponentSearch("");
  }

  function goBackToRoster() {
    setSelectedCharacter(null);
    setSelectedOpponent(null);
    setActiveTab("general");
    setNoteSearch("");
    setOpponentSearch("");
  }

  function selectTab(tab) {
    setActiveTab(tab);
    setNoteSearch("");
    if (tab === "general") {
      setSelectedOpponent(null);
    }
  }

  function selectOpponent(opponent) {
    setSelectedOpponent(opponent);
    setNoteSearch("");
  }

  function updateSection(sectionKey, value) {
    setEditorSections((current) => ({
      ...current,
      [sectionKey]: value,
    }));
  }

  function openNewEditor() {
    if (!selectedCharacter) {
      return;
    }

    if (activeTab === "matchups" && !canCreateMatchupNote) {
      showStatusPopup("error", "Pick an opponent", "Choose a matchup before creating notes.");
      return;
    }

    setDraftId(null);
    setTitleInput("");
    setEditorSections(createEmptySections());
    setDraftContext({
      character: selectedCharacter,
      opponent: activeTab === "matchups" ? selectedOpponent : null,
      category: activeTab === "matchups" ? "matchup" : "general",
    });
    setIsEditorOpen(true);
  }

  function openEditEditor(note) {
    setDraftId(note.id);
    setTitleInput(note.title || "");
    setEditorSections(createEmptySections(note.sections));
    setDraftContext({
      character: note.character,
      opponent: note.opponent || null,
      category: note.category || (note.opponent ? "matchup" : "general"),
    });
    setIsEditorOpen(true);
  }

  function closeEditor() {
    resetEditor();
  }

  async function persistAndSync(nextNotes, changedNote, deletedNoteId) {
    if (!userId) {
      return;
    }

    await saveNotes(nextNotes, userId);

    if (changedNote) {
      await upsertNoteForUser(userId, changedNote);
    }

    if (deletedNoteId) {
      await deleteNoteForUser(userId, deletedNoteId);
    }
  }

  function saveDraft() {
    const safeTitle = titleInput.trim();
    const nextSections = createEmptySections(editorSections);
    const hasContent = Object.values(nextSections).some((value) => value.trim());

    if (!safeTitle && !hasContent) {
      showStatusPopup("error", "Empty note", "Add at least one section before saving.");
      return;
    }

    const now = Date.now();
    let upsertedNote;
    let nextNotes;

    if (draftId) {
      setNotes((current) => {
        nextNotes = current
          .map((note) => {
            if (note.id !== draftId) {
              return note;
            }

            upsertedNote = normalizeNote({
              ...note,
              title: buildNoteTitle(draftContext.character, draftContext.opponent, safeTitle),
              updatedAt: now,
              character: draftContext.character,
              opponent: draftContext.opponent,
              category: draftContext.category,
              sections: nextSections,
            });
            return upsertedNote;
          })
          .sort((a, b) => b.updatedAt - a.updatedAt);

        return nextNotes;
      });
    } else {
      upsertedNote = normalizeNote({
        id: buildId(),
        title: buildNoteTitle(draftContext.character, draftContext.opponent, safeTitle),
        updatedAt: now,
        character: draftContext.character,
        opponent: draftContext.opponent,
        category: draftContext.category,
        sections: nextSections,
      });

      setNotes((current) => {
        nextNotes = [upsertedNote, ...current].sort((a, b) => b.updatedAt - a.updatedAt);
        return nextNotes;
      });
    }

    resetEditor();

    if (nextNotes && upsertedNote) {
      persistAndSync(nextNotes, upsertedNote, null).catch((error) => {
        if (isRateLimitError(error)) {
          showServerOverloadedPopup();
          return;
        }

        showStatusPopup(
          "error",
          "Save failed",
          "Your note was updated locally but cloud sync failed."
        );
      });
    }
  }

  function removeNote(noteId) {
    Alert.alert("Delete note", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          let nextNotes;
          setNotes((current) => {
            nextNotes = current.filter((note) => note.id !== noteId);
            return nextNotes;
          });

          if (nextNotes) {
            persistAndSync(nextNotes, null, noteId).catch((error) => {
              if (isRateLimitError(error)) {
                showServerOverloadedPopup();
                return;
              }

              showStatusPopup(
                "error",
                "Delete sync failed",
                "Note was removed locally but cloud sync failed."
              );
            });
          }
        },
      },
    ]);
  }

  return {
    fighterSearch,
    setFighterSearch,
    noteSearch,
    setNoteSearch,
    opponentSearch,
    setOpponentSearch,
    visibleFighters,
    visibleOpponents,
    fighterNoteCounts,
    selectedCharacter,
    selectedOpponent,
    activeTab,
    selectCharacter,
    goBackToRoster,
    selectTab,
    selectOpponent,
    displayedNotes,
    canCreateMatchupNote,
    editorContextLabel,
    isNotesLoading,
    isEditorOpen,
    draftId,
    titleInput,
    setTitleInput,
    editorSections,
    updateSection,
    openNewEditor,
    openEditEditor,
    closeEditor,
    saveDraft,
    removeNote,
  };
}