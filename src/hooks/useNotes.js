import { useEffect, useMemo, useState } from "react";
import { Alert, Platform } from "react-native";
import { GENERAL_FIGHTER_NAME, SMASH_FIGHTERS, getRosterFighters } from "../data/smashFighters";
import { deleteNoteForUser, fetchNotesForUser, upsertNoteForUser } from "../utils/cloudNotes";
import {
  fetchMainCharacterForUser,
  upsertMainCharacterForUser,
} from "../utils/cloudUserProfile";
import { buildId, isRateLimitError } from "../utils/appHelpers";
import {
  buildNoteTitle,
  createCustomSectionKey,
  createEmptySections,
  getActiveSectionKeys,
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
  const [userMainCharacter, setUserMainCharacter] = useState(null);
  const [activeTab, setActiveTab] = useState("general");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [titleInput, setTitleInput] = useState("");
  const [editorSections, setEditorSections] = useState(createEmptySections());
  const [editorSectionKeys, setEditorSectionKeys] = useState(["overview"]);
  const [draftContext, setDraftContext] = useState({
    character: GENERAL_FIGHTER_NAME,
    opponent: null,
    category: "general",
  });
  const [draftPlayerTag, setDraftPlayerTag] = useState("");
  const [draftVodUrl, setDraftVodUrl] = useState("");
  const [isNotesLoading, setIsNotesLoading] = useState(false);
  const [isMainSaving, setIsMainSaving] = useState(false);

  useEffect(() => {
    if (!userId) {
      setNotes([]);
      setFighterSearch("");
      setNoteSearch("");
      setOpponentSearch("");
      setSelectedCharacter(null);
      setSelectedOpponent(null);
      setUserMainCharacter(null);
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

        const [remote, mainCharacter] = await Promise.all([
          fetchNotesForUser(userId),
          fetchMainCharacterForUser(userId),
        ]);

        if (isMounted) {
          setNotes(remote);
          setUserMainCharacter(mainCharacter);
          // Keep landing on roster at startup; main remains available for highlighting.
          setSelectedCharacter((current) => current || null);
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

  const recentNotes = useMemo(() => {
    return [...notes]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 8);
  }, [notes]);

  const canCreateMatchupNote = Boolean(
    selectedCharacter && selectedCharacter !== GENERAL_FIGHTER_NAME && selectedOpponent
  );

  const editorContextLabel = useMemo(() => {
    if (draftContext.opponent) {
      return `${draftContext.character} vs ${draftContext.opponent}`;
    }

    return draftContext.character === GENERAL_FIGHTER_NAME
      ? "Notebook"
       : `${draftContext.character}`;
  }, [draftContext]);

  function resetEditor() {
    setIsEditorOpen(false);
    setDraftId(null);
    setTitleInput("");
    setDraftPlayerTag("");
    setDraftVodUrl("");
    setEditorSections(createEmptySections());
    setEditorSectionKeys(["overview"]);
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

  async function setMainCharacter(character) {
    if (!userId) {
      return;
    }

    const normalizedMain = !character || character === GENERAL_FIGHTER_NAME ? null : character;

    if (normalizedMain === userMainCharacter) {
      return;
    }

    const previousMain = userMainCharacter;
    setUserMainCharacter(normalizedMain);
    setIsMainSaving(true);

    try {
      await upsertMainCharacterForUser(userId, normalizedMain);
    } catch (error) {
      setUserMainCharacter(previousMain);

      if (isRateLimitError(error)) {
        showServerOverloadedPopup();
        return;
      }

      showStatusPopup(
        "error",
        "Main update failed",
        "Could not save your selected main to the cloud."
      );
    } finally {
      setIsMainSaving(false);
    }
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
    setEditorSectionKeys((current) => (current.includes(sectionKey) ? current : [...current, sectionKey]));
    setEditorSections((current) => ({
      ...current,
      [sectionKey]: value,
    }));
  }

  function setDraftCharacter(character) {
    const normalizedCharacter = character || GENERAL_FIGHTER_NAME;

    setDraftContext((current) => {
      const shouldResetMatchup =
        normalizedCharacter === GENERAL_FIGHTER_NAME || current.opponent === normalizedCharacter;

      return {
        ...current,
        character: normalizedCharacter,
        opponent: shouldResetMatchup ? null : current.opponent,
        category: shouldResetMatchup ? "general" : current.category,
      };
    });
  }

  function addEditorSection(sectionKey) {
    setEditorSectionKeys((current) => (current.includes(sectionKey) ? current : [...current, sectionKey]));
  }

  function addCustomEditorSection(label) {
    const customSectionKey = createCustomSectionKey(label, editorSectionKeys);
    if (!customSectionKey) {
      return false;
    }

    setEditorSectionKeys((current) => (current.includes(customSectionKey) ? current : [...current, customSectionKey]));
    setEditorSections((current) => ({
      ...current,
      [customSectionKey]: current[customSectionKey] || "",
    }));

    return true;
  }

  function removeEditorSection(sectionKey) {
    setEditorSectionKeys((current) => {
      if (current.length <= 1) {
        return current;
      }

      return current.filter((key) => key !== sectionKey);
    });

    setEditorSections((current) => ({
      ...current,
      [sectionKey]: "",
    }));
  }

  function moveEditorSection(sectionKey, direction) {
    setEditorSectionKeys((current) => {
      const currentIndex = current.indexOf(sectionKey);
      if (currentIndex < 0) {
        return current;
      }

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const reordered = [...current];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      return reordered;
    });
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
    setDraftPlayerTag("");
    setDraftVodUrl("");
    setEditorSections(createEmptySections());
    setEditorSectionKeys(["overview"]);
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
    setDraftPlayerTag(note.playerTag || "");
    setDraftVodUrl(note.vodUrl || "");
    setEditorSections(createEmptySections(note.sections));
    setEditorSectionKeys(getActiveSectionKeys(note.sections));
    setDraftContext({
      character: note.character,
      opponent: note.opponent || null,
      category: note.category || (note.opponent ? "matchup" : "general"),
    });
    setIsEditorOpen(true);
  }

  function openQuickEditorForCharacter(character, extraData) {
    const nextCharacter = character || GENERAL_FIGHTER_NAME;
    const opponent = extraData?.opponent || null;

    setDraftId(null);
    setTitleInput("");
    setDraftPlayerTag(extraData?.playerTag || "");
    setDraftVodUrl(extraData?.vodUrl || "");
    setEditorSections(createEmptySections());
    setEditorSectionKeys(["overview"]);
    setDraftContext({
      character: nextCharacter,
      opponent,
      category: opponent ? "matchup" : "general",
      playerTag: extraData?.playerTag || null,
      startggPlayerId: extraData?.startggPlayerId || null,
      setId: extraData?.setId || null,
      setTournament: extraData?.setTournament || null,
      setEvent: extraData?.setEvent || null,
      setScore: extraData?.setScore || null,
      vodUrl: extraData?.vodUrl || null,
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
              playerTag: draftPlayerTag || draftContext.playerTag || note.playerTag || null,
              startggPlayerId: draftContext.startggPlayerId || note.startggPlayerId || null,
              setId: draftContext.setId || note.setId || null,
              setTournament: draftContext.setTournament || note.setTournament || null,
              setEvent: draftContext.setEvent || note.setEvent || null,
              setScore: draftContext.setScore || note.setScore || null,
              vodUrl: draftVodUrl || draftContext.vodUrl || note.vodUrl || null,
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
        playerTag: draftPlayerTag || draftContext.playerTag || null,
        startggPlayerId: draftContext.startggPlayerId || null,
        setId: draftContext.setId || null,
        setTournament: draftContext.setTournament || null,
        setEvent: draftContext.setEvent || null,
        setScore: draftContext.setScore || null,
        vodUrl: draftVodUrl || draftContext.vodUrl || null,
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

  function saveInlineEdit(noteId, updatedTitle, updatedSections) {
    const nextSections = createEmptySections(updatedSections);
    const now = Date.now();
    let upsertedNote;
    let nextNotes;

    setNotes((current) => {
      nextNotes = current
        .map((note) => {
          if (note.id !== noteId) {
            return note;
          }

          upsertedNote = normalizeNote({
            ...note,
            title: buildNoteTitle(note.character, note.opponent, updatedTitle),
            updatedAt: now,
            sections: nextSections,
          });
          return upsertedNote;
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);

      return nextNotes;
    });

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

  function createNoteSilent(noteData) {
    const now = Date.now();
    const upsertedNote = normalizeNote({
      id: buildId(),
      title: buildNoteTitle(
        noteData.character || GENERAL_FIGHTER_NAME,
        noteData.opponent || null,
        noteData.title || ""
      ),
      updatedAt: now,
      character: noteData.character || GENERAL_FIGHTER_NAME,
      opponent: noteData.opponent || null,
      category: noteData.opponent ? "matchup" : "general",
      sections: createEmptySections(noteData.sections || { overview: noteData.content || "" }),
      playerTag: noteData.playerTag || null,
      startggPlayerId: noteData.startggPlayerId || null,
      setId: noteData.setId || null,
      setTournament: noteData.setTournament || null,
      setEvent: noteData.setEvent || null,
      setScore: noteData.setScore || null,
      vodUrl: noteData.vodUrl || null,
    });

    let nextNotes;
    setNotes((current) => {
      nextNotes = [upsertedNote, ...current].sort((a, b) => b.updatedAt - a.updatedAt);
      return nextNotes;
    });

    if (nextNotes && upsertedNote) {
      persistAndSync(nextNotes, upsertedNote, null).catch((error) => {
        if (isRateLimitError(error)) {
          showServerOverloadedPopup();
          return;
        }
        showStatusPopup(
          "error",
          "Save failed",
          "Your note was saved locally but cloud sync failed."
        );
      });
    }

    showStatusPopup("success", "Note saved", upsertedNote.title);
  }

  function removeNote(noteId) {
    const executeDelete = () => {
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
    };

    if (Platform.OS === "web" && typeof globalThis.confirm === "function") {
      const shouldDelete = globalThis.confirm("Delete note? This action cannot be undone.");
      if (shouldDelete) {
        executeDelete();
      }
      return;
    }

    Alert.alert("Delete note", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: executeDelete,
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
    notes,
    recentNotes,
    selectedCharacter,
    selectedOpponent,
    userMainCharacter,
    isMainSaving,
    activeTab,
    selectCharacter,
    setMainCharacter,
    goBackToRoster,
    selectTab,
    selectOpponent,
    displayedNotes,
    canCreateMatchupNote,
    editorContextLabel,
    draftCharacter: draftContext.character,
    draftSetInfo: draftContext.setTournament ? {
      setId: draftContext.setId,
      setTournament: draftContext.setTournament,
      setEvent: draftContext.setEvent,
      setScore: draftContext.setScore,
    } : null,
    isNotesLoading,
    isEditorOpen,
    draftId,
    titleInput,
    setTitleInput,
    draftPlayerTag,
    setDraftPlayerTag,
    draftVodUrl,
    setDraftVodUrl,
    editorSections,
    editorSectionKeys,
    updateSection,
    setDraftCharacter,
    addEditorSection,
    addCustomEditorSection,
    removeEditorSection,
    moveEditorSection,
    openNewEditor,
    openQuickEditorForCharacter,
    createNoteSilent,
    openEditEditor,
    closeEditor,
    saveDraft,
    removeNote,
    saveInlineEdit,
  };
}