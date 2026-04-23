import React, { useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { getRosterFighters } from "../data/smashFighters";
import Markdown from "react-native-markdown-display";

const SUGGESTED_QUESTIONS = [
  "What's the fastest out of shield option for {char}?",
  "What moves are safe on shield against Fox?",
  "What are {char}'s kill confirms?",
  "How do I edgeguard Mario?",
  "What's {char}'s best approach option?",
  "Compare Fox and Wolf's frame data",
];

function getApiUrl(path) {
  const backendHost =
    typeof window !== "undefined" && window.location && window.location.hostname
      ? window.location.hostname
      : "localhost";
  const isDeployed =
    backendHost &&
    backendHost !== "localhost" &&
    backendHost !== "127.0.0.1" &&
    !/^\d+\.\d+\.\d+\.\d+$/.test(backendHost);
  return isDeployed
    ? `${window.location.origin}${path}`
    : `http://${backendHost}:3001${path}`;
}

export default function SmashAskTab({ allNotes, userMainCharacter }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [myCharacter, setMyCharacter] = useState(userMainCharacter || "");
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [charSearch, setCharSearch] = useState("");
  const scrollRef = useRef(null);
  const { width } = useWindowDimensions();

  const roster = useMemo(() => getRosterFighters(), []);
  const filteredRoster = useMemo(() => {
    if (!charSearch.trim()) return roster;
    const q = charSearch.toLowerCase();
    return roster.filter((f) => f.name.toLowerCase().includes(q));
  }, [roster, charSearch]);

  const suggestions = useMemo(() => {
    return SUGGESTED_QUESTIONS.map((q) =>
      q.replace("{char}", myCharacter || "my character")
    );
  }, [myCharacter]);

  async function handleSend(questionOverride) {
    const question = (questionOverride || input).trim();
    if (!question || loading) return;

    const userMsg = { role: "user", text: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Scroll to bottom
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 100);

    try {
      const url = getApiUrl("/api/smash-ask");

      // Build lightweight notes context — only send sections, not full note objects
      const notesForContext = (allNotes || [])
        .filter((n) => n.sections && n.category === "matchup")
        .map((n) => ({
          character: n.character,
          opponent: n.opponent,
          title: n.title,
          sections: n.sections,
        }));

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          myCharacter: myCharacter || undefined,
          userNotes: notesForContext.length ? notesForContext : undefined,
        }),
      });

      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(
          rawText.length > 200
            ? "Server returned invalid response. Ollama may have timed out — try a simpler question."
            : rawText || "Empty response from server."
        );
      }

      if (!response.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "error", text: data.error || "Something went wrong." },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: data.answer,
            characters: data.characters,
            agents: data.agents,
            provider: data.provider,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "error",
          text: err.message || "Network error. Is the server running?",
        },
      ]);
    }

    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 100);
  }

  function handleClear() {
    setMessages([]);
  }

  // Character picker
  if (showCharPicker) {
    return (
      <View style={styles.container}>
        <View style={styles.pickerHeader}>
          <Pressable
            style={styles.pickerBackBtn}
            onPress={() => {
              setShowCharPicker(false);
              setCharSearch("");
            }}
          >
            <Text style={styles.pickerBackLabel}>{"<- Back"}</Text>
          </Pressable>
          <Text style={styles.pickerTitle}>Select Your Character</Text>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search fighters..."
          placeholderTextColor="#637083"
          value={charSearch}
          onChangeText={setCharSearch}
        />
        <ScrollView style={styles.rosterScroll} contentContainerStyle={styles.rosterGrid}>
          {filteredRoster.map((fighter) => (
            <Pressable
              key={fighter.name}
              style={[
                styles.fighterTile,
                myCharacter === fighter.name && styles.fighterTileActive,
              ]}
              onPress={() => {
                setMyCharacter(fighter.name);
                setShowCharPicker(false);
                setCharSearch("");
              }}
            >
              <Text
                style={[
                  styles.fighterName,
                  myCharacter === fighter.name && styles.fighterNameActive,
                ]}
              >
                {fighter.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.heading}>Ask AI</Text>
          <Text style={styles.subheading}>
            Powered by local frame data + your notes
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            style={styles.charBtn}
            onPress={() => setShowCharPicker(true)}
          >
            <Text style={styles.charBtnText}>
              {myCharacter || "Select character"}
            </Text>
          </Pressable>
          {messages.length > 0 && (
            <Pressable style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              Ask anything about Smash Ultimate
            </Text>
            <Text style={styles.emptySubtitle}>
              Frame data, matchups, punishes, kill confirms — answers are
              grounded in real data, not guesses.
            </Text>
            <View style={styles.suggestionsWrap}>
              {suggestions.map((q, i) => (
                <Pressable
                  key={i}
                  style={styles.suggestionChip}
                  onPress={() => handleSend(q)}
                >
                  <Text style={styles.suggestionText}>{q}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {messages.map((msg, i) => (
          <View
            key={i}
            style={[
              styles.messageBubble,
              msg.role === "user"
                ? styles.userBubble
                : msg.role === "error"
                ? styles.errorBubble
                : styles.assistantBubble,
            ]}
          >
            {msg.role !== "user" && (
              <Text style={styles.roleLabel}>
                {msg.role === "error" ? "Error" : "AI"}
              </Text>
            )}
            {msg.role === "assistant" ? (
              <Markdown style={markdownStyles}>{msg.text}</Markdown>
            ) : (
              <Text
                style={[
                  styles.messageText,
                  msg.role === "user" && styles.userText,
                  msg.role === "error" && styles.errorText,
                ]}
              >
                {msg.text}
              </Text>
            )}
            {(msg.agents || msg.characters || msg.provider) && (
              <View style={styles.pipelineInfo}>
                <View style={styles.agentChips}>
                  {msg.provider && (
                    <View style={[styles.agentChip, msg.provider === 'claude' ? styles.claudeChip : styles.ollamaChip]}>
                      <Text style={[styles.agentChipText, msg.provider === 'claude' ? styles.claudeChipText : styles.ollamaChipText]}>
                        {msg.provider === 'claude' ? 'Claude' : 'Ollama'}
                      </Text>
                    </View>
                  )}
                  {msg.agents?.length > 0 && msg.agents.map((a, i) => (
                    <View key={i} style={styles.agentChip}>
                      <Text style={styles.agentChipText}>{a}</Text>
                    </View>
                  ))}
                </View>
                {msg.characters?.length > 0 && (
                  <Text style={styles.contextLabel}>
                    {msg.characters.join(", ")}
                  </Text>
                )}
              </View>
            )}
          </View>
        ))}

        {loading && (
          <View style={[styles.messageBubble, styles.assistantBubble]}>
            <ActivityIndicator size="small" color="#FF6B3D" />
            <Text style={styles.thinkingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask about frame data, matchups, strategy..."
          placeholderTextColor="#637083"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
          editable={!loading}
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => handleSend()}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const markdownStyles = {
  body: { color: "#C0C8D8", fontSize: 14, lineHeight: 22 },
  heading1: { color: "#F4F7FF", fontSize: 20, fontWeight: "700", marginBottom: 8, marginTop: 4 },
  heading2: { color: "#F4F7FF", fontSize: 17, fontWeight: "700", marginBottom: 6, marginTop: 4 },
  heading3: { color: "#F4F7FF", fontSize: 15, fontWeight: "700", marginBottom: 4, marginTop: 4 },
  strong: { color: "#F4F7FF", fontWeight: "700" },
  em: { color: "#C0C8D8", fontStyle: "italic" },
  bullet_list: { marginTop: 4, marginBottom: 4 },
  ordered_list: { marginTop: 4, marginBottom: 4 },
  list_item: { marginBottom: 4 },
  bullet_list_icon: { color: "#FF6B3D", fontSize: 14, marginRight: 6 },
  ordered_list_icon: { color: "#FF6B3D", fontSize: 14, marginRight: 6 },
  code_inline: {
    backgroundColor: "#1B2333",
    color: "#34D399",
    fontFamily: "monospace",
    fontSize: 13,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  fence: {
    backgroundColor: "#1B2333",
    color: "#34D399",
    fontFamily: "monospace",
    fontSize: 13,
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  code_block: {
    backgroundColor: "#1B2333",
    color: "#34D399",
    fontFamily: "monospace",
    fontSize: 13,
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#FF6B3D",
    paddingLeft: 12,
    marginVertical: 6,
    backgroundColor: "rgba(255,107,61,0.06)",
    borderRadius: 4,
  },
  hr: { backgroundColor: "#2A3040", height: 1, marginVertical: 12 },
  table: { borderColor: "#2A3040" },
  tr: { borderBottomColor: "#2A3040" },
  th: { color: "#F4F7FF", fontWeight: "700", padding: 6 },
  td: { color: "#C0C8D8", padding: 6 },
  link: { color: "#6B9CFF", textDecorationLine: "underline" },
  paragraph: { marginTop: 0, marginBottom: 8 },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F1420",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1A2030",
    flexWrap: "wrap",
    gap: 8,
  },
  headerLeft: {},
  headerRight: {
    flexDirection: "row",
    gap: 8,
  },
  heading: {
    color: "#F4F7FF",
    fontSize: 20,
    fontWeight: "700",
  },
  subheading: {
    color: "#637083",
    fontSize: 12,
    marginTop: 2,
  },
  charBtn: {
    backgroundColor: "#1A2030",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#2A3040",
  },
  charBtnText: {
    color: "#FF6B3D",
    fontSize: 13,
    fontWeight: "600",
  },
  clearBtn: {
    backgroundColor: "#1A2030",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#2A3040",
  },
  clearBtnText: {
    color: "#637083",
    fontSize: 13,
    fontWeight: "600",
  },

  // Chat area
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 8,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: "#F4F7FF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    color: "#637083",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  suggestionsWrap: {
    marginTop: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: "#1A2030",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#2A3040",
  },
  suggestionText: {
    color: "#C0C8D8",
    fontSize: 13,
  },

  // Messages
  messageBubble: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    maxWidth: "85%",
  },
  userBubble: {
    backgroundColor: "#FF6B3D",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: "#1A2030",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#2A3040",
  },
  errorBubble: {
    backgroundColor: "rgba(248,113,113,0.1)",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
  },
  roleLabel: {
    color: "#FF6B3D",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  messageText: {
    color: "#C0C8D8",
    fontSize: 14,
    lineHeight: 22,
  },
  userText: {
    color: "#fff",
  },
  errorText: {
    color: "#F87171",
  },
  pipelineInfo: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#252D3D",
    paddingTop: 8,
  },
  agentChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 4,
  },
  agentChip: {
    backgroundColor: "rgba(255,107,61,0.12)",
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  agentChipText: {
    color: "#FF6B3D",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  claudeChip: {
    backgroundColor: "rgba(107,156,255,0.15)",
  },
  claudeChipText: {
    color: "#6B9CFF",
  },
  ollamaChip: {
    backgroundColor: "rgba(167,139,250,0.15)",
  },
  ollamaChipText: {
    color: "#A78BFA",
  },
  contextLabel: {
    color: "#637083",
    fontSize: 11,
    fontStyle: "italic",
  },
  thinkingText: {
    color: "#637083",
    fontSize: 13,
    marginLeft: 8,
  },

  // Input bar
  inputBar: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#1A2030",
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#1A2030",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A3040",
    padding: 12,
    color: "#F4F7FF",
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: "#FF6B3D",
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  // Character picker (reused from NotesImportTab)
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1A2030",
  },
  pickerBackBtn: {
    marginRight: 12,
  },
  pickerBackLabel: {
    color: "#FF6B3D",
    fontSize: 15,
    fontWeight: "600",
  },
  pickerTitle: {
    color: "#F4F7FF",
    fontSize: 18,
    fontWeight: "700",
  },
  searchInput: {
    backgroundColor: "#1A2030",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A3040",
    padding: 12,
    margin: 16,
    color: "#F4F7FF",
    fontSize: 14,
  },
  rosterScroll: {
    flex: 1,
  },
  rosterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    gap: 8,
  },
  fighterTile: {
    backgroundColor: "#1A2030",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#2A3040",
  },
  fighterTileActive: {
    borderColor: "#FF6B3D",
    backgroundColor: "rgba(255,107,61,0.12)",
  },
  fighterName: {
    color: "#C0C8D8",
    fontSize: 13,
    fontWeight: "500",
  },
  fighterNameActive: {
    color: "#FF6B3D",
  },
});
