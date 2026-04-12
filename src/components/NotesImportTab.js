import React, { useState, useMemo } from "react";
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, StyleSheet, useWindowDimensions } from "react-native";
import { getRosterFighters, getFighterIcon } from "../data/smashFighters";
import { NOTE_SECTION_OPTIONS } from "../utils/smashNoteModel";

const SECTION_LABELS = NOTE_SECTION_OPTIONS.reduce((acc, s) => {
  acc[s.key] = s.label;
  return acc;
}, {});

function getApiUrl(path) {
  const backendHost =
    typeof window !== "undefined" && window.location && window.location.hostname
      ? window.location.hostname
      : "localhost";
  const isDeployed =
    backendHost &&
    backendHost !== "localhost" &&
    backendHost !== "127.0.0.1" &&
    !/^\d+\.\d+\.\d+\.\d+$/.test(backendHost);
  return isDeployed
    ? `${window.location.origin}${path}`
    : `http://${backendHost}:3001${path}`;
}

export default function NotesImportTab({ allNotes, onCreateNoteSilent, userMainCharacter }) {
  const [step, setStep] = useState("input"); // "input" | "loading" | "preview"
  const [rawText, setRawText] = useState("");
  const [myCharacter, setMyCharacter] = useState(userMainCharacter || "");
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [charSearch, setCharSearch] = useState("");
  const [results, setResults] = useState(null); // { notes: [...] }
  const [error, setError] = useState("");
  const [expandedOpponents, setExpandedOpponents] = useState({});
  const [savedOpponents, setSavedOpponents] = useState({});
  const [saving, setSaving] = useState(false);
  const { width } = useWindowDimensions();

  const roster = useMemo(() => getRosterFighters(), []);
  const filteredRoster = useMemo(() => {
    if (!charSearch.trim()) return roster;
    const q = charSearch.toLowerCase();
    return roster.filter((f) => f.name.toLowerCase().includes(q));
  }, [roster, charSearch]);

  async function handleAnalyze() {
    if (!rawText.trim()) return;
    if (!myCharacter) {
      setError("Please select your character first.");
      return;
    }
    setError("");
    setStep("loading");

    try {
      const url = getApiUrl("/api/claude-categorize");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText, myCharacter }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to categorize notes.");
        setStep("input");
        return;
      }

      if (!data.notes || !Array.isArray(data.notes) || !data.notes.length) {
        setError("No matchup notes could be identified from the text. Try adding more context or channel names like #fox.");
        setStep("input");
        return;
      }

      setResults(data);
      // Expand all opponents by default
      const expanded = {};
      data.notes.forEach((n) => { expanded[n.opponent] = true; });
      setExpandedOpponents(expanded);
      setSavedOpponents({});
      setStep("preview");
    } catch (err) {
      setError(err.message || "Network error. Is the server running?");
      setStep("input");
    }
  }

  function toggleOpponent(opponent) {
    setExpandedOpponents((prev) => ({ ...prev, [opponent]: !prev[opponent] }));
  }

  async function saveNote(noteData) {
    if (savedOpponents[noteData.opponent]) return;
    setSaving(true);
    try {
      // Build sections object
      const sections = {};
      Object.entries(noteData.sections).forEach(([key, value]) => {
        sections[key] = value || "";
      });

      await onCreateNoteSilent({
        character: myCharacter,
        opponent: noteData.opponent,
        category: "matchup",
        title: `${myCharacter} vs ${noteData.opponent}`,
        sections,
      });

      setSavedOpponents((prev) => ({ ...prev, [noteData.opponent]: true }));
    } catch (err) {
      setError(`Failed to save ${noteData.opponent} notes: ${err.message}`);
    }
    setSaving(false);
  }

  async function saveAll() {
    if (!results?.notes) return;
    setSaving(true);
    for (const noteData of results.notes) {
      if (!savedOpponents[noteData.opponent]) {
        await saveNote(noteData);
      }
    }
    setSaving(false);
  }

  function handleStartOver() {
    setStep("input");
    setResults(null);
    setError("");
    setExpandedOpponents({});
    setSavedOpponents({});
  }

  const notesArray = Array.isArray(results?.notes) ? results.notes : [];
  const allSaved = notesArray.length > 0 && notesArray.every((n) => savedOpponents[n.opponent]);

  // Character picker
  if (showCharPicker) {
    return (
      <View style={styles.container}>
        <View style={styles.pickerHeader}>
          <Pressable style={styles.pickerBackBtn} onPress={() => { setShowCharPicker(false); setCharSearch(""); }}>
            <Text style={styles.pickerBackLabel}>{"<- Back"}</Text>
          </Pressable>
          <Text style={styles.pickerTitle}>Select Your Character</Text>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search fighters..."
          placeholderTextColor="#637083"
          value={charSearch}
          onChangeText={setCharSearch}
        />
        <ScrollView style={styles.rosterScroll} contentContainerStyle={styles.rosterGrid}>
          {filteredRoster.map((fighter) => (
            <Pressable
              key={fighter.name}
              style={[styles.fighterTile, myCharacter === fighter.name && styles.fighterTileActive]}
              onPress={() => {
                setMyCharacter(fighter.name);
                setShowCharPicker(false);
                setCharSearch("");
              }}
            >
              <Text style={[styles.fighterName, myCharacter === fighter.name && styles.fighterNameActive]}>
                {fighter.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  // Loading state
  if (step === "loading") {
    return (
      <View style={styles.containerCenter}>
        <ActivityIndicator size="large" color="#FF6B3D" />
        <Text style={styles.loadingText}>Analyzing and categorizing notes...</Text>
        <Text style={styles.loadingSubtext}>This may take a moment for large texts</Text>
      </View>
    );
  }

  // Preview state
  if (step === "preview" && results) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.containerPad}>
        <View style={styles.previewHeader}>
          <View>
            <Text style={styles.heading}>Categorized Notes</Text>
            <Text style={styles.subheading}>
              {notesArray.length} matchup{notesArray.length !== 1 ? "s" : ""} found for {myCharacter}
            </Text>
          </View>
          <View style={styles.previewActions}>
            {!allSaved && (
              <Pressable style={styles.saveAllBtn} onPress={saveAll} disabled={saving}>
                <Text style={styles.saveAllLabel}>{saving ? "Saving..." : "Save All"}</Text>
              </Pressable>
            )}
            <Pressable style={styles.startOverBtn} onPress={handleStartOver}>
              <Text style={styles.startOverLabel}>Start Over</Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {notesArray.map((noteData) => {
          const isExpanded = expandedOpponents[noteData.opponent];
          const isSaved = savedOpponents[noteData.opponent];
          const filledSections = Object.entries(noteData.sections).filter(
            ([, val]) => val && val.trim()
          );

          return (
            <View key={noteData.opponent} style={styles.opponentCard}>
              <Pressable
                style={styles.opponentHeader}
                onPress={() => toggleOpponent(noteData.opponent)}
              >
                <View style={styles.opponentTitleRow}>
                  <Text style={styles.opponentName}>
                    vs {noteData.opponent}
                  </Text>
                  <Text style={styles.sectionCount}>
                    {filledSections.length} section{filledSections.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={styles.opponentActions}>
                  {isSaved ? (
                    <Text style={styles.savedBadge}>Saved</Text>
                  ) : (
                    <Pressable
                      style={styles.saveBtn}
                      onPress={(e) => { e.stopPropagation(); saveNote(noteData); }}
                      disabled={saving}
                    >
                      <Text style={styles.saveBtnLabel}>Save</Text>
                    </Pressable>
                  )}
                  <Text style={styles.expandIcon}>{isExpanded ? "v" : ">"}</Text>
                </View>
              </Pressable>

              {isExpanded && (
                <View style={styles.sectionsContainer}>
                  {filledSections.map(([sectionKey, content]) => (
                    <View key={sectionKey} style={styles.sectionBlock}>
                      <Text style={styles.sectionLabel}>
                        {SECTION_LABELS[sectionKey] || sectionKey}
                      </Text>
                      <Text style={styles.sectionContent}>{content}</Text>
                    </View>
                  ))}
                  {filledSections.length === 0 && (
                    <Text style={styles.emptyText}>No notes categorized for this matchup.</Text>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  }

  // Input state (default)
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.containerPad}>
      <Text style={styles.heading}>AI Notes Import</Text>
      <Text style={styles.subheading}>
        Paste raw text from Discord, notebooks, or any source. The AI will identify opponent matchups and categorize notes into the proper sections.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Character selector */}
      <Text style={styles.fieldLabel}>Your Character</Text>
      <Pressable style={styles.charSelector} onPress={() => setShowCharPicker(true)}>
        <Text style={myCharacter ? styles.charSelectorText : styles.charSelectorPlaceholder}>
          {myCharacter || "Select your character..."}
        </Text>
      </Pressable>

      {/* Text input */}
      <Text style={styles.fieldLabel}>Raw Notes Text</Text>
      <TextInput
        style={[styles.textArea, { minHeight: Math.min(width * 0.5, 300) }]}
        multiline
        placeholder={"Paste your notes here...\n\nExample:\nThis is the start of the #fox channel.\nTrueDingus - 7/22/2022\n- Only bair and fair 12 as rising aerial\n..."}
        placeholderTextColor="#637083"
        value={rawText}
        onChangeText={setRawText}
        textAlignVertical="top"
      />

      <Pressable
        style={[styles.analyzeBtn, (!rawText.trim() || !myCharacter) && styles.analyzeBtnDisabled]}
        onPress={handleAnalyze}
        disabled={!rawText.trim() || !myCharacter}
      >
        <Text style={styles.analyzeBtnLabel}>Analyze & Categorize</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F1420",
  },
  containerPad: {
    padding: 20,
    paddingBottom: 40,
  },
  containerCenter: {
    flex: 1,
    backgroundColor: "#0F1420",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  heading: {
    color: "#F4F7FF",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  subheading: {
    color: "#8B95A8",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  fieldLabel: {
    color: "#C0C8D8",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 8,
  },
  error: {
    color: "#F87171",
    fontSize: 13,
    marginBottom: 12,
    padding: 10,
    backgroundColor: "rgba(248,113,113,0.1)",
    borderRadius: 8,
  },

  // Character selector
  charSelector: {
    backgroundColor: "#1A2030",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A3040",
    padding: 14,
    marginBottom: 16,
  },
  charSelectorText: {
    color: "#F4F7FF",
    fontSize: 15,
  },
  charSelectorPlaceholder: {
    color: "#637083",
    fontSize: 15,
  },

  // Text area
  textArea: {
    backgroundColor: "#1A2030",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A3040",
    padding: 14,
    color: "#F4F7FF",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },

  // Analyze button
  analyzeBtn: {
    backgroundColor: "#FF6B3D",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },
  analyzeBtnDisabled: {
    opacity: 0.4,
  },
  analyzeBtnLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // Loading
  loadingText: {
    color: "#F4F7FF",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 20,
  },
  loadingSubtext: {
    color: "#637083",
    fontSize: 13,
    marginTop: 6,
  },

  // Character picker
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1A2030",
  },
  pickerBackBtn: {
    marginRight: 12,
  },
  pickerBackLabel: {
    color: "#FF6B3D",
    fontSize: 15,
    fontWeight: "600",
  },
  pickerTitle: {
    color: "#F4F7FF",
    fontSize: 18,
    fontWeight: "700",
  },
  searchInput: {
    backgroundColor: "#1A2030",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A3040",
    padding: 12,
    margin: 16,
    color: "#F4F7FF",
    fontSize: 14,
  },
  rosterScroll: {
    flex: 1,
  },
  rosterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    gap: 8,
  },
  fighterTile: {
    backgroundColor: "#1A2030",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#2A3040",
  },
  fighterTileActive: {
    borderColor: "#FF6B3D",
    backgroundColor: "rgba(255,107,61,0.12)",
  },
  fighterName: {
    color: "#C0C8D8",
    fontSize: 13,
    fontWeight: "500",
  },
  fighterNameActive: {
    color: "#FF6B3D",
  },

  // Preview
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  previewActions: {
    flexDirection: "row",
    gap: 8,
  },
  saveAllBtn: {
    backgroundColor: "#FF6B3D",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  saveAllLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  startOverBtn: {
    backgroundColor: "#1A2030",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "#2A3040",
  },
  startOverLabel: {
    color: "#C0C8D8",
    fontSize: 14,
    fontWeight: "600",
  },

  // Opponent cards
  opponentCard: {
    backgroundColor: "#1A2030",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A3040",
    overflow: "hidden",
  },
  opponentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  opponentTitleRow: {
    flex: 1,
  },
  opponentName: {
    color: "#F4F7FF",
    fontSize: 17,
    fontWeight: "700",
  },
  sectionCount: {
    color: "#637083",
    fontSize: 12,
    marginTop: 2,
  },
  opponentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  saveBtn: {
    backgroundColor: "#34D399",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  saveBtnLabel: {
    color: "#0F1420",
    fontSize: 13,
    fontWeight: "700",
  },
  savedBadge: {
    color: "#34D399",
    fontSize: 13,
    fontWeight: "600",
  },
  expandIcon: {
    color: "#637083",
    fontSize: 14,
  },

  // Sections
  sectionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#252D3D",
  },
  sectionBlock: {
    marginTop: 14,
  },
  sectionLabel: {
    color: "#FF6B3D",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionContent: {
    color: "#C0C8D8",
    fontSize: 14,
    lineHeight: 22,
  },
  emptyText: {
    color: "#637083",
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 10,
  },
});
