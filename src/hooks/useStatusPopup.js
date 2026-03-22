import { useCallback, useEffect, useState } from "react";

export function useStatusPopup() {
  const [statusPopup, setStatusPopup] = useState({
    visible: false,
    type: "info",
    title: "",
    message: "",
  });

  useEffect(() => {
    if (!statusPopup.visible || statusPopup.type === "error") {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setStatusPopup((current) => ({ ...current, visible: false }));
    }, 2500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [statusPopup.visible, statusPopup.type]);

  const showStatusPopup = useCallback((type, title, message) => {
    setStatusPopup({
      visible: true,
      type,
      title,
      message,
    });
  }, []);

  const closeStatusPopup = useCallback(() => {
    setStatusPopup((current) => ({ ...current, visible: false }));
  }, []);

  const showServerOverloadedPopup = useCallback(() => {
    showStatusPopup(
      "error",
      "Server overloaded",
      "Too many requests right now. Please wait a moment and try again."
    );
  }, [showStatusPopup]);

  return {
    statusPopup,
    showStatusPopup,
    closeStatusPopup,
    showServerOverloadedPopup,
  };
}