import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

export default function StatusModal({ statusPopup, onClose }) {
  return (
    <Modal
      visible={statusPopup.visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.statusBackdrop}>
        <View
          style={[
            styles.statusCard,
            statusPopup.type === "success"
              ? styles.statusCardSuccess
              : statusPopup.type === "error"
              ? styles.statusCardError
              : styles.statusCardInfo,
          ]}
        >
          <Text
            style={[
              styles.statusTitle,
              statusPopup.type === "success"
                ? styles.statusTitleSuccess
                : statusPopup.type === "error"
                ? styles.statusTitleError
                : styles.statusTitleInfo,
            ]}
          >
            {statusPopup.title}
          </Text>
          <Text style={styles.statusMessage}>{statusPopup.message}</Text>
          <Pressable style={styles.statusButton} onPress={onClose}>
            <Text style={styles.statusButtonLabel}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  statusBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  statusCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderWidth: 1,
  },
  statusCardSuccess: {
    borderColor: "#CDEDD8",
  },
  statusCardError: {
    borderColor: "#F3C6CC",
  },
  statusCardInfo: {
    borderColor: "#D9E1EC",
  },
  statusTitle: {
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 8,
  },
  statusTitleSuccess: {
    color: "#1F7A42",
  },
  statusTitleError: {
    color: "#A62A3A",
  },
  statusTitleInfo: {
    color: "#1A2B48",
  },
  statusMessage: {
    color: "#4D5B72",
    lineHeight: 21,
  },
  statusButton: {
    alignSelf: "flex-end",
    marginTop: 16,
    backgroundColor: "#1A2B48",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  statusButtonLabel: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});