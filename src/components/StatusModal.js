import { Modal, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";

export default function StatusModal({ statusPopup, onClose }) {
  const isDark = useColorScheme() === "dark";

  return (
    <Modal
      visible={statusPopup.visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.statusBackdrop, isDark && styles.statusBackdropDark]}>
        <View
          style={[
            styles.statusCard,
            isDark && styles.statusCardDark,
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
              isDark && statusPopup.type === "info" && styles.statusTitleInfoDark,
            ]}
          >
            {statusPopup.title}
          </Text>
          <Text style={[styles.statusMessage, isDark && styles.statusMessageDark]}>{statusPopup.message}</Text>
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
  statusBackdropDark: {
    backgroundColor: "rgba(4, 8, 18, 0.62)",
  },
  statusCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderWidth: 1,
  },
  statusCardDark: {
    backgroundColor: "#1B2333",
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
  statusTitleInfoDark: {
    color: "#ECF2FF",
  },
  statusMessage: {
    color: "#4D5B72",
    lineHeight: 21,
  },
  statusMessageDark: {
    color: "#C9D4E8",
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