import { useRef, useCallback, useEffect, useState } from "react";
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
  `;
}

export default function LiveTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  minHeight = 260,
  style,
  toolbarStyle,
  editorStyle,
}) {
  const isDark = useColorScheme() === "dark";
  const editorRef = useRef(null);
  const styleRef = useRef(null);
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
      </View>

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
    borderColor: "#D8DDE5",
    backgroundColor: "#FFFFFF",
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
    borderBottomColor: "#E4E8EF",
    backgroundColor: "#F8FAFD",
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
    backgroundColor: "#DDE4F0",
  },
  toolbarBtnActiveDark: {
    backgroundColor: "#2A4D9B",
  },
  toolbarBtnLabel: {
    color: "#3A4A66",
    fontSize: 14,
    fontWeight: "700",
  },
  toolbarBtnLabelDark: {
    color: "#8A93A7",
  },
  toolbarBtnLabelActive: {
    color: "#1A2B48",
  },
  separator: {
    width: 1,
    height: 18,
    backgroundColor: "#D8DDE5",
    marginHorizontal: 4,
  },
  separatorDark: {
    backgroundColor: "#344158",
  },
  editorWrap: {
    flex: 1,
  },
});
