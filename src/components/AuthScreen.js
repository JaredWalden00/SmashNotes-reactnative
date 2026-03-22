import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function AuthScreen({
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  isAuthSubmitting,
  pendingConfirmation,
  onBackToSignIn,
  onSignIn,
  onSignUp,
}) {
  if (pendingConfirmation) {
    return (
      <View style={styles.authScreen}>
        <View style={styles.authCard}>
          <Text style={styles.authTitle}>Check your email</Text>
          <Text style={styles.authSubtitle}>
            We sent a confirmation link to{"\n"}
            <Text style={styles.highlightedEmail}>{authEmail}</Text>
            {"\n\n"}Open the link, then come back and sign in.
          </Text>
          <Pressable
            style={[styles.authButton, styles.primaryAuthButton]}
            onPress={onBackToSignIn}
          >
            <Text style={[styles.authButtonLabel, styles.primaryAuthButtonLabel]}>
              Back to Sign In
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.authScreen}>
      <View style={styles.authCard}>
        <Text style={styles.authTitle}>Welcome to SmashNotes</Text>
        <Text style={styles.authSubtitle}>Sign in to sync notes across devices.</Text>

        <TextInput
          style={styles.authInput}
          placeholder="Email"
          placeholderTextColor="#98A2B3"
          autoCapitalize="none"
          keyboardType="email-address"
          value={authEmail}
          onChangeText={setAuthEmail}
        />

        <TextInput
          style={styles.authInput}
          placeholder="Password"
          placeholderTextColor="#98A2B3"
          secureTextEntry
          autoCapitalize="none"
          value={authPassword}
          onChangeText={setAuthPassword}
        />

        <Pressable
          style={[styles.authButton, styles.primaryAuthButton]}
          onPress={onSignIn}
          disabled={isAuthSubmitting}
        >
          <Text style={[styles.authButtonLabel, styles.primaryAuthButtonLabel]}>
            {isAuthSubmitting ? "Please wait..." : "Sign In"}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.authButton, styles.secondaryAuthButton]}
          onPress={onSignUp}
          disabled={isAuthSubmitting}
        >
          <Text style={styles.authButtonLabel}>Create Account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  authScreen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  authCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderColor: "#E6E8EB",
    borderWidth: 1,
    padding: 18,
    boxShadow: "0px 3px 8px rgba(0,0,0,0.06)",
    elevation: 2,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1A2B48",
  },
  authSubtitle: {
    marginTop: 6,
    marginBottom: 14,
    color: "#5E6B80",
  },
  highlightedEmail: {
    fontWeight: "700",
    color: "#1A2B48",
  },
  authInput: {
    borderWidth: 1,
    borderColor: "#D8DDE5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
    color: "#1A2B48",
  },
  authButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryAuthButton: {
    backgroundColor: "#2A4D9B",
    marginTop: 6,
  },
  secondaryAuthButton: {
    backgroundColor: "#EEF1F5",
    marginTop: 10,
  },
  authButtonLabel: {
    fontWeight: "700",
    color: "#1A2B48",
  },
  primaryAuthButtonLabel: {
    color: "#FFFFFF",
  },
});