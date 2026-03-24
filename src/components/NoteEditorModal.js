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

export default function NoteEditorModal({
  visible,
  draftId,
  editorContextLabel,
  titleInput,
  setTitleInput,
  editorSections,
  updateSection,
  onClose,
  onSave,
}) {
  const isDark = useColorScheme() === "dark";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.modalBackdrop, isDark && styles.modalBackdropDark]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
          <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>{draftId ? "Edit note" : "New note"}</Text>
          <Text style={styles.contextPill}>{editorContextLabel}</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <TextInput
              style={[styles.inputTitle, isDark && styles.inputDark]}
              value={titleInput}
              onChangeText={setTitleInput}
              placeholder="Optional custom title"
              placeholderTextColor={isDark ? "#8A93A7" : "#98A2B3"}
              maxLength={80}
            />

            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Overview</Text>
              <TextInput
                style={[styles.inputBody, isDark && styles.inputDark]}
                value={editorSections.overview}
                onChangeText={(value) => updateSection("overview", value)}
                placeholder="Game plan, key habits, primary reminder"
                placeholderTextColor={isDark ? "#8A93A7" : "#98A2B3"}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Neutral</Text>
              <TextInput
                style={[styles.inputBody, isDark && styles.inputDark]}
                value={editorSections.neutral}
                onChangeText={(value) => updateSection("neutral", value)}
                placeholder="Spacing, buttons to respect, anti-approach plan"
                placeholderTextColor={isDark ? "#8A93A7" : "#98A2B3"}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Advantage</Text>
              <TextInput
                style={[styles.inputBody, isDark && styles.inputDark]}
                value={editorSections.advantage}
                onChangeText={(value) => updateSection("advantage", value)}
                placeholder="Juggles, ledgetraps, kill confirms, pressure"
                placeholderTextColor={isDark ? "#8A93A7" : "#98A2B3"}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Disadvantage</Text>
              <TextInput
                style={[styles.inputBody, isDark && styles.inputDark]}
                value={editorSections.disadvantage}
                onChangeText={(value) => updateSection("disadvantage", value)}
                placeholder="Landing mixups, panic options, what not to do"
                placeholderTextColor={isDark ? "#8A93A7" : "#98A2B3"}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Stage Notes</Text>
              <TextInput
                style={[styles.inputBody, isDark && styles.inputDark]}
                value={editorSections.stageNotes}
                onChangeText={(value) => updateSection("stageNotes", value)}
                placeholder="Good stages, bans, platform notes"
                placeholderTextColor={isDark ? "#8A93A7" : "#98A2B3"}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Reminders</Text>
              <TextInput
                style={[styles.inputBody, isDark && styles.inputDark]}
                value={editorSections.reminders}
                onChangeText={(value) => updateSection("reminders", value)}
                placeholder="Short tournament notes and in-set reminders"
                placeholderTextColor={isDark ? "#8A93A7" : "#98A2B3"}
                multiline
                textAlignVertical="top"
              />
            </View>
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
  },
  modalCardDark: {
    backgroundColor: "#101521",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A2B48",
    marginBottom: 10,
  },
  modalTitleDark: {
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
  scrollContent: {
    paddingBottom: 8,
  },
  inputTitle: {
    borderWidth: 1,
    borderColor: "#D8DDE5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
    color: "#1A2B48",
    fontSize: 16,
    fontWeight: "600",
  },
  sectionBlock: {
    marginBottom: 12,
  },
  sectionLabel: {
    marginBottom: 6,
    color: "#20304E",
    fontWeight: "800",
    fontSize: 13,
  },
  sectionLabelDark: {
    color: "#C9D4E8",
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