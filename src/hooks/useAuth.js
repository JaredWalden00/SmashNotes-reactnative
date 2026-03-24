import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../lib/supabase";
import { isRateLimitError } from "../utils/appHelpers";

WebBrowser.maybeCompleteAuthSession();

export function useAuth({ showStatusPopup, showServerOverloadedPopup }) {
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  useEffect(() => {
    let isMounted = true;

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
        }
      } catch (error) {
        if (isRateLimitError(error)) {
          showServerOverloadedPopup();
          return;
        }

        showStatusPopup("error", "Auth error", "Could not restore your login session.");
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    }

    bootstrapSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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
        showStatusPopup("success", "Signed in", "Welcome back. Your notes are ready.");
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
      const redirectTo = Linking.createURL("auth/callback");

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
          showStatusPopup("success", "Signed in", "Welcome back. Your notes are ready.");
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
          showStatusPopup("success", "Signed in", "Welcome back. Your notes are ready.");
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

  return {
    session,
    userId: session?.user?.id,
    isAuthLoading,
    isAuthSubmitting,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    pendingConfirmation,
    setPendingConfirmation,
    handleSignIn,
    handleGoogleSignIn,
    handleSignUp,
    handleSignOut,
  };
}