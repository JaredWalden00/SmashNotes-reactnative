import { Image, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";

function GoogleMarkIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48" accessibilityRole="image" aria-hidden>
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      <Path fill="none" d="M0 0h48v48H0z" />
    </Svg>
  );
}

export default function SignInPage({
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  isAuthSubmitting,
  onSignIn,
  onGoogleSignIn,
  onStartSignUp,
  onStartForgotPassword,
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= 920;
  const mascotIcon = require("../../SmashIcons/General.png");

  return (
    <View style={styles.authScreen}>
      <View style={[styles.frame, isWide ? styles.frameWide : styles.frameStack]}>
        <View style={[styles.illustrationPane, isWide ? styles.illustrationPaneWide : styles.illustrationPaneStack]}>
          <View style={[styles.planet, styles.planetTop]} />
          <View style={[styles.planet, styles.planetBottom]} />
          <View style={styles.ring} />

          <View style={styles.mascotBubble}>
            <Image source={mascotIcon} style={styles.mascotImage} />
          </View>

          <Text style={styles.brandTitle}>SmashNotes</Text>
          <Text style={styles.brandSubtitle}>Track matchups and keep your gameplan synced everywhere.</Text>
        </View>

        <View style={[styles.formPane, isWide ? styles.formPaneWide : styles.formPaneStack]}>
          <Text style={styles.formTitle}>Login</Text>

          <View style={styles.socialRow}>
            <Pressable
              style={({ pressed }) => [
                styles.socialTile,
                pressed && styles.socialTilePressed,
                isAuthSubmitting && styles.socialTileDisabled,
              ]}
              onPress={onGoogleSignIn}
              disabled={isAuthSubmitting}
            >
              <GoogleMarkIcon />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <TextInput
            style={styles.authInput}
            placeholder="Email Address"
            placeholderTextColor="#7D89A1"
            autoCapitalize="none"
            keyboardType="email-address"
            value={authEmail}
            onChangeText={setAuthEmail}
          />

          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#7D89A1"
              secureTextEntry
              autoCapitalize="none"
              value={authPassword}
              onChangeText={setAuthPassword}
            />
          </View>

          <View style={styles.forgotWrap}>
            <Pressable onPress={onStartForgotPassword} disabled={isAuthSubmitting}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </Pressable>
          </View>

          <Pressable style={styles.loginButton} onPress={onSignIn} disabled={isAuthSubmitting}>
            <Text style={styles.loginButtonLabel}>{isAuthSubmitting ? "Please wait..." : "Login"}</Text>
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Pressable onPress={onStartSignUp} disabled={isAuthSubmitting}>
              <Text style={styles.footerLink}>Create one</Text>
            </Pressable>
          </View>
        </View>
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
  frame: {
    borderWidth: 1,
    borderColor: "#1E2739",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0B1020",
    maxWidth: 1060,
    alignSelf: "center",
    width: "100%",
    boxShadow: "0px 12px 26px rgba(0,0,0,0.34)",
    elevation: 10,
  },
  frameWide: {
    minHeight: 520,
    flexDirection: "row",
  },
  frameStack: {
    flexDirection: "column",
  },
  illustrationPane: {
    backgroundColor: "#090F1F",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  illustrationPaneWide: {
    width: "46%",
    padding: 26,
  },
  illustrationPaneStack: {
    width: "100%",
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  mascotBubble: {
    width: 230,
    height: 230,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: "#25D5E8",
    backgroundColor: "rgba(22, 149, 191, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  mascotImage: {
    width: 180,
    height: 180,
    resizeMode: "contain",
  },
  planet: {
    position: "absolute",
    borderRadius: 999,
  },
  planetTop: {
    width: 86,
    height: 86,
    top: 16,
    right: 22,
    backgroundColor: "#F3C63D",
  },
  planetBottom: {
    width: 92,
    height: 92,
    bottom: 18,
    left: 20,
    backgroundColor: "#E25598",
  },
  ring: {
    position: "absolute",
    width: 114,
    height: 34,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#D2D7E2",
    bottom: 44,
    left: 8,
    transform: [{ rotate: "-11deg" }],
  },
  brandTitle: {
    marginTop: 18,
    color: "#F4F8FF",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  brandSubtitle: {
    marginTop: 8,
    color: "#9DABC6",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
  formPane: {
    backgroundColor: "#0B1020",
  },
  formPaneWide: {
    width: "54%",
    paddingHorizontal: 32,
    paddingVertical: 30,
    justifyContent: "center",
  },
  formPaneStack: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  formTitle: {
    color: "#F6F9FF",
    fontSize: 36,
    fontWeight: "900",
    marginBottom: 12,
  },
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  socialTile: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DADCE0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  socialTilePressed: {
    backgroundColor: "#F8F9FA",
  },
  socialTileDisabled: {
    opacity: 0.74,
  },
  divider: {
    height: 1,
    backgroundColor: "#1D2638",
    marginBottom: 14,
  },
  authInput: {
    borderWidth: 1,
    borderColor: "#1F2940",
    backgroundColor: "#141B2D",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    color: "#ECF2FF",
  },
  passwordWrap: {
    borderWidth: 1,
    borderColor: "#1F2940",
    backgroundColor: "#141B2D",
    borderRadius: 9,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  passwordInput: {
    paddingVertical: 12,
    color: "#ECF2FF",
  },
  forgotWrap: {
    alignItems: "flex-end",
    marginBottom: 12,
  },
  forgotText: {
    color: "#F3CA3E",
    fontWeight: "700",
    fontSize: 12,
  },
  loginButton: {
    backgroundColor: "#F3CA3E",
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: "center",
  },
  loginButtonLabel: {
    color: "#101521",
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 14,
  },
  footerText: {
    color: "#E8EDF8",
    fontWeight: "700",
  },
  footerLink: {
    color: "#F3CA3E",
    fontWeight: "800",
  },
});