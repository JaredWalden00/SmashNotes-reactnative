import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
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

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

export default function NoteItem({ note, onEdit, onDelete, onSave, forceDark = false }) {
  const isDark = forceDark || useColorScheme() === "dark";
  const summaryLines = getNoteSummaryLines(note.sections);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSections, setEditSections] = useState({});
  const [editSectionKeys, setEditSectionKeys] = useState([]);
  const [customSectionInput, setCustomSectionInput] = useState("");

  function startEditing() {
    setEditTitle(note.title || "");
    const sections = createEmptySections(note.sections);
    setEditSections(sections);
    setEditSectionKeys(getActiveSectionKeys(note.sections));
    setCustomSectionInput("");
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
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
    setIsEditing(false);
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
      <Pressable style={styles.contentWrap} onPress={() => (onSave ? startEditing() : onEdit(note))}>
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

        {summaryLines.length ? (
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
        )}

        <Text style={[styles.meta, isDark && styles.metaDark]}>Updated {formatDate(note.updatedAt)}</Text>
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          style={[styles.actionBtn, styles.editBtn, isDark && styles.editBtnDark]}
          onPress={() => (onSave ? startEditing() : onEdit(note))}
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
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E6E8EB",
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
    color: "#1A2B48",
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
    backgroundColor: "#E8F4FF",
  },
  matchupChip: {
    backgroundColor: "#FFF1EA",
  },
  typeChipLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#20304E",
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
    color: "#4D5B72",
    lineHeight: 20,
    marginBottom: 6,
  },
  bodyDark: {
    color: "#A8B5CB",
  },
  bodyLabel: {
    fontWeight: "800",
    color: "#20304E",
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
  editBtn: {
    backgroundColor: "#D5E8FF",
  },
  editBtnDark: {
    backgroundColor: "#2A3E5B",
  },
  deleteBtn: {
    backgroundColor: "#FFDCE0",
  },
  deleteBtnDark: {
    backgroundColor: "#4A2930",
  },
  actionLabel: {
    fontWeight: "600",
    color: "#1E2A3A",
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
    borderColor: "#D8DDE5",
    backgroundColor: "#F8FAFD",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sectionChipDark: {
    borderColor: "#344158",
    backgroundColor: "#182131",
  },
  sectionChipLabel: {
    color: "#20304E",
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
    borderColor: "#D8DDE5",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: "#1A2B48",
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
    borderColor: "#CFD7E6",
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: "#EEF1F5",
  },
  orderBtnDark: {
    borderColor: "#4A5D7F",
    backgroundColor: "#273348",
  },
  orderBtnDisabled: {
    opacity: 0.45,
  },
  orderBtnLabel: {
    color: "#1A2B48",
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
    backgroundColor: "#FFEDED",
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
    color: "#20304E",
    marginBottom: 6,
  },
  editFieldLabelDark: {
    color: "#C9D4E8",
  },
  editTitleInput: {
    borderWidth: 1,
    borderColor: "#D8DDE5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#1A2B48",
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#EEF1F5",
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
});
