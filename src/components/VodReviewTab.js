import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { View, Text, Pressable, TextInput, ScrollView, useWindowDimensions, StyleSheet } from "react-native";
import LiveTextEditor from "./LiveTextEditor";
import NoteItem from "./NoteItem";

function extractYouTubeId(url) {
  if (!url) return null;
  let match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];
  match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];
  match = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];
  match = url.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];
  return null;
}

function formatTimestamp(seconds) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

const LAYOUTS = [
  { key: "side", label: "Side by Side" },
  { key: "stack", label: "Stacked" },
  { key: "video-top", label: "Video Top" },
];

export default function VodReviewTab({ allNotes, pendingVodNote, onClearPendingVodNote, onCreateVodNote, onEditNote, onDeleteNote, onSaveInlineEdit }) {
  const [urlInput, setUrlInput] = useState("");
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [activeUrl, setActiveUrl] = useState(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState(null); // null = new note, string = editing existing
  const [vodSearch, setVodSearch] = useState("");
  const [layout, setLayout] = useState("side");
  const [showPrevious, setShowPrevious] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const { width } = useWindowDimensions();

  // Auto-load a pending VOD note when navigating from another tab
  useEffect(() => {
    if (pendingVodNote && pendingVodNote.vodUrl) {
      const id = extractYouTubeId(pendingVodNote.vodUrl);
      if (id) {
        setActiveVideoId(id);
        setActiveUrl(pendingVodNote.vodUrl);
        setUrlInput(pendingVodNote.vodUrl);
        setNoteTitle(pendingVodNote.title || "");
        const sections = pendingVodNote.sections || {};
        const content = sections.overview || Object.values(sections).find((v) => v && v.trim()) || "";
        setNoteContent(content);
        setEditingNoteId(pendingVodNote.id);
        setBrowsing(false);
        setShowPrevious(false);
      }
      if (onClearPendingVodNote) onClearPendingVodNote();
    }
  }, [pendingVodNote]);
  const isNarrow = width < 800;
  const iframeRef = useRef(null);

  const effectiveLayout = isNarrow ? "stack" : layout;

  // Track if there's an active unsaved session
  const hasSession = activeVideoId && (noteTitle.trim() || noteContent.trim());

  const vodNotes = useMemo(() => {
    return (allNotes || [])
      .filter((n) => n.vodUrl)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [allNotes]);

  const filteredVodNotes = useMemo(() => {
    if (!vodSearch.trim()) return vodNotes;
    const q = vodSearch.trim().toLowerCase();
    return vodNotes.filter(
      (n) =>
        (n.title || "").toLowerCase().includes(q) ||
        (n.playerTag || "").toLowerCase().includes(q) ||
        (n.vodUrl || "").toLowerCase().includes(q) ||
        Object.values(n.sections || {}).some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [vodNotes, vodSearch]);

  function handleLoadVideo(url) {
    const target = url || urlInput.trim();
    const id = extractYouTubeId(target);
    if (id) {
      if (id !== activeVideoId) {
        setNoteTitle("");
        setNoteContent("");
        setEditingNoteId(null);
      }
      setActiveVideoId(id);
      setActiveUrl(target);
      setUrlInput(target);
      setShowPrevious(false);
      setBrowsing(false);
    }
  }

  function handleLoadFromNote(note) {
    const id = extractYouTubeId(note.vodUrl);
    if (id) {
      setActiveVideoId(id);
      setActiveUrl(note.vodUrl);
      setUrlInput(note.vodUrl);
      // Populate editor with the note's content
      setNoteTitle(note.title || "");
      // Get the first section with content as the editor value
      const sections = note.sections || {};
      const content = sections.overview || Object.values(sections).find((v) => v && v.trim()) || "";
      setNoteContent(content);
      setEditingNoteId(note.id);
      setShowPrevious(false);
      setBrowsing(false);
    }
  }

  function handleSaveNote() {
    if (!noteContent.trim() && !noteTitle.trim()) return;
    if (editingNoteId && onSaveInlineEdit) {
      // Update existing note
      onSaveInlineEdit(editingNoteId, noteTitle.trim() || "VOD Review", { overview: noteContent });
    } else if (onCreateVodNote) {
      // Create new note
      onCreateVodNote({
        vodUrl: activeUrl,
        title: noteTitle.trim() || "VOD Review",
        content: noteContent,
      });
    }
    setNoteTitle("");
    setNoteContent("");
    setEditingNoteId(null);
  }

  function handleNewNote() {
    setNoteTitle("");
    setNoteContent("");
    setEditingNoteId(null);
  }

  function handleBrowse() {
    setBrowsing(true);
  }

  function handleBackToSession() {
    setBrowsing(false);
  }

  // Get current time from YouTube iframe and insert timestamp
  const handleInsertTimestamp = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    // Post message to YouTube player to get current time
    // YouTube iframe API requires enablejsapi=1 and uses postMessage
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "getCurrentTime", args: [] }),
        "*"
      );
    } catch (e) {
      // Fallback: prompt user for time
      insertTimestampManual();
    }
  }, [activeVideoId]);

  function insertTimestampManual() {
    if (typeof window === "undefined") return;
    const input = window.prompt("Enter timestamp (e.g., 1:23 or 3:45:00):");
    if (!input) return;
    insertTimestampText(input.trim());
  }

  function insertTimestampText(timeStr) {
    // Parse time string to seconds for the link
    let totalSeconds = 0;
    const parts = timeStr.split(":").map(Number);
    if (parts.length === 3) totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) totalSeconds = parts[0] * 60 + parts[1];
    else totalSeconds = parts[0] || 0;

    const ytLink = `${activeUrl || ""}${activeUrl?.includes("?") ? "&" : "?"}t=${totalSeconds}`;
    const html = `<a href="${ytLink}" style="color:#FF6B3D;font-weight:700;text-decoration:none;">[${timeStr}]</a> `;

    // Insert at cursor in the active editor
    try {
      const editorEl = document.querySelector(".live-editor");
      if (editorEl) {
        editorEl.focus();
        document.execCommand("insertHTML", false, html);
        // Trigger input event so LiveTextEditor picks up the change
        editorEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch (e) {
      // Fallback: append to content
      setNoteContent((prev) => prev + html);
    }
  }

  // Listen for YouTube iframe API responses
  React.useEffect(() => {
    function handleMessage(event) {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data.event === "infoDelivery" && data.info?.currentTime != null) {
          const ts = formatTimestamp(data.info.currentTime);
          insertTimestampText(ts);
        }
      } catch (e) {
        // Not a YouTube message, ignore
      }
    }
    if (typeof window === "undefined" || !window.addEventListener) return;
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [activeUrl]);

  // Browse mode (no active video, or user clicked browse)
  if (!activeVideoId || browsing) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.browseContent}>
        {/* Resume session banner */}
        {hasSession && browsing && (
          <Pressable style={styles.resumeBanner} onPress={handleBackToSession}>
            <View style={styles.resumeInfo}>
              <Text style={styles.resumeTitle}>Session in progress</Text>
              <Text style={styles.resumeMeta}>{noteTitle || "Untitled"} — {activeUrl}</Text>
            </View>
            <Text style={styles.resumeBtn}>Resume</Text>
          </Pressable>
        )}

        {/* URL Input */}
        <View style={styles.urlSection}>
          <Text style={styles.urlLabel}>YouTube URL</Text>
          <View style={styles.urlRow}>
            <TextInput
              style={styles.urlInput}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="Paste a YouTube video URL..."
              placeholderTextColor="#637083"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={() => handleLoadVideo()}
            />
            <Pressable
              style={[styles.loadBtn, !urlInput.trim() && styles.loadBtnDisabled]}
              onPress={() => handleLoadVideo()}
              disabled={!urlInput.trim()}
            >
              <Text style={styles.loadBtnLabel}>Load</Text>
            </Pressable>
          </View>
          {urlInput.trim() && !extractYouTubeId(urlInput.trim()) && (
            <Text style={styles.urlError}>Invalid YouTube URL</Text>
          )}
        </View>

        {/* Previous VOD Reviews */}
        <View style={styles.previousSection}>
          <Text style={styles.previousTitle}>Previous VOD Reviews</Text>
          <Text style={styles.previousMeta}>{vodNotes.length} review{vodNotes.length !== 1 ? "s" : ""}</Text>

          {vodNotes.length > 0 && (
            <TextInput
              style={styles.searchInput}
              value={vodSearch}
              onChangeText={setVodSearch}
              placeholder="Search VOD reviews..."
              placeholderTextColor="#637083"
            />
          )}

          {filteredVodNotes.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🎬</Text>
              <Text style={styles.emptyTitle}>
                {vodNotes.length === 0 ? "No VOD reviews yet" : "No matching reviews"}
              </Text>
              <Text style={styles.emptyBody}>
                {vodNotes.length === 0
                  ? "Paste a YouTube URL above to start reviewing a VOD."
                  : "Try a different search term."}
              </Text>
            </View>
          ) : (
            filteredVodNotes.map((note) => (
              <View key={note.id} style={styles.vodNoteCard}>
                <Pressable style={styles.rewatchBtn} onPress={() => handleLoadFromNote(note)}>
                  <Text style={styles.rewatchBtnLabel}>Watch</Text>
                </Pressable>
                <NoteItem
                  note={note}
                  onEdit={() => handleLoadFromNote(note)}
                  onView={() => handleLoadFromNote(note)}
                  onDelete={onDeleteNote}
                  forceDark
                  compact
                />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    );
  }

  // Review mode — pinned layout
  const isSide = effectiveLayout === "side";

  return (
    <View style={styles.reviewShell}>
      {/* Top bar */}
      <View style={styles.reviewTopBar}>
        <Pressable style={styles.closVideoBtn} onPress={handleBrowse}>
          <Text style={styles.closeVideoBtnLabel}>← Browse</Text>
        </Pressable>
        <View style={styles.urlRowCompact}>
          <TextInput
            style={styles.urlInputCompact}
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="YouTube URL..."
            placeholderTextColor="#637083"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => handleLoadVideo()}
          />
          <Pressable style={styles.loadBtnCompact} onPress={() => handleLoadVideo()}>
            <Text style={styles.loadBtnLabel}>Load</Text>
          </Pressable>
        </View>
        {!isNarrow && (
          <View style={styles.layoutPicker}>
            {LAYOUTS.map((l) => (
              <Pressable
                key={l.key}
                style={[styles.layoutBtn, layout === l.key && styles.layoutBtnActive]}
                onPress={() => setLayout(l.key)}
              >
                <Text style={[styles.layoutBtnLabel, layout === l.key && styles.layoutBtnLabelActive]}>
                  {l.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <Pressable
          style={styles.previousToggle}
          onPress={() => setShowPrevious(!showPrevious)}
        >
          <Text style={styles.previousToggleLabel}>
            {showPrevious ? "Hide" : "History"} ({vodNotes.length})
          </Text>
        </Pressable>
      </View>

      {/* Main review area */}
      <View style={[styles.reviewBody, isSide && styles.reviewBodySide]}>
        {/* Video */}
        <View style={[
          styles.videoPane,
          isSide && styles.videoPaneSide,
          effectiveLayout === "video-top" && styles.videoPaneTop,
          effectiveLayout === "stack" && styles.videoPaneStack,
        ]}>
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${activeVideoId}?enablejsapi=1&origin=${typeof window !== "undefined" ? window.location.origin : ""}`}
            style={{ width: "100%", height: "100%", border: "none", borderRadius: 8 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </View>

        {/* Notes */}
        <View style={[
          styles.notesPane,
          isSide && styles.notesPaneSide,
          effectiveLayout === "video-top" && styles.notesPaneBottom,
          effectiveLayout === "stack" && styles.notesPaneStack,
        ]}>
          <View style={styles.notesTitleRow}>
            <TextInput
              style={styles.noteTitleInput}
              value={noteTitle}
              onChangeText={setNoteTitle}
              placeholder="Note title..."
              placeholderTextColor="#637083"
              maxLength={80}
            />
            <Pressable style={styles.timestampBtn} onPress={insertTimestampManual}>
              <Text style={styles.timestampBtnLabel}>🕐 Timestamp</Text>
            </Pressable>
          </View>
          <View style={styles.editorFlex}>
            <LiveTextEditor
              value={noteContent}
              onChange={setNoteContent}
              placeholder="Write your VOD notes here... Use the timestamp button to mark moments in the video."
              minHeight={120}
              style={styles.editorStretch}
            />
          </View>
          <View style={styles.saveRow}>
            {editingNoteId && (
              <Pressable style={styles.newNoteBtn} onPress={handleNewNote}>
                <Text style={styles.newNoteBtnLabel}>+ New</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.saveBtn, styles.saveBtnFlex, (!noteContent.trim() && !noteTitle.trim()) && styles.saveBtnDisabled]}
              onPress={handleSaveNote}
              disabled={!noteContent.trim() && !noteTitle.trim()}
            >
              <Text style={styles.saveBtnLabel}>{editingNoteId ? "Update Note" : "Save Note"}</Text>
            </Pressable>
          </View>
          {editingNoteId && (
            <Text style={styles.editingHint}>Editing existing note</Text>
          )}
        </View>
      </View>

      {/* Previous reviews slide-over */}
      {showPrevious && (
        <View style={styles.previousOverlay}>
          <View style={styles.previousPanel}>
            <View style={styles.previousPanelHeader}>
              <Text style={styles.previousTitle}>Previous Reviews</Text>
              <Pressable onPress={() => setShowPrevious(false)}>
                <Text style={styles.previousCloseLabel}>Close</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.searchInput}
              value={vodSearch}
              onChangeText={setVodSearch}
              placeholder="Search..."
              placeholderTextColor="#637083"
            />
            <ScrollView style={styles.previousList}>
              {filteredVodNotes.map((note) => (
                <View key={note.id} style={styles.vodNoteCard}>
                  <Pressable style={styles.rewatchBtn} onPress={() => handleLoadFromNote(note)}>
                    <Text style={styles.rewatchBtnLabel}>Watch</Text>
                  </Pressable>
                  <NoteItem
                    note={note}
                    onEdit={onEditNote}
                    onDelete={onDeleteNote}
                    onSave={onSaveInlineEdit}
                    forceDark
                    compact
                  />
                </View>
              ))}
              {filteredVodNotes.length === 0 && (
                <Text style={styles.emptyBody}>No VOD reviews found.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  browseContent: { padding: 16, paddingBottom: 40 },

  // Resume banner
  resumeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E3254",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A4D9B",
    gap: 12,
  },
  resumeInfo: { flex: 1 },
  resumeTitle: { color: "#6B9CFF", fontSize: 14, fontWeight: "800" },
  resumeMeta: { color: "#96A3BD", fontSize: 12, marginTop: 2 },
  resumeBtn: { color: "#FF6B3D", fontSize: 14, fontWeight: "800" },

  // URL input section
  urlSection: {
    backgroundColor: "#1B2333",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A3449",
  },
  urlLabel: { color: "#F4F7FF", fontSize: 16, fontWeight: "800", marginBottom: 10 },
  urlRow: { flexDirection: "row", gap: 10 },
  urlInput: {
    flex: 1,
    backgroundColor: "#141C2B",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#2A3449",
    color: "#ECF2FF",
    fontSize: 14,
  },
  urlError: { color: "#F87171", fontSize: 12, marginTop: 6 },
  loadBtn: {
    backgroundColor: "#FF6B3D",
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  loadBtnDisabled: { opacity: 0.4 },
  loadBtnLabel: { color: "#fff", fontWeight: "800", fontSize: 14 },

  // Review shell
  reviewShell: { flex: 1, backgroundColor: "#0F1420" },

  // Top bar
  reviewTopBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#1B2333",
    borderBottomWidth: 1,
    borderBottomColor: "#2A3449",
    flexWrap: "wrap",
  },
  closVideoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#2A3449",
  },
  closeVideoBtnLabel: { color: "#C9D4E8", fontWeight: "700", fontSize: 12 },
  urlRowCompact: { flexDirection: "row", flex: 1, gap: 6, minWidth: 200 },
  urlInputCompact: {
    flex: 1,
    backgroundColor: "#141C2B",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#2A3449",
    color: "#ECF2FF",
    fontSize: 13,
  },
  loadBtnCompact: {
    backgroundColor: "#FF6B3D",
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  layoutPicker: { flexDirection: "row", gap: 2 },
  layoutBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#141C2B",
  },
  layoutBtnActive: { backgroundColor: "#FF6B3D" },
  layoutBtnLabel: { color: "#96A3BD", fontSize: 11, fontWeight: "700" },
  layoutBtnLabelActive: { color: "#fff" },
  previousToggle: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#2A3449",
  },
  previousToggleLabel: { color: "#96A3BD", fontSize: 11, fontWeight: "700" },

  // Review body
  reviewBody: { flex: 1, flexDirection: "column" },
  reviewBodySide: { flexDirection: "row" },

  // Video pane
  videoPane: { backgroundColor: "#000", overflow: "hidden" },
  videoPaneSide: { flex: 1, minHeight: 300 },
  videoPaneTop: { height: "45%" },
  videoPaneStack: { height: "40%" },

  // Notes pane
  notesPane: {
    flex: 1,
    backgroundColor: "#1B2333",
    padding: 12,
    borderLeftWidth: 0,
    borderTopWidth: 1,
    borderColor: "#2A3449",
    flexDirection: "column",
  },
  notesPaneSide: { flex: 1, borderTopWidth: 0, borderLeftWidth: 1, maxWidth: "50%" },
  notesPaneBottom: { flex: 1 },
  notesPaneStack: { flex: 1 },
  notesTitleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  noteTitleInput: {
    flex: 1,
    backgroundColor: "#141C2B",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#2A3449",
    color: "#ECF2FF",
    fontSize: 14,
    fontWeight: "700",
  },
  timestampBtn: {
    backgroundColor: "#2A3449",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timestampBtnLabel: {
    color: "#FF6B3D",
    fontSize: 12,
    fontWeight: "700",
  },
  editorFlex: { flex: 1, minHeight: 100 },
  editorStretch: { flex: 1 },
  saveBtn: {
    backgroundColor: "#FF6B3D",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  saveBtnFlex: { flex: 1 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnLabel: { color: "#fff", fontWeight: "800", fontSize: 14 },
  saveRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  newNoteBtn: {
    backgroundColor: "#2A3449",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  newNoteBtnLabel: { color: "#6B9CFF", fontWeight: "700", fontSize: 13 },
  editingHint: { color: "#6B9CFF", fontSize: 11, marginTop: 4, textAlign: "center" },

  // Previous reviews overlay
  previousOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 380,
    maxWidth: "90%",
    backgroundColor: "#0F1420",
    borderLeftWidth: 1,
    borderColor: "#2A3449",
    zIndex: 100,
    boxShadow: "-4px 0 20px rgba(0,0,0,0.4)",
  },
  previousPanel: { flex: 1, padding: 14 },
  previousPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  previousCloseLabel: { color: "#FF6B3D", fontWeight: "700", fontSize: 13 },
  previousList: { flex: 1 },

  // Shared
  previousSection: {
    backgroundColor: "#1B2333",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A3449",
  },
  previousTitle: { color: "#F4F7FF", fontSize: 18, fontWeight: "800", marginBottom: 2 },
  previousMeta: { color: "#96A3BD", fontSize: 12, marginBottom: 12 },
  searchInput: {
    backgroundColor: "#141C2B",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#2A3449",
    color: "#ECF2FF",
    fontSize: 14,
    marginBottom: 12,
  },
  emptyWrap: { alignItems: "center", paddingVertical: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { color: "#F4F7FF", fontSize: 18, fontWeight: "800", marginBottom: 6 },
  emptyBody: { color: "#96A3BD", fontSize: 13, textAlign: "center", lineHeight: 20 },
  vodNoteCard: { marginBottom: 8 },
  rewatchBtn: {
    alignSelf: "flex-end",
    backgroundColor: "#2A4D9B",
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  rewatchBtnLabel: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
