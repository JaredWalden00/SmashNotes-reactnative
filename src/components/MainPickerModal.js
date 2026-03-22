import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { getRosterFighters } from "../data/smashFighters";
import FighterTile from "./FighterTile";

const ROSTER_FIGHTERS = getRosterFighters();

export default function MainPickerModal({
  visible,
  selectedMain,
  isSaving,
  onSelectMain,
  onClose,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>Set your main</Text>
          <Text style={styles.subtitle}>Choose the fighter you want pinned as your profile main.</Text>

          <Pressable
            style={[styles.clearMainButton, !selectedMain && styles.clearMainButtonActive]}
            onPress={() => onSelectMain(null)}
            disabled={isSaving}
          >
            <Text style={[styles.clearMainLabel, !selectedMain && styles.clearMainLabelActive]}>
              No main
            </Text>
          </Pressable>

          <FlatList
            data={ROSTER_FIGHTERS}
            keyExtractor={(item) => item.name}
            numColumns={4}
            columnWrapperStyle={styles.gridRow}
            renderItem={({ item }) => (
              <FighterTile
                fighter={item}
                compact
                selected={item.name === selectedMain}
                onPress={onSelectMain}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />

          <Pressable style={[styles.actionBtn, styles.closeBtn]} onPress={onClose} disabled={isSaving}>
            <Text style={styles.actionLabel}>{isSaving ? "Saving..." : "Close"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6E8EB",
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 12,
    maxHeight: "80%",
  },
  title: {
    fontSize: 21,
    fontWeight: "800",
    color: "#1A2B48",
  },
  subtitle: {
    color: "#5E6B80",
    marginTop: 4,
    marginBottom: 12,
  },
  gridRow: {
    justifyContent: "space-between",
  },
  listContent: {
    paddingBottom: 6,
  },
  clearMainButton: {
    backgroundColor: "#EEF1F5",
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
    marginBottom: 10,
  },
  clearMainButtonActive: {
    backgroundColor: "#FFF3EE",
  },
  clearMainLabel: {
    color: "#1A2B48",
    fontWeight: "700",
  },
  clearMainLabelActive: {
    color: "#C14D22",
  },
  actionBtn: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 6,
  },
  closeBtn: {
    backgroundColor: "#EEF1F5",
  },
  actionLabel: {
    color: "#1A2B48",
    fontWeight: "700",
  },
});