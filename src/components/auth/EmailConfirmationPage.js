import { Pressable, StyleSheet, Text, View } from "react-native";

export default function EmailConfirmationPage({ authEmail, onBackToSignIn }) {
  return (
    <View style={styles.authScreen}>
      <View style={styles.card}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a confirmation link to{"\n"}
          <Text style={styles.highlightedEmail}>{authEmail}</Text>
          {"\n\n"}Open the link, then come back and sign in.
        </Text>

        <Pressable style={styles.primaryBtn} onPress={onBackToSignIn}>
          <Text style={styles.primaryBtnLabel}>Back to Sign In</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  authScreen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "#050A17",
  },
  card: {
    backgroundColor: "#0B1020",
    borderRadius: 14,
    borderColor: "#1E2739",
    borderWidth: 1,
    padding: 20,
    maxWidth: 540,
    alignSelf: "center",
    width: "100%",
  },
  title: {
    color: "#ECF2FF",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 8,
  },
  subtitle: {
    color: "#A8B5CB",
    lineHeight: 22,
    marginBottom: 14,
  },
  highlightedEmail: {
    fontWeight: "700",
    color: "#F6F9FF",
  },
  primaryBtn: {
    backgroundColor: "#2A4D9B",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnLabel: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});