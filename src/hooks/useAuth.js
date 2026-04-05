import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../lib/supabase";

function getRedirectUrl(path) {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/${path}`;
  }
  return Linking.createURL(path);
}
import { isRateLimitError } from "../utils/appHelpers";

WebBrowser.maybeCompleteAuthSession();

export function useAuth({ showStatusPopup, showServerOverloadedPopup }) {
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  useEffect(() => {
    let isMounted = true;

    function cleanAuthUrl() {
      if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
        const path = window.location.pathname;
        if (path.includes("/auth/callback") || path.includes("/auth/reset-password")) {
          window.history.replaceState({}, '', '/');
        }
      }
    }

    async function bootstrapSession() {
      try {
        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (isMounted) {
          setSession(initialSession || null);
          cleanAuthUrl();
        }
      } catch (error) {
        if (isRateLimitError(error)) {
          showServerOverloadedPopup();
          return;
        }

        showStatusPopup("error", "Auth error", "Could not restore your login session.");
        cleanAuthUrl();
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    }

    bootstrapSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      cleanAuthUrl();
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
        setAuthMode("signin");
        setIsForgotPassword(false);
        setPendingConfirmation(false);
        showStatusPopup("info", "Reset password", "Enter your new password to finish recovery.");
      }

      if (event === "SIGNED_OUT") {
        setIsPasswordRecovery(false);
        setIsForgotPassword(false);
        setNewPassword("");
        setConfirmNewPassword("");
      }

      setSession(nextSession || null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [showServerOverloadedPopup, showStatusPopup]);

  async function handleSignIn() {
    if (!authEmail.trim() || !authPassword.trim()) {
      showStatusPopup("error", "Missing fields", "Enter your email and password.");
      return;
    }

    setIsAuthSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        setSession(data.session);
        setPendingConfirmation(false);
      }
    } catch (error) {
      if (isRateLimitError(error)) {
        showServerOverloadedPopup();
        return;
      }

      showStatusPopup("error", "Sign in failed", error.message || "Could not sign in.");
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleSignUp() {
    if (!authEmail.trim() || !authPassword.trim()) {
      showStatusPopup("error", "Missing fields", "Enter your email and password.");
      return;
    }

    if (authPassword !== confirmPassword) {
      showStatusPopup("error", "Passwords do not match", "Make sure both passwords are the same.");
      return;
    }

    if (authPassword.length < 6) {
      showStatusPopup("error", "Password too short", "Use at least 6 characters.");
      return;
    }

    setIsAuthSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        setSession(data.session);
        showStatusPopup("success", "Account created", "You are signed in and ready to go.");
      } else {
        setAuthMode("signin");
        setPendingConfirmation(true);
        showStatusPopup(
          "success",
          "Email sent",
          "Check your inbox for a confirmation link before signing in."
        );
      }
    } catch (error) {
      if (isRateLimitError(error)) {
        showServerOverloadedPopup();
        return;
      }

      showStatusPopup(
        "error",
        "Sign up failed",
        error.message || "Could not create your account."
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleSignOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      showStatusPopup("info", "Signed out", "You have been signed out.");
    } catch (error) {
      if (isRateLimitError(error)) {
        showServerOverloadedPopup();
        return;
      }

      showStatusPopup("error", "Sign out failed", error.message || "Could not sign out.");
    }
  }

  async function handleGoogleSignIn() {
    setIsAuthSubmitting(true);

    try {
      const redirectTo = getRedirectUrl("auth/callback");

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: Platform.OS !== "web",
        },
      });

      if (error) {
        throw error;
      }

      if (Platform.OS === "web") {
        return;
      }

      if (!data?.url) {
        showStatusPopup("error", "Google sign-in failed", "Could not open Google sign-in.");
        return;
      }

      const authResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (authResult.type !== "success" || !authResult.url) {
        if (authResult.type === "cancel") {
          showStatusPopup("info", "Sign-in cancelled", "Google sign-in was cancelled.");
        } else {
          showStatusPopup("error", "Google sign-in failed", "Could not complete Google sign-in.");
        }
        return;
      }

      const callbackUrl = new URL(authResult.url);
      const authCode = callbackUrl.searchParams.get("code");

      if (authCode) {
        const {
          data: { session: exchangedSession },
          error: exchangeError,
        } = await supabase.auth.exchangeCodeForSession(authCode);

        if (exchangeError) {
          throw exchangeError;
        }

        if (exchangedSession) {
          setSession(exchangedSession);
          setPendingConfirmation(false);
          return;
        }
      }

      const hashParams = new URLSearchParams(callbackUrl.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const {
          data: { session: tokenSession },
          error: tokenError,
        } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (tokenError) {
          throw tokenError;
        }

        if (tokenSession) {
          setSession(tokenSession);
          setPendingConfirmation(false);
          return;
        }
      }

      showStatusPopup("error", "Google sign-in failed", "No session was returned from Google.");
    } catch (error) {
      if (isRateLimitError(error)) {
        showServerOverloadedPopup();
        return;
      }

      showStatusPopup(
        "error",
        "Google sign-in failed",
        error.message || "Could not sign in with Google."
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    if (!authEmail.trim()) {
      showStatusPopup("error", "Missing email", "Enter your email first, then tap Forgot Password.");
      return;
    }

    setIsAuthSubmitting(true);

    try {
      const redirectTo = getRedirectUrl("auth/reset-password");
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), {
        redirectTo,
      });

      if (error) {
        throw error;
      }

      showStatusPopup(
        "success",
        "Reset email sent",
        "Check your inbox and open the password reset link."
      );
      setIsForgotPassword(false);
    } catch (error) {
      if (isRateLimitError(error)) {
        showServerOverloadedPopup();
        return;
      }

      showStatusPopup(
        "error",
        "Reset request failed",
        error.message || "Could not send password reset email."
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleUpdatePassword() {
    if (!newPassword.trim() || !confirmNewPassword.trim()) {
      showStatusPopup("error", "Missing fields", "Enter and confirm your new password.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showStatusPopup("error", "Passwords do not match", "Make sure both passwords are the same.");
      return;
    }

    if (newPassword.length < 6) {
      showStatusPopup("error", "Password too short", "Use at least 6 characters.");
      return;
    }

    setIsAuthSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      setIsPasswordRecovery(false);
      setNewPassword("");
      setConfirmNewPassword("");
      showStatusPopup("success", "Password updated", "Your password has been changed.");
    } catch (error) {
      if (isRateLimitError(error)) {
        showServerOverloadedPopup();
        return;
      }

      showStatusPopup(
        "error",
        "Password update failed",
        error.message || "Could not update your password."
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  function cancelPasswordRecovery() {
    setIsPasswordRecovery(false);
    setNewPassword("");
    setConfirmNewPassword("");
  }

  function startForgotPassword() {
    setIsForgotPassword(true);
  }

  function cancelForgotPassword() {
    setIsForgotPassword(false);
  }

  function startSignUpMode() {
    setAuthMode("signup");
    setPendingConfirmation(false);
    setIsForgotPassword(false);
    setAuthPassword("");
    setConfirmPassword("");
  }

  function backToSignInMode() {
    setAuthMode("signin");
    setIsForgotPassword(false);
    setAuthPassword("");
    setConfirmPassword("");
  }

  return {
    session,
    userId: session?.user?.id,
    isAuthLoading,
    isAuthSubmitting,
    authMode,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    confirmPassword,
    setConfirmPassword,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    isPasswordRecovery,
    isForgotPassword,
    pendingConfirmation,
    setPendingConfirmation,
    handleSignIn,
    handleGoogleSignIn,
    handleSignUp,
    handleForgotPassword,
    handleUpdatePassword,
    cancelPasswordRecovery,
    startForgotPassword,
    cancelForgotPassword,
    startSignUpMode,
    backToSignInMode,
    handleSignOut,
  };
}