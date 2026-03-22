import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { getFighterIcon } from "../data/smashFighters";
import { getNoteSummaryLines } from "../utils/smashNoteModel";

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

export default function NoteItem({ note, onEdit, onDelete }) {
  const summaryLines = getNoteSummaryLines(note.sections);

  return (
    <View style={styles.card}>
      <Pressable style={styles.contentWrap} onPress={() => onEdit(note)}>
        <View style={styles.headerRow}>
          <View style={styles.matchupWrap}>
            <Image source={getFighterIcon(note.character)} style={styles.icon} />
            {note.opponent ? (
              <>
                <Text style={styles.versus}>vs</Text>
                <Image source={getFighterIcon(note.opponent)} style={styles.icon} />
              </>
            ) : null}
          </View>

          <View style={styles.titleWrap}>
            <Text style={styles.title}>{note.title || "Untitled note"}</Text>
            <Text style={styles.contextLabel}>
              {note.opponent ? `${note.character} vs ${note.opponent}` : `${note.character} general notes`}
            </Text>
          </View>

          <View style={[styles.typeChip, note.opponent ? styles.matchupChip : styles.generalChip]}>
            <Text style={styles.typeChipLabel}>{note.opponent ? "Matchup" : "General"}</Text>
          </View>
        </View>

        {summaryLines.length ? (
          <View style={styles.summaryWrap}>
            {summaryLines.map(([label, value]) => (
              <Text key={label} numberOfLines={2} style={styles.body}>
                <Text style={styles.bodyLabel}>{label}: </Text>
                {value}
              </Text>
            ))}
          </View>
        ) : (
          <Text numberOfLines={3} style={styles.body}>
            No content
          </Text>
        )}

        <Text style={styles.meta}>Updated {formatDate(note.updatedAt)}</Text>
      </Pressable>

      <View style={styles.actions}>
        <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => onEdit(note)}>
          <Text style={styles.actionLabel}>Edit</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => onDelete(note.id)}>
          <Text style={styles.actionLabel}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E6E8EB",
    boxShadow: "0px 2px 5px rgba(0,0,0,0.06)",
    elevation: 1,
  },
  contentWrap: {
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  matchupWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  icon: {
    width: 34,
    height: 34,
  },
  versus: {
    marginHorizontal: 4,
    fontSize: 11,
    fontWeight: "800",
    color: "#6B778C",
  },
  titleWrap: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A2B48",
    marginBottom: 4,
  },
  contextLabel: {
    fontSize: 12,
    color: "#6B778C",
    fontWeight: "600",
  },
  typeChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  generalChip: {
    backgroundColor: "#E8F4FF",
  },
  matchupChip: {
    backgroundColor: "#FFF1EA",
  },
  typeChipLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#20304E",
  },
  body: {
    fontSize: 14,
    color: "#4D5B72",
    lineHeight: 20,
    marginBottom: 6,
  },
  bodyLabel: {
    fontWeight: "800",
    color: "#20304E",
  },
  summaryWrap: {
    marginBottom: 6,
  },
  meta: {
    fontSize: 12,
    color: "#8A95A5",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  editBtn: {
    backgroundColor: "#D5E8FF",
  },
  deleteBtn: {
    backgroundColor: "#FFDCE0",
  },
  actionLabel: {
    fontWeight: "600",
    color: "#1E2A3A",
  },
});
