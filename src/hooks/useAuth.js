import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { isRateLimitError } from "../utils/appHelpers";
import { fetchOrCreateUserMain, updateUserMain } from "../utils/cloudProfiles";

const MAIN_UPDATE_TIMEOUT_MS = 12000;

function withTimeout(promise, timeoutMs) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Main update request timed out."));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

export function useAuth({ showStatusPopup, showServerOverloadedPopup }) {
  const authEventSeq = useRef(0);
  const mainUpdateWatchdogRef = useRef(null);
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [userMain, setUserMain] = useState(null);
  const [isMainUpdating, setIsMainUpdating] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function hydrateUserMain(nextSession) {
      if (!nextSession?.user?.id) {
        if (isMounted) {
          setUserMain(null);
        }
        return;
      }

      try {
        const profileMain = await fetchOrCreateUserMain(nextSession.user.id);

        if (isMounted) {
          setUserMain(profileMain || null);
        }
      } catch (error) {
        if (isRateLimitError(error)) {
          showServerOverloadedPopup();
          return;
        }

        if (isMounted) {
          setUserMain(null);
        }

        showStatusPopup("error", "Profile error", "Could not load your saved main setting.");
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
        }

        await hydrateUserMain(initialSession || null);
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
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      const eventSeq = ++authEventSeq.current;
      const isStaleEvent = () => !isMounted || eventSeq !== authEventSeq.current;

      if (nextSession) {
        if (!isStaleEvent()) {
          setSession(nextSession);
          hydrateUserMain(nextSession);
        }
        return;
      }

      let recoveredSession = null;

      // Some auth events can transiently pass a null session.
      // Re-check before forcing the app back to the auth screen.
      try {
        const {
          data: { session: latestSession },
        } = await supabase.auth.getSession();

        recoveredSession = latestSession || null;
      } catch {
        // Ignore and keep current state if auth session check fails.
      }

      if (isStaleEvent()) {
        return;
      }

      if (recoveredSession) {
        setSession(recoveredSession);
        hydrateUserMain(recoveredSession);
        return;
      }

      if (event === "SIGNED_OUT") {
        setSession(null);
        hydrateUserMain(null);
      }
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

  async function handleUpdateMain(nextMainCharacter) {
    if (!session?.user?.id || nextMainCharacter === userMain) {
      return;
    }

    const previousMain = userMain;
    setUserMain(nextMainCharacter || null);
    setIsMainUpdating(true);
    clearTimeout(mainUpdateWatchdogRef.current);
    mainUpdateWatchdogRef.current = setTimeout(() => {
      setIsMainUpdating(false);
      showStatusPopup(
        "error",
        "Update timeout",
        "Saving your main took too long. Please try again."
      );
    }, MAIN_UPDATE_TIMEOUT_MS + 1000);

    try {
      await withTimeout(
        updateUserMain(session.user.id, nextMainCharacter || null),
        MAIN_UPDATE_TIMEOUT_MS
      );
      showStatusPopup(
        "success",
        "Main updated",
        nextMainCharacter ? `Your main is now ${nextMainCharacter}.` : "Your profile now has no main set."
      );
    } catch (error) {
      setUserMain(previousMain || null);

      if (isRateLimitError(error)) {
        showServerOverloadedPopup();
        return;
      }

      if (String(error?.message || "").toLowerCase().includes("timed out")) {
        showStatusPopup(
          "error",
          "Update timeout",
          "Saving your main took too long. Please try again."
        );
        return;
      }

      showStatusPopup(
        "error",
        "Update failed",
        error?.message ? `Could not save main: ${error.message}` : "Could not save your main fighter."
      );
    } finally {
      clearTimeout(mainUpdateWatchdogRef.current);
      setIsMainUpdating(false);
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
    userMain,
    isMainUpdating,
    handleSignIn,
    handleSignUp,
    handleSignOut,
    handleUpdateMain,
  };
}