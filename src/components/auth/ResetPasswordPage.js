import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function ResetPasswordPage({
  newPassword,
  setNewPassword,
  confirmNewPassword,
  setConfirmNewPassword,
  isAuthSubmitting,
  onUpdatePassword,
  onCancelPasswordRecovery,
}) {
  return (
    <View style={styles.authScreen}>
      <View style={styles.card}>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.subtitle}>Set a new password below to finish account recovery.</Text>

        <TextInput
          style={styles.input}
          placeholder="New Password"
          placeholderTextColor="#7D89A1"
          secureTextEntry
          autoCapitalize="none"
          value={newPassword}
          onChangeText={setNewPassword}
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm New Password"
          placeholderTextColor="#7D89A1"
          secureTextEntry
          autoCapitalize="none"
          value={confirmNewPassword}
          onChangeText={setConfirmNewPassword}
        />

        <Pressable style={styles.primaryBtn} onPress={onUpdatePassword} disabled={isAuthSubmitting}>
          <Text style={styles.primaryBtnLabel}>{isAuthSubmitting ? "Please wait..." : "Update password"}</Text>
        </Pressable>

        <Pressable style={styles.linkBtn} onPress={onCancelPasswordRecovery}>
          <Text style={styles.linkText}>Back to Login</Text>
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
  input: {
    borderWidth: 1,
    borderColor: "#1F2940",
    backgroundColor: "#141B2D",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    color: "#ECF2FF",
  },
  primaryBtn: {
    backgroundColor: "#F3CA3E",
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnLabel: {
    color: "#101521",
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  linkBtn: {
    marginTop: 14,
    alignItems: "center",
  },
  linkText: {
    color: "#F3CA3E",
    fontWeight: "800",
  },
});