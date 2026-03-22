import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function LoadingScreen() {
  return (
    <View style={styles.centerScreen}>
      <ActivityIndicator size="large" color="#2A4D9B" />
      <Text style={styles.loadingLabel}>Loading account...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centerScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingLabel: {
    color: "#5E6B80",
    fontWeight: "600",
  },
});