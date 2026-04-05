import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export default function ForgotPasswordPage({
  authEmail,
  setAuthEmail,
  isAuthSubmitting,
  onForgotPassword,
  onCancelForgotPassword,
}) {
  return (
    <KeyboardAvoidingView style={styles.authScreen} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.authScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.title}>Forgot your password?</Text>
        <Text style={styles.subtitle}>
          Enter the email address associated with your account and we will send you a link to reset your password.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor="#7D89A1"
          autoCapitalize="none"
          keyboardType="email-address"
          value={authEmail}
          onChangeText={setAuthEmail}
        />

        <Pressable style={styles.primaryBtn} onPress={onForgotPassword} disabled={isAuthSubmitting}>
          <Text style={styles.primaryBtnLabel}>{isAuthSubmitting ? "Please wait..." : "Reset my password"}</Text>
        </Pressable>

        <Pressable style={styles.linkBtn} onPress={onCancelForgotPassword}>
          <Text style={styles.linkText}>Back to Login</Text>
        </Pressable>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  authScreen: {
    flex: 1,
    backgroundColor: "#050A17",
  },
  authScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 20,
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