import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { isRateLimitError } from "../utils/appHelpers";

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
    handleSignUp,
    handleSignOut,
  };
}