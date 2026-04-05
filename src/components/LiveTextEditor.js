import { useRef, useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

// createPortal only available on web
let createPortal = null;
if (Platform.OS === "web") {
  try { createPortal = require("react-dom").createPortal; } catch (e) {}
}
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  useColorScheme,
} from "react-native";

const TOOLBAR_ITEMS = [
  { cmd: "bold", label: "B", style: { fontWeight: "900" } },
  { cmd: "italic", label: "I", style: { fontStyle: "italic" } },
  { cmd: "underline", label: "U", style: { textDecorationLine: "underline" } },
  { cmd: "strikeThrough", label: "S", style: { textDecorationLine: "line-through" } },
  { cmd: "separator" },
  { cmd: "formatBlock-H1", label: "H1", style: { fontWeight: "900", fontSize: 11 } },
  { cmd: "formatBlock-H2", label: "H2", style: { fontWeight: "800", fontSize: 11 } },
  { cmd: "formatBlock-H3", label: "H3", style: { fontWeight: "700", fontSize: 11 } },
  { cmd: "separator" },
  { cmd: "insertUnorderedList", label: "\u2022", style: { fontSize: 16, fontWeight: "900" } },
  { cmd: "insertOrderedList", label: "1.", style: { fontWeight: "800", fontSize: 11 } },
  { cmd: "separator" },
  { cmd: "formatBlock-BLOCKQUOTE", label: "\u201C", style: { fontSize: 18, fontWeight: "800" } },
  { cmd: "formatBlock-PRE", label: "<>", style: { fontFamily: "monospace", fontSize: 11, fontWeight: "700" } },
];

const QUERY_COMMANDS = ["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList"];

// ---------------------------------------------------------------------------
// Discord / Markdown paste converter
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Returns true when the plain-text looks like it contains Discord / Markdown
 * formatting so we should run it through the converter instead of pasting raw.
 */
function looksLikeMarkdown(text) {
  return /(\*\*|__|~~|```|`[^`]+`|^#{1,3}\s|^>\s|^[-*]\s|^\d+\.\s)/m.test(text);
}

/**
 * Convert a Discord / Markdown string into HTML suitable for contentEditable.
 *
 * Supported syntax (matches Discord):
 *   **bold**  __underline__  *italic*  _italic_  ~~strikethrough~~
 *   ||spoiler||  (rendered as dimmed text)
 *   `inline code`   ```code blocks```  ```lang\ncode```
 *   # H1   ## H2   ### H3
 *   > blockquote (consecutive lines merged)
 *   - / * unordered list items
 *   1. ordered list items
 *   [text](url) links
 */
function discordMarkdownToHtml(text) {
  // ---- code blocks first (so nothing inside gets formatted) ----
  // ```lang\ncode``` or ```code```
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, _lang, code) => {
    return `\n<pre><code>${escapeHtml(code.replace(/\n$/, ""))}</code></pre>\n`;
  });

  // Split into lines for block-level processing
  const lines = text.split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // --- headings ---
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      out.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // --- blockquote (merge consecutive > lines) ---
    if (/^>\s/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${formatInline(quoteLines.join("<br>"))}</blockquote>`);
      continue;
    }

    // --- unordered list (- or *) ---
    if (/^[\-\*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[\-\*]\s+/.test(lines[i])) {
        items.push(`<li>${formatInline(lines[i].replace(/^[\-\*]\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // --- ordered list ---
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${formatInline(lines[i].replace(/^\d+\.\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // --- pre blocks already converted stay as-is ---
    if (line.startsWith("<pre>") || line.startsWith("</pre>")) {
      out.push(line);
      i++;
      continue;
    }

    // --- blank line ---
    if (line.trim() === "") {
      out.push("<br>");
      i++;
      continue;
    }

    // --- normal paragraph ---
    out.push(`<p>${formatInline(line)}</p>`);
    i++;
  }

  return out.join("");
}

/** Inline formatting (applied to text that is NOT inside a code block). */
function formatInline(text) {
  // Skip anything already wrapped in HTML tags (like <pre>)
  if (text.startsWith("<pre>")) return text;

  // inline code  `code`
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // links [text](url)
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2">$1</a>'
  );

  // bold  **text**
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // underline  __text__  (Discord-style)
  text = text.replace(/__(.+?)__/g, "<u>$1</u>");

  // strikethrough  ~~text~~
  text = text.replace(/~~(.+?)~~/g, "<s>$1</s>");

  // spoiler  ||text||  → dimmed span
  text = text.replace(
    /\|\|(.+?)\|\|/g,
    '<span style="background:#3A3A3A;color:#3A3A3A;border-radius:3px;padding:0 3px;cursor:pointer" onclick="this.style.color=\'inherit\';this.style.background=\'transparent\'">$1</span>'
  );

  // italic  *text*  or  _text_  (single, after bold/underline are done)
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
  text = text.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>");

  return text;
}

// ---------------------------------------------------------------------------
// HTML sanitizer — strips app-specific junk (Discord, Slack, etc.) down to
// clean semantic HTML the editor can style.
// ---------------------------------------------------------------------------

/** Tags we keep. Everything else is unwrapped (children kept) or dropped. */
const ALLOWED_TAGS = new Set([
  "P", "BR", "DIV",
  "STRONG", "B", "EM", "I", "U", "S", "DEL", "STRIKE",
  "H1", "H2", "H3",
  "UL", "OL", "LI",
  "BLOCKQUOTE", "PRE", "CODE",
  "A", "SPAN",
]);

/** Attributes we preserve per tag. */
const ALLOWED_ATTRS = { A: ["href"] };

/**
 * Parse an HTML string, strip all classes / styles / data-attrs / unwanted
 * tags, and return clean HTML.
 */
function sanitizeHtml(dirty) {
  const doc = new DOMParser().parseFromString(dirty, "text/html");
  return cleanNode(doc.body);
}

function cleanNode(node) {
  let html = "";

  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      html += escapeHtml(child.textContent);
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const tag = child.tagName;

    // Drop images, scripts, iframes, etc. entirely
    if (["SCRIPT", "STYLE", "IFRAME", "IMG", "SVG", "CANVAS", "VIDEO", "AUDIO", "OBJECT"].includes(tag)) {
      continue;
    }

    // Recurse into children
    const inner = cleanNode(child);

    if (ALLOWED_TAGS.has(tag)) {
      // Build opening tag with only allowed attributes
      const attrs = (ALLOWED_ATTRS[tag] || [])
        .map((attr) => {
          const val = child.getAttribute(attr);
          return val ? ` ${attr}="${escapeHtml(val)}"` : "";
        })
        .join("");

      // Convert DIV → P for cleaner output
      const outTag = tag === "DIV" ? "p" : tag.toLowerCase();
      html += `<${outTag}${attrs}>${inner}</${outTag}>`;
    } else {
      // Unwrap: keep the children, drop the tag
      html += inner;
    }
  }

  return html;
}

/**
 * Detect if HTML looks like it came from Discord (or similar chat apps)
 * so we know to sanitize rather than paste raw.
 */
function looksLikeAppHtml(html) {
  return (
    /scrollerInner|message-content|messageContent|chat-messages|data-list-id/i.test(html) ||
    /class="[^"]*(?:markup|chatContent|msgContent)/i.test(html) ||
    /font-family:\s*"?gg sans/i.test(html) ||
    /class="[^"]*(?:slack_|c-mrkdwn|p-rich_text)/i.test(html)
  );
}

function getEditorStyles(isDark) {
  const fg = isDark ? "#ECF2FF" : "#1A2B48";
  const placeholder = isDark ? "#5A6B84" : "#A0AABB";
  const codeBg = isDark ? "#1B2333" : "#F0F2F6";
  const borderColor = isDark ? "#344158" : "#D8DDE5";
  const quoteBorder = isDark ? "#4A5D7F" : "#D0D8E6";
  const quoteColor = isDark ? "#8A93A7" : "#5A6B84";
  const linkColor = isDark ? "#6B9CFF" : "#2A4D9B";

  return `
    [data-placeholder]:empty::before {
      content: attr(data-placeholder);
      color: ${placeholder};
      pointer-events: none;
      position: absolute;
    }
    .live-editor {
      position: relative;
      min-height: 100%;
      padding: 14px;
      color: ${fg};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      outline: none;
      word-wrap: break-word;
      overflow-wrap: break-word;
      white-space: pre-wrap;
    }
    .live-editor h1 { font-size: 24px; font-weight: 800; margin: 12px 0 6px; }
    .live-editor h2 { font-size: 20px; font-weight: 700; margin: 10px 0 4px; }
    .live-editor h3 { font-size: 17px; font-weight: 700; margin: 8px 0 4px; }
    .live-editor p { margin: 4px 0; }
    .live-editor a { color: ${linkColor}; }
    .live-editor ul, .live-editor ol { padding-left: 24px; margin: 6px 0; }
    .live-editor li { margin: 2px 0; }
    .live-editor blockquote {
      border-left: 3px solid ${quoteBorder};
      padding: 6px 12px;
      margin: 8px 0;
      color: ${quoteColor};
      font-style: italic;
    }
    .live-editor pre {
      background: ${codeBg};
      border: 1px solid ${borderColor};
      border-radius: 8px;
      padding: 10px 12px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      overflow-x: auto;
      margin: 8px 0;
    }
    .live-editor code {
      background: ${codeBg};
      padding: 2px 5px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
    }
    .live-editor strong { font-weight: 700; }
    .live-editor em { font-style: italic; }
    .live-editor u { text-decoration: underline; }
    .live-editor s { text-decoration: line-through; }
    .live-editor .fd-badge { cursor: grab; }
    .live-editor .fd-badge:active { cursor: grabbing; opacity: 0.7; }
    .live-editor .fd-drop-indicator {
      display: inline-block;
      width: 2px;
      height: 1.2em;
      background: #FF6B3D;
      vertical-align: middle;
      margin: 0 1px;
      border-radius: 1px;
      animation: fd-blink 0.8s ease-in-out infinite;
    }
    @keyframes fd-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  `;
}

import { searchMoves, formatMoveAsHtml, formatMoveDetailedHtml, getFrameDataCharacters } from "../utils/frameData";

export default function LiveTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  minHeight = 260,
  style,
  toolbarStyle,
  editorStyle,
  character,
}) {
  const isDark = useColorScheme() === "dark";

  // On native (non-web), fall back to a basic TextInput with a simple formatting bar
  if (Platform.OS !== "web") {
    const { TextInput: NativeTextInput, TouchableOpacity } = require("react-native");
    const nativeRef = useRef(null);
    const nativeSelectionRef = useRef({ start: 0, end: 0 });

    const insertMarkdown = (prefix, suffix) => {
      const text = value || "";
      const { start, end } = nativeSelectionRef.current;
      const selected = text.slice(start, end);
      const newText = text.slice(0, start) + prefix + selected + (suffix || prefix) + text.slice(end);
      if (onChange) onChange(newText);
    };

    return (
      <View style={[styles.container, isDark && styles.containerDark, style]}>
        {/* Simple formatting toolbar for native */}
        <View style={styles.nativeToolbar}>
          <TouchableOpacity style={styles.nativeToolbarBtn} onPress={() => insertMarkdown("**")}>
            <Text style={styles.nativeToolbarBtnText}>B</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nativeToolbarBtn} onPress={() => insertMarkdown("_")}>
            <Text style={[styles.nativeToolbarBtnText, { fontStyle: "italic" }]}>I</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nativeToolbarBtn} onPress={() => insertMarkdown("~~")}>
            <Text style={[styles.nativeToolbarBtnText, { textDecorationLine: "line-through" }]}>S</Text>
          </TouchableOpacity>
          <View style={styles.nativeToolbarSep} />
          <TouchableOpacity style={styles.nativeToolbarBtn} onPress={() => insertMarkdown("# ", "")}>
            <Text style={[styles.nativeToolbarBtnText, { fontSize: 11 }]}>H1</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nativeToolbarBtn} onPress={() => insertMarkdown("## ", "")}>
            <Text style={[styles.nativeToolbarBtnText, { fontSize: 11 }]}>H2</Text>
          </TouchableOpacity>
          <View style={styles.nativeToolbarSep} />
          <TouchableOpacity style={styles.nativeToolbarBtn} onPress={() => insertMarkdown("- ", "")}>
            <Text style={styles.nativeToolbarBtnText}>•</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nativeToolbarBtn} onPress={() => insertMarkdown("`")}>
            <Text style={[styles.nativeToolbarBtnText, { fontFamily: "monospace", fontSize: 13 }]}>&lt;&gt;</Text>
          </TouchableOpacity>
        </View>
        <NativeTextInput
          ref={nativeRef}
          style={[{
            minHeight,
            padding: 14,
            color: "#ECF2FF",
            fontSize: 16,
            lineHeight: 24,
            textAlignVertical: "top",
          }, editorStyle]}
          value={value || ""}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#5A6B84"
          multiline
          scrollEnabled={false}
          onSelectionChange={(e) => {
            nativeSelectionRef.current = e.nativeEvent.selection;
          }}
        />
      </View>
    );
  }
  const [fdOpen, setFdOpen] = useState(false);
  const [fdSearch, setFdSearch] = useState("");
  const [fdCharacter, setFdCharacter] = useState(character || "");
  const [fdFormat, setFdFormat] = useState("compact"); // "compact" or "detailed"
  const [fdHover, setFdHover] = useState(false);
  const [fdTooltipPos, setFdTooltipPos] = useState({ top: 0, left: 0 });
  const fdBtnRef = useRef(null);
  const fdResults = fdCharacter && fdSearch.trim() ? searchMoves(fdCharacter, fdSearch.trim()).slice(0, 8) : [];
  const editorRef = useRef(null);
  const styleRef = useRef(null);
  const savedSelectionRef = useRef(null);
  const [activeStates, setActiveStates] = useState({});
  const isInternalChange = useRef(false);
  const pollRef = useRef(null);

  // Inject <style> tag and set up the contentEditable div
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    // Create style element
    if (!styleRef.current) {
      styleRef.current = document.createElement("style");
      el.parentNode.insertBefore(styleRef.current, el);
    }
    styleRef.current.textContent = getEditorStyles(isDark);
  }, [isDark]);

  // Set initial content
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value && !el.innerHTML) {
      el.innerHTML = value;
    }
  }, []);

  // Continuously save cursor position whenever selection changes inside the editor
  useEffect(() => {
    if (typeof document === "undefined") return;
    function saveSelection() {
      const sel = window.getSelection?.();
      if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
        savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
      }
    }
    document.addEventListener("selectionchange", saveSelection);
    return () => document.removeEventListener("selectionchange", saveSelection);
  }, []);

  // Poll active formatting state
  useEffect(() => {
    pollRef.current = setInterval(() => {
      if (!document.activeElement || !editorRef.current?.contains(document.activeElement)) {
        return;
      }
      const states = {};
      QUERY_COMMANDS.forEach((cmd) => {
        try {
          states[cmd] = document.queryCommandState(cmd);
        } catch {
          states[cmd] = false;
        }
      });
      try {
        states.formatBlock = document.queryCommandValue("formatBlock");
      } catch {
        states.formatBlock = "";
      }
      setActiveStates(states);
    }, 400);

    return () => clearInterval(pollRef.current);
  }, []);

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el || !onChange) return;
    isInternalChange.current = true;
    onChange(el.innerHTML);
  }, [onChange]);

  const handlePaste = useCallback(
    (e) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const htmlData = clipboardData.getData("text/html");
      const plain = clipboardData.getData("text/plain");

      // 1) HTML from Discord / Slack / chat apps → sanitize it
      if (htmlData && looksLikeAppHtml(htmlData)) {
        e.preventDefault();
        const clean = sanitizeHtml(htmlData);
        document.execCommand("insertHTML", false, clean);
        if (onChange) {
          const el = editorRef.current;
          if (el) onChange(el.innerHTML);
        }
        return;
      }

      // 2) Plain text that looks like markdown → convert it
      if (!htmlData && plain && looksLikeMarkdown(plain)) {
        e.preventDefault();
        const html = discordMarkdownToHtml(plain);
        document.execCommand("insertHTML", false, html);
        if (onChange) {
          const el = editorRef.current;
          if (el) onChange(el.innerHTML);
        }
        return;
      }

      // 3) Everything else → let the browser paste natively
    },
    [onChange]
  );

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      document.execCommand("insertText", false, "    ");
    }
  }, []);

  // Drag and drop for FD badges
  const draggedBadgeRef = useRef(null);

  const handleDragStart = useCallback((e) => {
    const badge = e.target.closest(".fd-badge");
    if (!badge) return;
    draggedBadgeRef.current = badge;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", badge.outerHTML);
    badge.style.opacity = "0.4";
  }, []);

  const handleDragOver = useCallback((e) => {
    if (!draggedBadgeRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    // Show drop indicator at caret position
    const el = editorRef.current;
    if (!el) return;

    // Remove any existing drop indicators
    el.querySelectorAll(".fd-drop-indicator").forEach((ind) => ind.remove());

    // Get caret position from mouse coordinates
    let range;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(e.clientX, e.clientY);
    } else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }

    if (range && el.contains(range.startContainer)) {
      const indicator = document.createElement("span");
      indicator.className = "fd-drop-indicator";
      indicator.contentEditable = "false";
      range.insertNode(indicator);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    const badge = draggedBadgeRef.current;
    if (!badge) return;
    e.preventDefault();

    const el = editorRef.current;
    if (!el) return;

    // Remove drop indicators
    el.querySelectorAll(".fd-drop-indicator").forEach((ind) => ind.remove());

    // Get drop position
    let range;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(e.clientX, e.clientY);
    } else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }

    if (range && el.contains(range.startContainer)) {
      // Remove badge from old position
      badge.remove();
      // Insert at new position
      range.insertNode(badge);
      // Move cursor after the badge
      range.setStartAfter(badge);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    badge.style.opacity = "1";
    draggedBadgeRef.current = null;

    if (onChange) onChange(el.innerHTML);
  }, [onChange]);

  const handleDragEnd = useCallback((e) => {
    const el = editorRef.current;
    if (el) {
      el.querySelectorAll(".fd-drop-indicator").forEach((ind) => ind.remove());
    }
    if (draggedBadgeRef.current) {
      draggedBadgeRef.current.style.opacity = "1";
      draggedBadgeRef.current = null;
    }
  }, []);

  function execCommand(cmd) {
    const el = editorRef.current;
    if (!el) return;
    el.focus();

    if (cmd.startsWith("formatBlock-")) {
      const tag = cmd.split("-")[1];
      document.execCommand("formatBlock", false, tag);
    } else {
      document.execCommand(cmd, false, null);
    }

    // Update state immediately
    const states = {};
    QUERY_COMMANDS.forEach((c) => {
      try {
        states[c] = document.queryCommandState(c);
      } catch {
        states[c] = false;
      }
    });
    try {
      states.formatBlock = document.queryCommandValue("formatBlock");
    } catch {
      states.formatBlock = "";
    }
    setActiveStates(states);

    if (onChange) {
      onChange(el.innerHTML);
    }
  }

  function isActive(cmd) {
    if (cmd.startsWith("formatBlock-")) {
      const tag = cmd.split("-")[1].toLowerCase();
      return (activeStates.formatBlock || "").toLowerCase() === tag;
    }
    return !!activeStates[cmd];
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark, style]}>
      {/* Toolbar */}
      <View style={[styles.toolbar, isDark && styles.toolbarDark, toolbarStyle]}>
        {TOOLBAR_ITEMS.map((item, index) => {
          if (item.cmd === "separator") {
            return (
              <View
                key={`sep-${index}`}
                style={[styles.separator, isDark && styles.separatorDark]}
              />
            );
          }
          const active = isActive(item.cmd);
          return (
            <Pressable
              key={item.cmd}
              style={[
                styles.toolbarBtn,
                active && styles.toolbarBtnActive,
                active && isDark && styles.toolbarBtnActiveDark,
              ]}
              onPress={() => execCommand(item.cmd)}
            >
              <Text
                style={[
                  styles.toolbarBtnLabel,
                  isDark && styles.toolbarBtnLabelDark,
                  item.style,
                  active && styles.toolbarBtnLabelActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}

        {/* Frame Data button with hover preview */}
        <View style={[styles.separator, isDark && styles.separatorDark]} />
        <View style={styles.fdBtnWrap}>
          <Pressable
            ref={fdBtnRef}
            style={[styles.toolbarBtn, fdOpen && styles.toolbarBtnActive, fdOpen && isDark && styles.toolbarBtnActiveDark]}
            onPress={() => {
              if (!fdOpen) {
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
                  savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
                }
              }
              setFdOpen(!fdOpen);
              setFdSearch("");
            }}
            onHoverIn={() => {
              setFdHover(true);
              // Calculate tooltip position from button
              try {
                const node = fdBtnRef.current;
                const el = node?.getBoundingClientRect ? node : node?._nativeTag ? null : node;
                if (el && el.getBoundingClientRect) {
                  const rect = el.getBoundingClientRect();
                  setFdTooltipPos({ top: rect.bottom + 6, left: Math.max(8, rect.right - 280) });
                }
              } catch (e) {}
            }}
            onHoverOut={() => setFdHover(false)}
          >
            <Text style={[styles.toolbarBtnLabel, isDark && styles.toolbarBtnLabelDark, { fontSize: 10, fontWeight: "800" }, fdOpen && styles.toolbarBtnLabelActive]}>FD</Text>
          </Pressable>
          {fdHover && !fdOpen && createPortal && typeof document !== "undefined" && createPortal(
            <div style={{
              position: "fixed",
              top: fdTooltipPos.top,
              left: fdTooltipPos.left,
              width: 280,
              backgroundColor: isDark ? "#1B2333" : "#F8FAFD",
              borderRadius: 10,
              padding: 12,
              border: `1px solid ${isDark ? "#2A3449" : "#D8DDE5"}`,
              zIndex: 999999,
              boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.25)",
              pointerEvents: "none",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}>
              <div style={{ color: "#FF6B3D", fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Insert Frame Data</div>
              <div style={{ color: "#96A3BD", fontSize: 11, lineHeight: "16px", marginBottom: 8 }}>Search a character's moves and insert frame data into your note.</div>
              <div style={{ height: 1, backgroundColor: isDark ? "#2A3449" : "#D8DDE5", marginBottom: 8 }} />
              <div style={{ color: "#637083", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Compact — inline reference:</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#1E3254", borderRadius: 6, border: "1px solid #2A4D9B", padding: "3px 6px", marginBottom: 8 }}>
                <span style={{ color: "#FF6B3D", fontWeight: 700, fontSize: 12, marginRight: 2 }}>Nair</span>
                <span style={{ background: "#0F1A2E", borderRadius: 3, padding: "2px 6px", display: "inline-flex", gap: 3, alignItems: "baseline" }}>
                  <span style={{ color: "#637083", fontSize: 9, fontWeight: 600 }}>Startup</span>
                  <span style={{ color: "#ECF2FF", fontWeight: 700, fontSize: 11 }}>7</span>
                </span>
                <span style={{ background: "#0F1A2E", borderRadius: 3, padding: "2px 6px", display: "inline-flex", gap: 3, alignItems: "baseline" }}>
                  <span style={{ color: "#637083", fontSize: 9, fontWeight: 600 }}>Dmg</span>
                  <span style={{ color: "#ECF2FF", fontWeight: 700, fontSize: 11 }}>8.0%</span>
                </span>
                <span style={{ background: "#0F1A2E", borderRadius: 3, padding: "2px 6px", display: "inline-flex", gap: 3, alignItems: "baseline" }}>
                  <span style={{ color: "#637083", fontSize: 9, fontWeight: 600 }}>Shield</span>
                  <span style={{ color: "#F87171", fontWeight: 700, fontSize: 11 }}>-7</span>
                </span>
              </div>
              <div style={{ color: "#637083", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Detailed — full stat card:</div>
              <div style={{ background: "#141C2B", borderRadius: 8, border: "1px solid #2A3449", padding: "6px 8px" }}>
                <div style={{ color: "#FF6B3D", fontWeight: 800, fontSize: 12, borderBottom: "1px solid #2A3449", paddingBottom: 4, marginBottom: 4 }}>Bayonetta — Nair</div>
                <div style={{ display: "flex", gap: 12, fontSize: 10 }}>
                  <div><span style={{ color: "#96A3BD" }}>Startup </span><span style={{ color: "#ECF2FF", fontWeight: 700 }}>Frame 7</span></div>
                  <div><span style={{ color: "#96A3BD" }}>Damage </span><span style={{ color: "#ECF2FF", fontWeight: 700 }}>8.0%</span></div>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 10, marginTop: 2 }}>
                  <div><span style={{ color: "#96A3BD" }}>On Shield </span><span style={{ color: "#F87171", fontWeight: 700 }}>-7</span></div>
                  <div><span style={{ color: "#96A3BD" }}>Total </span><span style={{ color: "#ECF2FF", fontWeight: 700 }}>34 frames</span></div>
                </div>
              </div>
            </div>,
            document.body
          )}
        </View>
      </View>

      {/* Frame Data popup */}
      {fdOpen && (
        <View style={[styles.fdPopup, isDark && styles.fdPopupDark]}>
          <View style={styles.fdRow}>
            <select
              value={fdCharacter}
              onChange={(e) => setFdCharacter(e.target.value)}
              style={{
                flex: 1,
                backgroundColor: isDark ? "#141C2B" : "#F4F7FB",
                color: isDark ? "#ECF2FF" : "#1A2B48",
                border: `1px solid ${isDark ? "#344158" : "#D8DDE5"}`,
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 12,
                outline: "none",
              }}
            >
              <option value="">Select character...</option>
              {getFrameDataCharacters().map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <input
              type="text"
              value={fdSearch}
              onChange={(e) => setFdSearch(e.target.value)}
              placeholder="Search move (jab, nair, fsmash...)"
              style={{
                flex: 2,
                backgroundColor: isDark ? "#141C2B" : "#F4F7FB",
                color: isDark ? "#ECF2FF" : "#1A2B48",
                border: `1px solid ${isDark ? "#344158" : "#D8DDE5"}`,
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 12,
                outline: "none",
              }}
            />
            <View style={styles.fdFormatPicker}>
              <Pressable
                style={[styles.fdFormatBtn, fdFormat === "compact" && styles.fdFormatBtnActive]}
                onPress={() => setFdFormat("compact")}
              >
                <Text style={[styles.fdFormatBtnLabel, fdFormat === "compact" && styles.fdFormatBtnLabelActive]}>Compact</Text>
              </Pressable>
              <Pressable
                style={[styles.fdFormatBtn, fdFormat === "detailed" && styles.fdFormatBtnActive]}
                onPress={() => setFdFormat("detailed")}
              >
                <Text style={[styles.fdFormatBtnLabel, fdFormat === "detailed" && styles.fdFormatBtnLabelActive]}>Detailed</Text>
              </Pressable>
            </View>
            <Pressable style={styles.fdCloseBtn} onPress={() => setFdOpen(false)}>
              <Text style={styles.fdCloseBtnLabel}>Close</Text>
            </Pressable>
          </View>
          {fdResults.length > 0 && (
            <View style={styles.fdResults}>
              {fdResults.map((move, i) => (
                <Pressable
                  key={`${move.moveName}-${i}`}
                  style={[styles.fdResult, isDark && styles.fdResultDark]}
                  onPress={() => {
                    const html = fdFormat === "detailed"
                      ? formatMoveDetailedHtml(move, fdCharacter)
                      : formatMoveAsHtml(move, fdCharacter);
                    const el = editorRef.current;
                    if (el) {
                      el.focus();
                      // Restore saved cursor position
                      if (savedSelectionRef.current) {
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(savedSelectionRef.current);
                        savedSelectionRef.current = null;
                      }
                      document.execCommand("insertHTML", false, html);
                      if (onChange) onChange(el.innerHTML);
                    }
                    setFdOpen(false);
                    setFdSearch("");
                  }}
                >
                  <Text style={styles.fdMoveName}>{move.moveName}</Text>
                  <Text style={styles.fdMoveStats}>
                    {[
                      move.startup && move.startup !== "--" ? `${move.startup}f` : null,
                      move.baseDamage && move.baseDamage !== "--" ? `${move.baseDamage}%` : null,
                      move.advantage && move.advantage !== "--" ? `${move.advantage}` : null,
                    ].filter(Boolean).join(" | ")}
                  </Text>
                  <Text style={styles.fdMoveCat}>{move.categoryLabel}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {fdSearch.trim() && fdCharacter && fdResults.length === 0 && (
            <Text style={styles.fdNoResults}>No matching moves</Text>
          )}
          {!fdCharacter && (
            <Text style={styles.fdNoResults}>Select a character to search moves</Text>
          )}
        </View>
      )}

      {/* Editor area */}
      <View style={[styles.editorWrap, { minHeight }, editorStyle]}>
        <div
          ref={editorRef}
          className="live-editor"
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          style={{
            minHeight,
            outline: "none",
            cursor: "text",
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#344158",
    backgroundColor: "#141C2B",
    overflow: "hidden",
  },
  containerDark: {
    borderColor: "#344158",
    backgroundColor: "#141C2B",
  },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#2A3449",
    backgroundColor: "#1B2333",
  },
  toolbarDark: {
    borderBottomColor: "#2A3449",
    backgroundColor: "#1B2333",
  },
  toolbarBtn: {
    width: 32,
    height: 30,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarBtnActive: {
    backgroundColor: "#2A4D9B",
  },
  toolbarBtnActiveDark: {
    backgroundColor: "#2A4D9B",
  },
  toolbarBtnLabel: {
    color: "#8A93A7",
    fontSize: 14,
    fontWeight: "700",
  },
  toolbarBtnLabelDark: {
    color: "#8A93A7",
  },
  toolbarBtnLabelActive: {
    color: "#ECF2FF",
  },
  separator: {
    width: 1,
    height: 18,
    backgroundColor: "#344158",
    marginHorizontal: 4,
  },
  separatorDark: {
    backgroundColor: "#344158",
  },
  editorWrap: {
    flex: 1,
  },
  // Native toolbar
  nativeToolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#2A3449",
    backgroundColor: "#1B2333",
  },
  nativeToolbarBtn: {
    width: 34,
    height: 30,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  nativeToolbarBtnText: {
    color: "#8A93A7",
    fontSize: 15,
    fontWeight: "700",
  },
  nativeToolbarSep: {
    width: 1,
    height: 18,
    backgroundColor: "#344158",
    marginHorizontal: 4,
  },
  fdPopup: {
    backgroundColor: "#141C2B",
    borderBottomWidth: 1,
    borderBottomColor: "#2A3449",
    padding: 8,
  },
  fdPopupDark: {
    backgroundColor: "#141C2B",
    borderBottomColor: "#2A3449",
  },
  fdRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  fdCloseBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#2A3449",
  },
  fdCloseBtnLabel: {
    color: "#96A3BD",
    fontSize: 11,
    fontWeight: "700",
  },
  fdResults: {
    marginTop: 6,
    maxHeight: 200,
    overflow: "scroll",
  },
  fdResult: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 2,
    gap: 8,
  },
  fdResultDark: {
    backgroundColor: "#1B2333",
  },
  fdMoveName: {
    color: "#FF6B3D",
    fontWeight: "700",
    fontSize: 13,
    minWidth: 100,
  },
  fdMoveStats: {
    color: "#ECF2FF",
    fontSize: 12,
    flex: 1,
  },
  fdMoveCat: {
    color: "#637083",
    fontSize: 10,
  },
  fdNoResults: {
    color: "#637083",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
  },
  fdBtnWrap: {
    position: "static",
  },
  fdTooltip: {
    position: "fixed",
    width: 280,
    backgroundColor: "#1B2333",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2A3449",
    zIndex: 99999,
    boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
    pointerEvents: "none",
  },
  fdTooltipDark: {
    backgroundColor: "#1B2333",
    borderColor: "#2A3449",
    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
  },
  fdTooltipTitle: {
    color: "#FF6B3D",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  fdTooltipDesc: {
    color: "#96A3BD",
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  fdTooltipDivider: {
    height: 1,
    backgroundColor: "#2A3449",
    marginBottom: 8,
  },
  fdTooltipPreviewLabel: {
    color: "#637083",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 4,
  },
  fdTooltipPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E3254",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2A4D9B",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  fdTooltipMoveName: {
    color: "#FF6B3D",
    fontWeight: "700",
    fontSize: 12,
  },
  fdTooltipStats: {
    color: "#96A3BD",
    fontSize: 11,
  },
  fdTooltipDetailedPreview: {
    backgroundColor: "#141C2B",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2A3449",
    padding: 6,
  },
  fdTooltipDetailRow: {
    color: "#96A3BD",
    fontSize: 10,
    marginTop: 2,
  },
  fdFormatPicker: {
    flexDirection: "row",
    gap: 2,
    backgroundColor: "#0F1420",
    borderRadius: 6,
    padding: 2,
  },
  fdFormatBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  fdFormatBtnActive: {
    backgroundColor: "#FF6B3D",
  },
  fdFormatBtnLabel: {
    color: "#637083",
    fontSize: 11,
    fontWeight: "700",
  },
  fdFormatBtnLabelActive: {
    color: "#fff",
  },
});
