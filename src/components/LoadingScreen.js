import { ActivityIndicator, StyleSheet, Text, View, useColorScheme } from "react-native";

export default function LoadingScreen() {
  const isDark = useColorScheme() === "dark";

  return (
    <View style={[styles.centerScreen, isDark && styles.centerScreenDark]}>
      <ActivityIndicator size="large" color={isDark ? "#8FB5FF" : "#2A4D9B"} />
      <Text style={[styles.loadingLabel, isDark && styles.loadingLabelDark]}>Loading account...</Text>
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
  centerScreenDark: {
    backgroundColor: "#101521",
  },
  loadingLabel: {
    color: "#5E6B80",
    fontWeight: "600",
  },
  loadingLabelDark: {
    color: "#A8B5CB",
  },
});