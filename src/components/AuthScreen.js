import { Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import Svg, { Path } from "react-native-svg";

function GoogleMarkIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48" accessibilityRole="image" aria-hidden>
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <Path fill="none" d="M0 0h48v48H0z" />
    </Svg>
  );
}

export default function AuthScreen({
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  isAuthSubmitting,
  pendingConfirmation,
  onBackToSignIn,
  onSignIn,
  onGoogleSignIn,
  onSignUp,
}) {
  const isDark = useColorScheme() === "dark";

  if (pendingConfirmation) {
    return (
      <View style={[styles.authScreen, isDark && styles.authScreenDark]}>
        <View style={[styles.authCard, isDark && styles.authCardDark]}>
          <Text style={[styles.authTitle, isDark && styles.authTitleDark]}>Check your email</Text>
          <Text style={[styles.authSubtitle, isDark && styles.authSubtitleDark]}>
            We sent a confirmation link to{"\n"}
            <Text style={[styles.highlightedEmail, isDark && styles.highlightedEmailDark]}>{authEmail}</Text>
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
    <View style={[styles.authScreen, isDark && styles.authScreenDark]}>
      <View style={[styles.authCard, isDark && styles.authCardDark]}>
        <Text style={[styles.authTitle, isDark && styles.authTitleDark]}>Welcome to SmashNotes</Text>
        <Text style={[styles.authSubtitle, isDark && styles.authSubtitleDark]}>Sign in to sync notes across devices.</Text>

        <TextInput
          style={[styles.authInput, isDark && styles.authInputDark]}
          placeholder="Email"
          placeholderTextColor={isDark ? "#8A93A7" : "#98A2B3"}
          autoCapitalize="none"
          keyboardType="email-address"
          value={authEmail}
          onChangeText={setAuthEmail}
        />

        <TextInput
          style={[styles.authInput, isDark && styles.authInputDark]}
          placeholder="Password"
          placeholderTextColor={isDark ? "#8A93A7" : "#98A2B3"}
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
          style={({ pressed }) => [
            styles.authButton,
            styles.googleAuthButton,
            pressed && styles.googleAuthButtonPressed,
            isAuthSubmitting && styles.googleAuthButtonDisabled,
          ]}
          onPress={onGoogleSignIn}
          disabled={isAuthSubmitting}
        >
          <View style={styles.gsiMaterialButtonState} />
          <View style={styles.gsiMaterialButtonContentWrapper}>
            <View style={styles.gsiMaterialButtonIcon}>
              <GoogleMarkIcon />
            </View>
            <Text style={[styles.authButtonLabel, styles.googleAuthButtonLabel]}>
              {isAuthSubmitting ? "Please wait..." : "Sign in with Google"}
            </Text>
          </View>
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
  authScreenDark: {
    backgroundColor: "#101521",
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
  authCardDark: {
    backgroundColor: "#1B2333",
    borderColor: "#2A3449",
  },
  authTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1A2B48",
  },
  authTitleDark: {
    color: "#ECF2FF",
  },
  authSubtitle: {
    marginTop: 6,
    marginBottom: 14,
    color: "#5E6B80",
  },
  authSubtitleDark: {
    color: "#A8B5CB",
  },
  highlightedEmail: {
    fontWeight: "700",
    color: "#1A2B48",
  },
  highlightedEmailDark: {
    color: "#ECF2FF",
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
  authInputDark: {
    borderColor: "#344158",
    backgroundColor: "#141C2B",
    color: "#ECF2FF",
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
  googleAuthButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DADCE0",
    marginTop: 10,
    minHeight: 44,
    overflow: "hidden",
    position: "relative",
  },
  googleAuthButtonPressed: {
    backgroundColor: "#F8F9FA",
  },
  googleAuthButtonDisabled: {
    opacity: 0.8,
  },
  gsiMaterialButtonState: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  gsiMaterialButtonContentWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  gsiMaterialButtonIcon: {
    marginRight: 10,
  },
  authButtonLabel: {
    fontWeight: "700",
    color: "#1A2B48",
  },
  primaryAuthButtonLabel: {
    color: "#FFFFFF",
  },
  googleAuthButtonLabel: {
    color: "#3C4043",
    fontWeight: "600",
  },
});