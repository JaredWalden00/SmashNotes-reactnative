import { useState, useRef, useEffect } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { getFighterIcon } from "../data/smashFighters";
import {
  getNoteSummaryLines,
  getSectionLabel,
  getSectionPlaceholder,
  createEmptySections,
  getActiveSectionKeys,
  createCustomSectionKey,
  NOTE_SECTION_OPTIONS,
} from "../utils/smashNoteModel";
import LiveTextEditor from "./LiveTextEditor";

function RichTextViewerNative({ html, isDark }) {
  const plainText = (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return (
    <Text style={{ color: isDark ? "#D6E0F5" : "#1A2B48", fontSize: 15, lineHeight: 24 }}>
      {plainText}
    </Text>
  );
}

function RichTextViewerWeb({ html, isDark }) {
  const containerRef = useRef(null);
  const styleRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!styleRef.current) {
      styleRef.current = document.createElement("style");
      el.parentNode.insertBefore(styleRef.current, el);
    }
    const fg = isDark ? "#D6E0F5" : "#1A2B48";
    const codeBg = isDark ? "#1B2333" : "#F0F2F6";
    const borderColor = isDark ? "#344158" : "#D8DDE5";
    const quoteBorder = isDark ? "#4A5D7F" : "#D0D8E6";
    const quoteColor = isDark ? "#8A93A7" : "#5A6B84";
    const linkColor = isDark ? "#6B9CFF" : "#2A4D9B";
    styleRef.current.textContent = `
      .rich-viewer { color: ${fg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.7; word-wrap: break-word; overflow-wrap: break-word; white-space: pre-wrap; }
      .rich-viewer h1 { font-size: 22px; font-weight: 800; margin: 10px 0 6px; }
      .rich-viewer h2 { font-size: 18px; font-weight: 700; margin: 8px 0 4px; }
      .rich-viewer h3 { font-size: 16px; font-weight: 700; margin: 6px 0 4px; }
      .rich-viewer p { margin: 4px 0; }
      .rich-viewer a { color: ${linkColor}; }
      .rich-viewer ul, .rich-viewer ol { padding-left: 24px; margin: 6px 0; }
      .rich-viewer li { margin: 2px 0; }
      .rich-viewer blockquote { border-left: 3px solid ${quoteBorder}; padding: 6px 12px; margin: 8px 0; color: ${quoteColor}; font-style: italic; }
      .rich-viewer pre { background: ${codeBg}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 10px 12px; font-family: 'Courier New', monospace; font-size: 14px; overflow-x: auto; margin: 8px 0; }
      .rich-viewer code { background: ${codeBg}; padding: 2px 5px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 14px; }
      .rich-viewer strong { font-weight: 700; }
      .rich-viewer em { font-style: italic; }
      .rich-viewer u { text-decoration: underline; }
      .rich-viewer s { text-decoration: line-through; }
    `;
  }, [isDark]);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.innerHTML = html || "";
  }, [html]);

  return (
    <div ref={containerRef} className="rich-viewer" style={{ userSelect: "text" }} />
  );
}

const RichTextViewer = Platform.OS === "web" ? RichTextViewerWeb : RichTextViewerNative;

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

export default function NoteItem({ note, onEdit, onDelete, onSave, onView, onViewVod, forceDark = false, compact = false }) {
  const isDark = forceDark || useColorScheme() === "dark";
  const summaryLines = getNoteSummaryLines(note.sections);
  const [viewMode, setViewMode] = useState(null); // null = card, "view" = read-only, "edit" = inline edit
  const [editTitle, setEditTitle] = useState("");
  const [editSections, setEditSections] = useState({});
  const [editSectionKeys, setEditSectionKeys] = useState([]);
  const [customSectionInput, setCustomSectionInput] = useState("");
  const isEditing = viewMode === "edit";
  const isViewing = viewMode === "view";

  function startEditing() {
    setEditTitle(note.title || "");
    const sections = createEmptySections(note.sections);
    setEditSections(sections);
    setEditSectionKeys(getActiveSectionKeys(note.sections));
    setCustomSectionInput("");
    setViewMode("edit");
  }

  function cancelEditing() {
    setViewMode(null);
    setEditTitle("");
    setEditSections({});
    setEditSectionKeys([]);
    setCustomSectionInput("");
  }

  function handleSave() {
    // Only save the sections that are currently active
    const filteredSections = {};
    editSectionKeys.forEach((key) => {
      filteredSections[key] = editSections[key] || "";
    });
    if (onSave) {
      onSave(note.id, editTitle, filteredSections);
    }
    setViewMode(null);
  }

  function updateSectionValue(key, html) {
    setEditSections((current) => ({ ...current, [key]: html }));
  }

  function addSection(key) {
    setEditSectionKeys((current) => (current.includes(key) ? current : [...current, key]));
  }

  function removeSection(key) {
    setEditSectionKeys((current) => {
      if (current.length <= 1) return current;
      return current.filter((k) => k !== key);
    });
    setEditSections((current) => ({ ...current, [key]: "" }));
  }

  function addCustomSection() {
    const key = createCustomSectionKey(customSectionInput, editSectionKeys);
    if (!key) return;
    setEditSectionKeys((current) => (current.includes(key) ? current : [...current, key]));
    setEditSections((current) => ({ ...current, [key]: current[key] || "" }));
    setCustomSectionInput("");
  }

  function moveSection(key, direction) {
    setEditSectionKeys((current) => {
      const idx = current.indexOf(key);
      if (idx < 0) return current;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= current.length) return current;
      const reordered = [...current];
      const [moved] = reordered.splice(idx, 1);
      reordered.splice(target, 0, moved);
      return reordered;
    });
  }

  if (isViewing) {
    const allSections = createEmptySections(note.sections);
    const activeKeys = getActiveSectionKeys(note.sections);

    return (
      <View style={[styles.card, isDark && styles.cardDark]}>
        {/* Header */}
        <View style={styles.viewHeader}>
          <View style={styles.viewHeaderTop}>
            <View style={styles.matchupWrap}>
              <Image source={getFighterIcon(note.character)} style={styles.viewIcon} />
              {note.opponent ? (
                <>
                  <Text style={[styles.viewVersus, isDark && styles.versusDark]}>vs</Text>
                  <Image source={getFighterIcon(note.opponent)} style={styles.viewIcon} />
                </>
              ) : null}
            </View>
            <Pressable style={styles.viewCloseBtn} onPress={() => setViewMode(null)}>
              <Text style={styles.viewCloseBtnLabel}>Close</Text>
            </Pressable>
          </View>
          <Text style={[styles.viewTitle, isDark && styles.titleDark]}>{note.title || "Untitled note"}</Text>
          <View style={styles.viewMetaRow}>
            <Text style={[styles.viewContext, isDark && styles.contextLabelDark]}>
              {note.opponent ? `${note.character} vs ${note.opponent}` : note.character}
            </Text>
            {note.playerTag ? (
              <View style={[styles.viewPlayerChip, isDark && styles.viewPlayerChipDark]}>
                <Text style={[styles.viewPlayerChipLabel, isDark && styles.viewPlayerChipLabelDark]}>{note.playerTag}</Text>
              </View>
            ) : null}
            <View
              style={[
                styles.typeChip,
                note.opponent ? styles.matchupChip : styles.generalChip,
                isDark && styles.typeChipDark,
                isDark && (note.opponent ? styles.matchupChipDark : styles.generalChipDark),
              ]}
            >
              <Text style={[styles.typeChipLabel, isDark && styles.typeChipLabelDark]}>{note.opponent ? "Matchup" : "General"}</Text>
            </View>
          </View>
          <Text style={[styles.meta, isDark && styles.metaDark]}>Updated {formatDate(note.updatedAt)}</Text>
        </View>

        {/* Set info */}
        {note.setTournament ? (
          <View style={[styles.viewSetBadge, isDark && styles.viewSetBadgeDark]}>
            <Text style={styles.viewSetTournament}>{note.setTournament}</Text>
            {note.setEvent ? <Text style={styles.viewSetEvent}>{note.setEvent}</Text> : null}
            {note.setScore ? <Text style={styles.viewSetScore}>{note.setScore}</Text> : null}
          </View>
        ) : null}

        {/* VOD link */}
        {note.vodUrl ? (
          <Pressable
            style={[styles.viewSetBadge, isDark && styles.viewSetBadgeDark]}
            onPress={() => {
              if (typeof window !== "undefined") window.open(note.vodUrl, "_blank");
            }}
          >
            <Text style={styles.viewSetTournament}>🎬 VOD Review</Text>
            <Text style={styles.viewSetEvent}>{note.vodUrl}</Text>
          </Pressable>
        ) : null}

        {/* Sections */}
        <View style={styles.viewSections}>
          {activeKeys.map((key) => (
            <View key={key} style={[styles.viewSection, isDark && styles.viewSectionDark]}>
              <Text style={[styles.viewSectionLabel, isDark && styles.viewSectionLabelDark]}>
                {getSectionLabel(key)}
              </Text>
              <RichTextViewer html={allSections[key] || ""} isDark={isDark} />
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.viewActions}>
          <Pressable
            style={[styles.actionBtn, styles.editBtn, isDark && styles.editBtnDark]}
            onPress={() => { setViewMode(null); startEditing(); }}
          >
            <Text style={[styles.actionLabel, isDark && styles.actionLabelDark]}>Edit</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.deleteBtn, isDark && styles.deleteBtnDark]}
            onPress={() => onDelete(note.id)}
          >
            <Text style={[styles.actionLabel, isDark && styles.actionLabelDark]}>Delete</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isEditing) {
    const availableSections = NOTE_SECTION_OPTIONS.filter(
      (section) => !editSectionKeys.includes(section.key)
    );

    return (
      <View style={[styles.card, isDark && styles.cardDark]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.matchupWrap}>
            <Image source={getFighterIcon(note.character)} style={styles.icon} />
            {note.opponent ? (
              <>
                <Text style={[styles.versus, isDark && styles.versusDark]}>vs</Text>
                <Image source={getFighterIcon(note.opponent)} style={styles.icon} />
              </>
            ) : null}
          </View>
          <View style={styles.titleWrap}>
            <Text style={[styles.editingLabel, isDark && styles.editingLabelDark]}>Editing</Text>
          </View>
        </View>

        {/* Title input */}
        <View style={styles.editFieldWrap}>
          <Text style={[styles.editFieldLabel, isDark && styles.editFieldLabelDark]}>Title</Text>
          <TextInput
            style={[styles.editTitleInput, isDark && styles.editTitleInputDark]}
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder="Note title"
            placeholderTextColor={isDark ? "#5A6B84" : "#A0AABB"}
            maxLength={80}
          />
        </View>

        {/* Add section chips */}
        {availableSections.length > 0 && (
          <View style={styles.addSectionWrap}>
            <Text style={[styles.editFieldLabel, isDark && styles.editFieldLabelDark]}>Add section</Text>
            <View style={styles.sectionChipRow}>
              {availableSections.map((section) => (
                <Pressable
                  key={section.key}
                  style={[styles.sectionChip, isDark && styles.sectionChipDark]}
                  onPress={() => addSection(section.key)}
                >
                  <Text style={[styles.sectionChipLabel, isDark && styles.sectionChipLabelDark]}>
                    + {section.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Add custom section */}
        <View style={styles.addCustomWrap}>
          <Text style={[styles.editFieldLabel, isDark && styles.editFieldLabelDark]}>Add custom section</Text>
          <View style={styles.addCustomRow}>
            <TextInput
              style={[styles.customSectionInput, isDark && styles.customSectionInputDark]}
              value={customSectionInput}
              onChangeText={setCustomSectionInput}
              placeholder="e.g. Habit Tracker"
              placeholderTextColor={isDark ? "#5A6B84" : "#A0AABB"}
              maxLength={40}
            />
            <Pressable
              style={[styles.addCustomBtn, !customSectionInput.trim() && styles.addCustomBtnDisabled]}
              onPress={addCustomSection}
              disabled={!customSectionInput.trim()}
            >
              <Text style={styles.addCustomBtnLabel}>Add</Text>
            </Pressable>
          </View>
        </View>

        {/* Section editors */}
        {editSectionKeys.map((key, index) => (
          <View key={key} style={styles.editSectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.editFieldLabel, isDark && styles.editFieldLabelDark]}>
                {getSectionLabel(key)}
              </Text>
              <View style={styles.sectionActionsRow}>
                <Pressable
                  style={[styles.orderBtn, isDark && styles.orderBtnDark, index === 0 && styles.orderBtnDisabled]}
                  onPress={() => moveSection(key, "up")}
                  disabled={index === 0}
                >
                  <Text style={[styles.orderBtnLabel, isDark && styles.orderBtnLabelDark]}>Up</Text>
                </Pressable>
                <Pressable
                  style={[styles.orderBtn, isDark && styles.orderBtnDark, index === editSectionKeys.length - 1 && styles.orderBtnDisabled]}
                  onPress={() => moveSection(key, "down")}
                  disabled={index === editSectionKeys.length - 1}
                >
                  <Text style={[styles.orderBtnLabel, isDark && styles.orderBtnLabelDark]}>Down</Text>
                </Pressable>
                {editSectionKeys.length > 1 && (
                  <Pressable
                    style={[styles.removeSectionBtn, isDark && styles.removeSectionBtnDark]}
                    onPress={() => removeSection(key)}
                  >
                    <Text style={styles.removeSectionLabel}>Remove</Text>
                  </Pressable>
                )}
              </View>
            </View>
            <LiveTextEditor
              value={editSections[key] || ""}
              onChange={(html) => updateSectionValue(key, html)}
              placeholder={getSectionPlaceholder(key)}
              minHeight={140}
            />
          </View>
        ))}

        {/* Save / Cancel */}
        <View style={styles.editActions}>
          <Pressable
            style={[styles.actionBtn, styles.cancelEditBtn, isDark && styles.cancelEditBtnDark]}
            onPress={cancelEditing}
          >
            <Text style={[styles.actionLabel, isDark && styles.actionLabelDark]}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.saveEditBtn]} onPress={handleSave}>
            <Text style={[styles.actionLabel, styles.saveEditLabel]}>Save</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, isDark && styles.cardDark]}>
      <Pressable style={styles.contentWrap} onPress={() => onView ? onView(note) : setViewMode("view")}>
        <View style={styles.headerRow}>
          <View style={styles.matchupWrap}>
            <Image source={getFighterIcon(note.character)} style={styles.icon} />
            {note.opponent ? (
              <>
                <Text style={[styles.versus, isDark && styles.versusDark]}>vs</Text>
                <Image source={getFighterIcon(note.opponent)} style={styles.icon} />
              </>
            ) : null}
          </View>

          <View style={styles.titleWrap}>
            <Text style={[styles.title, isDark && styles.titleDark]}>{note.title || "Untitled note"}</Text>
            <Text style={[styles.contextLabel, isDark && styles.contextLabelDark]}>
              {note.opponent ? `${note.character} vs ${note.opponent}` : `${note.character}`}
            </Text>
          </View>

          <View
            style={[
              styles.typeChip,
              note.opponent ? styles.matchupChip : styles.generalChip,
              isDark && styles.typeChipDark,
              isDark && (note.opponent ? styles.matchupChipDark : styles.generalChipDark),
            ]}
          >
            <Text style={[styles.typeChipLabel, isDark && styles.typeChipLabelDark]}>{note.opponent ? "Matchup" : "General"}</Text>
          </View>
        </View>

        {!compact && (summaryLines.length ? (
          <View style={styles.summaryWrap}>
            {summaryLines.map(([label, value]) => (
                <Text key={label} numberOfLines={2} style={[styles.body, isDark && styles.bodyDark]}>
                <Text style={[styles.bodyLabel, isDark && styles.bodyLabelDark]}>{label}: </Text>
                {value}
              </Text>
            ))}
          </View>
        ) : (
          <Text numberOfLines={3} style={[styles.body, isDark && styles.bodyDark]}>
            No content
          </Text>
        ))}

        <Text style={[styles.meta, isDark && styles.metaDark]}>Updated {formatDate(note.updatedAt)}</Text>
      </Pressable>

      <View style={styles.actions}>
        {note.vodUrl && onViewVod ? (
          <Pressable
            style={[styles.actionBtn, styles.vodBtn, isDark && styles.vodBtnDark]}
            onPress={() => onViewVod(note)}
          >
            <Text style={styles.vodBtnLabel}>🎬 View VOD</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.actionBtn, styles.viewBtn, isDark && styles.viewBtnDark]}
          onPress={() => onView ? onView(note) : setViewMode("view")}
        >
          <Text style={[styles.actionLabel, isDark && styles.actionLabelDark]}>View</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.editBtn, isDark && styles.editBtnDark]}
          onPress={() => onView ? onView(note) : (onSave ? startEditing() : onEdit(note))}
        >
          <Text style={[styles.actionLabel, isDark && styles.actionLabelDark]}>Edit</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.deleteBtn, isDark && styles.deleteBtnDark]} onPress={() => onDelete(note.id)}>
          <Text style={[styles.actionLabel, isDark && styles.actionLabelDark]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1B2333",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A3449",
    boxShadow: "0px 2px 5px rgba(0,0,0,0.06)",
    elevation: 1,
  },
  cardDark: {
    backgroundColor: "#1B2333",
    borderColor: "#2A3449",
  },
  contentWrap: {
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  matchupWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  icon: {
    width: 34,
    height: 34,
  },
  versus: {
    marginHorizontal: 4,
    fontSize: 11,
    fontWeight: "800",
    color: "#6B778C",
  },
  versusDark: {
    color: "#A8B5CB",
  },
  titleWrap: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ECF2FF",
    marginBottom: 4,
  },
  titleDark: {
    color: "#ECF2FF",
  },
  contextLabel: {
    fontSize: 12,
    color: "#6B778C",
    fontWeight: "600",
  },
  contextLabelDark: {
    color: "#A8B5CB",
  },
  typeChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  generalChip: {
    backgroundColor: "#1E3254",
  },
  matchupChip: {
    backgroundColor: "#3B2A30",
  },
  typeChipLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#C9D4E8",
  },
  typeChipDark: {
    borderWidth: 1,
    borderColor: "#30405C",
    opacity: 1,
  },
  generalChipDark: {
    backgroundColor: "#20344A",
  },
  matchupChipDark: {
    backgroundColor: "#3B2A30",
  },
  typeChipLabelDark: {
    color: "#DCE7FF",
  },
  body: {
    fontSize: 14,
    color: "#A8B5CB",
    lineHeight: 20,
    marginBottom: 6,
  },
  bodyDark: {
    color: "#A8B5CB",
  },
  bodyLabel: {
    fontWeight: "800",
    color: "#C9D4E8",
  },
  bodyLabelDark: {
    color: "#ECF2FF",
  },
  summaryWrap: {
    marginBottom: 6,
  },
  meta: {
    fontSize: 12,
    color: "#8A95A5",
  },
  metaDark: {
    color: "#95A3BB",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  vodBtn: {
    backgroundColor: "#FF6B3D",
  },
  vodBtnDark: {
    backgroundColor: "#FF6B3D",
  },
  vodBtnLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  viewBtn: {
    backgroundColor: "#1E3254",
  },
  viewBtnDark: {
    backgroundColor: "#1E3254",
  },
  editBtn: {
    backgroundColor: "#2A3E5B",
  },
  editBtnDark: {
    backgroundColor: "#2A3E5B",
  },
  deleteBtn: {
    backgroundColor: "#4A2930",
  },
  deleteBtnDark: {
    backgroundColor: "#4A2930",
  },
  actionLabel: {
    fontWeight: "600",
    color: "#ECF2FF",
  },
  actionLabelDark: {
    color: "#ECF2FF",
  },
  // Section management styles
  addSectionWrap: {
    marginBottom: 12,
  },
  sectionChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  sectionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#344158",
    backgroundColor: "#141C2B",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sectionChipDark: {
    borderColor: "#344158",
    backgroundColor: "#182131",
  },
  sectionChipLabel: {
    color: "#C9D4E8",
    fontWeight: "700",
    fontSize: 12,
  },
  sectionChipLabelDark: {
    color: "#C9D4E8",
  },
  addCustomWrap: {
    marginBottom: 12,
  },
  addCustomRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 6,
  },
  customSectionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#344158",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: "#ECF2FF",
    fontSize: 13,
  },
  customSectionInputDark: {
    borderColor: "#344158",
    backgroundColor: "#141C2B",
    color: "#ECF2FF",
  },
  addCustomBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#2A4D9B",
  },
  addCustomBtnDisabled: {
    opacity: 0.5,
  },
  addCustomBtnLabel: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  orderBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4A5D7F",
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: "#273348",
  },
  orderBtnDark: {
    borderColor: "#4A5D7F",
    backgroundColor: "#273348",
  },
  orderBtnDisabled: {
    opacity: 0.45,
  },
  orderBtnLabel: {
    color: "#ECF2FF",
    fontWeight: "800",
    fontSize: 11,
  },
  orderBtnLabelDark: {
    color: "#ECF2FF",
  },
  removeSectionBtn: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#3A242B",
  },
  removeSectionBtnDark: {
    backgroundColor: "#3A242B",
  },
  removeSectionLabel: {
    color: "#C14D22",
    fontWeight: "800",
    fontSize: 11,
  },
  // Inline editing styles
  editingLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2A4D9B",
  },
  editingLabelDark: {
    color: "#6B9CFF",
  },
  editFieldWrap: {
    marginBottom: 12,
  },
  editFieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#C9D4E8",
    marginBottom: 6,
  },
  editFieldLabelDark: {
    color: "#C9D4E8",
  },
  editTitleInput: {
    borderWidth: 1,
    borderColor: "#344158",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#ECF2FF",
    backgroundColor: "#1B2333",
  },
  editTitleInputDark: {
    borderColor: "#344158",
    backgroundColor: "#141C2B",
    color: "#ECF2FF",
  },
  editSectionWrap: {
    marginBottom: 12,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  cancelEditBtn: {
    backgroundColor: "#273348",
  },
  cancelEditBtnDark: {
    backgroundColor: "#273348",
  },
  saveEditBtn: {
    backgroundColor: "#2A4D9B",
  },
  saveEditLabel: {
    color: "#FFFFFF",
  },
  // View mode styles
  viewHeader: {
    marginBottom: 16,
  },
  viewHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  viewIcon: {
    width: 44,
    height: 44,
  },
  viewVersus: {
    marginHorizontal: 6,
    fontSize: 13,
    fontWeight: "800",
    color: "#6B778C",
  },
  viewCloseBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#2A3449",
  },
  viewCloseBtnLabel: {
    color: "#C9D4E8",
    fontWeight: "700",
    fontSize: 13,
  },
  viewTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ECF2FF",
    marginBottom: 8,
  },
  viewMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  viewContext: {
    fontSize: 13,
    color: "#6B778C",
    fontWeight: "600",
  },
  viewPlayerChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#E8F0FE",
  },
  viewPlayerChipDark: {
    backgroundColor: "#1E3254",
  },
  viewPlayerChipLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2A4D9B",
  },
  viewPlayerChipLabelDark: {
    color: "#6B9CFF",
  },
  viewSections: {
    gap: 14,
    marginBottom: 16,
  },
  viewSection: {
    backgroundColor: "#141C2B",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2A3449",
  },
  viewSectionDark: {
    backgroundColor: "#141C2B",
    borderColor: "#2A3449",
  },
  viewSectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#C9D4E8",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  viewSectionLabelDark: {
    color: "#96A3BD",
  },
  viewSectionBody: {
    fontSize: 15,
    lineHeight: 24,
    color: "#ECF2FF",
  },
  viewSectionBodyDark: {
    color: "#D6E0F5",
  },
  viewSetBadge: {
    backgroundColor: "#141C2B",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#2A3449",
  },
  viewSetBadgeDark: {
    backgroundColor: "#141C2B",
    borderColor: "#2A3449",
  },
  viewSetTournament: {
    color: "#FF6B3D",
    fontSize: 14,
    fontWeight: "700",
  },
  viewSetEvent: {
    color: "#96A3BD",
    fontSize: 12,
    marginTop: 2,
  },
  viewSetScore: {
    color: "#ECF2FF",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  viewActions: {
    flexDirection: "row",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#E6E8EB",
    paddingTop: 14,
  },
});
