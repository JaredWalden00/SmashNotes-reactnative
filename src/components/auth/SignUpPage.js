import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export default function SignUpPage({
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  confirmPassword,
  setConfirmPassword,
  isAuthSubmitting,
  onSignUp,
  onBackFromSignUp,
}) {
  const mascotIcon = require("../../SmashIcons/General.png");

  return (
    <KeyboardAvoidingView style={styles.authScreen} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.authScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <View style={styles.mascotBubble}>
          <Image source={mascotIcon} style={styles.mascotImage} />
        </View>

        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Create your SmashNotes account to sync your notes.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor="#7D89A1"
          autoCapitalize="none"
          keyboardType="email-address"
          value={authEmail}
          onChangeText={setAuthEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#7D89A1"
          secureTextEntry
          autoCapitalize="none"
          value={authPassword}
          onChangeText={setAuthPassword}
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor="#7D89A1"
          secureTextEntry
          autoCapitalize="none"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <Text style={styles.captchaInfo}>Captcha is enforced by Supabase bot detection settings.</Text>

        <Pressable style={styles.primaryBtn} onPress={onSignUp} disabled={isAuthSubmitting}>
          <Text style={styles.primaryBtnLabel}>{isAuthSubmitting ? "Please wait..." : "Create account"}</Text>
        </Pressable>

        <Pressable style={styles.linkBtn} onPress={onBackFromSignUp}>
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
    textAlign: "center",
  },
  subtitle: {
    color: "#A8B5CB",
    lineHeight: 22,
    marginBottom: 14,
    textAlign: "center",
  },
  mascotBubble: {
    width: 132,
    height: 132,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: "#25D5E8",
    backgroundColor: "rgba(22, 149, 191, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  mascotImage: {
    width: 102,
    height: 102,
    resizeMode: "contain",
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
  captchaInfo: {
    color: "#8FA0BD",
    fontSize: 12,
    marginBottom: 12,
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