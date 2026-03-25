import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { SMASH_FIGHTERS } from "../data/smashFighters";
import { NOTE_SECTION_OPTIONS, getSectionLabel, getSectionPlaceholder } from "../utils/smashNoteModel";
import SelectMenuButton from "./SelectMenuButton";

export default function NoteEditorModal({
  visible,
  draftId,
  editorContextLabel,
  titleInput,
  setTitleInput,
  draftCharacter,
  onChangeDraftCharacter,
  editorSections,
  editorSectionKeys,
  updateSection,
  onAddSection,
  onAddCustomSection,
  onRemoveSection,
  onMoveSection,
  onClose,
  onSave,
}) {
  const isDark = useColorScheme() === "dark";
  const [customSectionInput, setCustomSectionInput] = useState("");
  const activeSections = editorSectionKeys.map((key) => ({
    key,
    label: getSectionLabel(key),
    placeholder: getSectionPlaceholder(key),
  }));
  const availableSections = NOTE_SECTION_OPTIONS.filter((section) => !editorSectionKeys.includes(section.key));
  const characterOptions = SMASH_FIGHTERS.map((fighter) => ({
    label: fighter.name,
    value: fighter.name,
  }));

  function handleAddCustomSection() {
    const wasAdded = onAddCustomSection(customSectionInput);
    if (wasAdded) {
      setCustomSectionInput("");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.modalBackdrop, isDark && styles.modalBackdropDark]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
          <View style={styles.titleFieldWrap}>
            <Text style={[styles.titleFieldLabel, isDark && styles.sectionLabelDark]}>Title</Text>
            <TextInput
              style={[styles.modalHeaderInput, isDark && styles.modalHeaderInputDark]}
              value={titleInput}
              onChangeText={setTitleInput}
              placeholder="Enter note title"
              placeholderTextColor={isDark ? "#8A93A7" : "#98A2B3"}
              maxLength={80}
            />
          </View>
          <View style={styles.topCharacterWrap}>
            <Text style={[styles.topCharacterLabel, isDark && styles.sectionLabelDark]}>Character</Text>
            <SelectMenuButton
              value={draftCharacter}
              options={characterOptions}
              onSelect={onChangeDraftCharacter}
              anchorStyle={styles.topCharacterPickerWrap}
              buttonStyle={styles.topCharacterButton}
              labelStyle={styles.topCharacterButtonLabel}
              caretStyle={styles.topCharacterButtonCaret}
              dropdownStyle={styles.topCharacterDropdown}
              listStyle={styles.topCharacterList}
              itemStyle={styles.topCharacterItem}
              itemActiveStyle={styles.topCharacterItemActive}
              itemLabelStyle={styles.topCharacterItemLabel}
              maxListHeight={220}
            />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {availableSections.length ? (
              <View style={styles.addSectionWrap}>
                <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Add section</Text>
                <View style={styles.sectionChipRow}>
                  {availableSections.map((section) => (
                    <Pressable
                      key={section.key}
                      style={[styles.sectionChip, isDark && styles.sectionChipDark]}
                      onPress={() => onAddSection(section.key)}
                    >
                      <Text style={[styles.sectionChipLabel, isDark && styles.sectionChipLabelDark]}>
                        + {section.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.addCustomWrap}>
              <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Add custom section</Text>
              <View style={styles.addCustomRow}>
                <TextInput
                  style={[styles.customSectionInput, isDark && styles.inputDark]}
                  value={customSectionInput}
                  onChangeText={setCustomSectionInput}
                  placeholder="e.g. Habit Tracker"
                  placeholderTextColor={isDark ? "#8A93A7" : "#98A2B3"}
                  maxLength={40}
                />
                <Pressable
                  style={[styles.addCustomBtn, (!customSectionInput.trim() || !onAddCustomSection) && styles.addCustomBtnDisabled]}
                  onPress={handleAddCustomSection}
                  disabled={!customSectionInput.trim() || !onAddCustomSection}
                >
                  <Text style={styles.addCustomBtnLabel}>Add</Text>
                </Pressable>
              </View>
            </View>

            {activeSections.map((section, index) => (
              <View key={section.key} style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>{section.label}</Text>
                  <View style={styles.sectionActionsRow}>
                    <Pressable
                      style={[styles.orderSectionBtn, index === 0 && styles.orderSectionBtnDisabled, isDark && styles.orderSectionBtnDark]}
                      onPress={() => onMoveSection(section.key, "up")}
                      disabled={index === 0}
                    >
                      <Text style={[styles.orderSectionLabel, isDark && styles.orderSectionLabelDark]}>Up</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.orderSectionBtn,
                        index === activeSections.length - 1 && styles.orderSectionBtnDisabled,
                        isDark && styles.orderSectionBtnDark,
                      ]}
                      onPress={() => onMoveSection(section.key, "down")}
                      disabled={index === activeSections.length - 1}
                    >
                      <Text style={[styles.orderSectionLabel, isDark && styles.orderSectionLabelDark]}>Down</Text>
                    </Pressable>
                    {editorSectionKeys.length > 1 ? (
                      <Pressable
                        style={[styles.removeSectionBtn, isDark && styles.removeSectionBtnDark]}
                        onPress={() => onRemoveSection(section.key)}
                      >
                        <Text style={styles.removeSectionLabel}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <TextInput
                  style={[styles.inputBody, isDark && styles.inputDark]}
                  value={editorSections[section.key] || ""}
                  onChangeText={(value) => updateSection(section.key, value)}
                  placeholder={section.placeholder}
                  placeholderTextColor={isDark ? "#8A93A7" : "#98A2B3"}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalActions}>
            <Pressable style={[styles.modalBtn, styles.cancelBtn, isDark && styles.cancelBtnDark]} onPress={onClose}>
              <Text style={[styles.modalBtnText, isDark && styles.modalBtnTextDark]}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.modalBtn, styles.saveBtn]} onPress={onSave}>
              <Text style={[styles.modalBtnText, styles.saveBtnText]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.36)",
    justifyContent: "flex-end",
  },
  modalBackdropDark: {
    backgroundColor: "rgba(4, 8, 18, 0.62)",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,
    height: "86%",
    overflow: "visible",
  },
  modalCardDark: {
    backgroundColor: "#101521",
  },
  modalHeaderInput: {
    borderWidth: 1,
    borderColor: "#D8DDE5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#1A2B48",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
    outlineStyle: "none",
  },
  titleFieldWrap: {
    marginBottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A3449",
    backgroundColor: "#141C2B",
  },
  titleFieldLabel: {
    marginBottom: 6,
    color: "#20304E",
    fontWeight: "800",
    fontSize: 13,
  },
  modalHeaderInputDark: {
    borderColor: "#344158",
    backgroundColor: "#141C2B",
    color: "#ECF2FF",
  },
  contextPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFF3EE",
    color: "#C14D22",
    fontWeight: "800",
    marginBottom: 14,
  },
  topCharacterWrap: {
    marginBottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A3449",
    backgroundColor: "#141C2B",
    position: "relative",
    zIndex: 320,
  },
  topCharacterLabel: {
    marginBottom: 6,
    color: "#20304E",
    fontWeight: "800",
    fontSize: 13,
  },
  topCharacterPickerWrap: {
    marginBottom: 0,
    zIndex: 360,
  },
  topCharacterButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#344158",
    backgroundColor: "#141C2B",
    paddingHorizontal: 12,
  },
  topCharacterButtonLabel: {
    color: "#ECF2FF",
    fontSize: 13,
    fontWeight: "700",
  },
  topCharacterButtonCaret: {
    color: "#C9D4E8",
    fontSize: 11,
    fontWeight: "900",
  },
  topCharacterDropdown: {
    top: 48,
    left: 0,
    right: 0,
    minWidth: undefined,
    maxWidth: undefined,
    borderColor: "#344158",
    backgroundColor: "#141C2B",
    zIndex: 9999,
    elevation: 9999,
  },
  topCharacterList: {
    maxHeight: 220,
  },
  topCharacterItem: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  topCharacterItemActive: {
    backgroundColor: "#20334B",
  },
  topCharacterItemLabel: {
    color: "#ECF2FF",
    fontSize: 12,
    fontWeight: "700",
  },
  scrollContent: {
    paddingBottom: 8,
    overflow: "visible",
    zIndex: 1,
  },
  sectionBlock: {
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A3449",
    backgroundColor: "#141C2B",
    overflow: "visible",
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
  sectionLabel: {
    marginBottom: 0,
    color: "#20304E",
    fontWeight: "800",
    fontSize: 13,
  },
  sectionLabelDark: {
    color: "#C9D4E8",
  },
  addSectionWrap: {
    marginBottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A3449",
    backgroundColor: "#141C2B",
  },
  sectionChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
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
    marginBottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A3449",
    backgroundColor: "#141C2B",
  },
  addCustomRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 8,
  },
  customSectionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D8DDE5",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: "#1A2B48",
  },
  addCustomBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#2A4D9B",
  },
  addCustomBtnDisabled: {
    opacity: 0.6,
  },
  addCustomBtnLabel: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
  removeSectionBtn: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#FFEDED",
  },
  orderSectionBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CFD7E6",
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: "#EEF1F5",
  },
  orderSectionBtnDark: {
    borderColor: "#4A5D7F",
    backgroundColor: "#273348",
  },
  orderSectionBtnDisabled: {
    opacity: 0.45,
  },
  orderSectionLabel: {
    color: "#1A2B48",
    fontWeight: "800",
    fontSize: 11,
  },
  orderSectionLabelDark: {
    color: "#ECF2FF",
  },
  removeSectionBtnDark: {
    backgroundColor: "#3A242B",
  },
  removeSectionLabel: {
    color: "#C14D22",
    fontWeight: "800",
    fontSize: 11,
  },
  inputBody: {
    borderWidth: 1,
    borderColor: "#D8DDE5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 110,
    color: "#1A2B48",
    fontSize: 15,
    lineHeight: 22,
    outlineStyle: "none",
  },
  inputDark: {
    borderColor: "#344158",
    backgroundColor: "#141C2B",
    color: "#ECF2FF",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelBtn: {
    backgroundColor: "#EEF1F5",
  },
  cancelBtnDark: {
    backgroundColor: "#273348",
  },
  saveBtn: {
    backgroundColor: "#2A4D9B",
  },
  modalBtnText: {
    color: "#1A2B48",
    fontWeight: "700",
  },
  modalBtnTextDark: {
    color: "#ECF2FF",
  },
  saveBtnText: {
    color: "#FFFFFF",
  },
});