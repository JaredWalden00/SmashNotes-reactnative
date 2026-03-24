import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { GENERAL_FIGHTER_NAME, getFighterIcon, getRosterFighters } from "../data/smashFighters";
import FighterTile from "./FighterTile";
import NoteItem from "./NoteItem";

const MAIN_NONE_VALUE = "__none__";

export default function NotesScreen({
  isNotesLoading,
  fighterSearch,
  setFighterSearch,
  noteSearch,
  setNoteSearch,
  opponentSearch,
  setOpponentSearch,
  visibleFighters,
  visibleOpponents,
  fighterNoteCounts,
  selectedCharacter,
  selectedOpponent,
  userMainCharacter,
  isMainSaving,
  activeTab,
  onSelectCharacter,
  onSetMainCharacter,
  onBackToRoster,
  onSelectTab,
  onSelectOpponent,
  displayedNotes,
  canCreateMatchupNote,
  onEditNote,
  onDeleteNote,
  onCreateNote,
  onSignOut,
}) {
  const mainOptions = getRosterFighters();
  const mainPickerValue = userMainCharacter || MAIN_NONE_VALUE;

  if (!selectedCharacter) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <Text style={styles.appTitle}>SmashNotes</Text>
            <Text style={styles.subtitle}>Pick a fighter, then drill into general or matchup notes.</Text>
            {userMainCharacter ? (
              <Text style={styles.mainText}>Current main: {userMainCharacter}</Text>
            ) : (
              <Text style={styles.mainText}>No main selected yet.</Text>
            )}
          </View>
          <Pressable style={styles.signOutBtn} onPress={onSignOut}>
            <Text style={styles.signOutLabel}>Sign out</Text>
          </Pressable>
        </View>

        {isNotesLoading ? (
          <View style={styles.syncRow}>
            <ActivityIndicator size="small" color="#FF6B3D" />
            <Text style={styles.syncLabel}>Syncing notebook...</Text>
          </View>
        ) : null}

        <View style={styles.mainPickerBlock}>
          <Text style={styles.mainPickerLabel}>Main Character</Text>
          <View style={styles.mainPickerWrap}>
            <Picker
              selectedValue={mainPickerValue}
              onValueChange={(value) => onSetMainCharacter(value === MAIN_NONE_VALUE ? null : value)}
              enabled={!isMainSaving}
              style={styles.mainPicker}
            >
              <Picker.Item label="No selected main" value={MAIN_NONE_VALUE} />
              {mainOptions.map((fighter) => (
                <Picker.Item key={fighter.name} label={fighter.name} value={fighter.name} />
              ))}
            </Picker>
          </View>
        </View>

        <TextInput
          style={styles.search}
          value={fighterSearch}
          onChangeText={setFighterSearch}
          placeholder="Search fighters"
          placeholderTextColor="#98A2B3"
        />

        <FlatList
          data={visibleFighters}
          keyExtractor={(item) => item.name}
          numColumns={4}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <FighterTile
              fighter={item}
              count={fighterNoteCounts[item.name]}
              isMain={item.name === userMainCharacter}
              onPress={onSelectCharacter}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No fighters found</Text>
              <Text style={styles.emptyBody}>Try a different search term.</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </View>
    );
  }

  const isGeneralNotebook = selectedCharacter === GENERAL_FIGHTER_NAME;
  const showingMatchups = !isGeneralNotebook && activeTab === "matchups";
  const createLabel = showingMatchups ? "New Matchup Note" : "New Note";
  const noteSearchPlaceholder = showingMatchups
    ? `Search ${selectedCharacter} vs ${selectedOpponent || "matchup"} notes`
    : `Search ${selectedCharacter} notes`;

  return (
    <View style={styles.screen}>
      <View style={styles.characterHeaderRow}>
        <Pressable style={styles.backBtn} onPress={onBackToRoster}>
          <Text style={styles.backBtnLabel}>Back</Text>
        </Pressable>
        <Pressable style={styles.signOutBtn} onPress={onSignOut}>
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroIdentity}>
          <View style={styles.heroIconWrap}>
            <FighterTile
              fighter={{ name: selectedCharacter, icon: getFighterIcon(selectedCharacter) }}
              compact
              onPress={() => {}}
            />
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>{selectedCharacter}</Text>
            <Text style={styles.heroSubtitle}>
              {isGeneralNotebook
                ? "Universal reminders, habits, and tournament prep."
                : "Review general game plans or lock in matchup-specific notes."}
            </Text>
          </View>
        </View>
        <View style={styles.mainPickerBlockHero}>
          <Text style={styles.mainPickerLabelHero}>Main Character</Text>
          <View style={styles.mainPickerWrapHero}>
            <Picker
              selectedValue={mainPickerValue}
              onValueChange={(value) => onSetMainCharacter(value === MAIN_NONE_VALUE ? null : value)}
              enabled={!isMainSaving}
              style={styles.mainPickerHero}
              dropdownIconColor="#FFFFFF"
            >
              <Picker.Item label="No selected main" value={MAIN_NONE_VALUE} color="#FFFFFF" />
              {mainOptions.map((fighter) => (
                <Picker.Item key={fighter.name} label={fighter.name} value={fighter.name} color="#FFFFFF" />
              ))}
            </Picker>
          </View>
          {isMainSaving ? <Text style={styles.mainSavingText}>Saving main...</Text> : null}
        </View>
      </View>

      {isNotesLoading ? (
        <View style={styles.syncRow}>
          <ActivityIndicator size="small" color="#FF6B3D" />
          <Text style={styles.syncLabel}>Syncing notebook...</Text>
        </View>
      ) : null}

      {!isGeneralNotebook ? (
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabButton, activeTab === "general" && styles.tabButtonActive]}
            onPress={() => onSelectTab("general")}
          >
            <Text style={[styles.tabLabel, activeTab === "general" && styles.tabLabelActive]}>General</Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === "matchups" && styles.tabButtonActive]}
            onPress={() => onSelectTab("matchups")}
          >
            <Text style={[styles.tabLabel, activeTab === "matchups" && styles.tabLabelActive]}>Matchups</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.characterContent}>
        {showingMatchups ? (
          <>
            <Text style={styles.sectionTitle}>Opponent Select</Text>
            <TextInput
              style={styles.search}
              value={opponentSearch}
              onChangeText={setOpponentSearch}
              placeholder="Search opponents"
              placeholderTextColor="#98A2B3"
            />

            <View style={styles.gridWrap}>
              {visibleOpponents.map((fighter) => (
                <FighterTile
                  key={fighter.name}
                  fighter={fighter}
                  selected={fighter.name === selectedOpponent}
                  compact
                  onPress={onSelectOpponent}
                />
              ))}
            </View>

            {selectedOpponent ? (
              <Text style={styles.matchupHeading}>{selectedCharacter} vs {selectedOpponent}</Text>
            ) : (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyTitle}>Pick an opponent</Text>
                <Text style={styles.emptyBody}>Choose a fighter above to open matchup-specific notes.</Text>
              </View>
            )}
          </>
        ) : null}

        {(!showingMatchups || selectedOpponent) ? (
          <>
            <Text style={styles.sectionTitle}>Notebook</Text>
            <TextInput
              style={styles.search}
              value={noteSearch}
              onChangeText={setNoteSearch}
              placeholder={noteSearchPlaceholder}
              placeholderTextColor="#98A2B3"
            />

            {displayedNotes.length ? (
              displayedNotes.map((note) => (
                <NoteItem key={note.id} note={note} onEdit={onEditNote} onDelete={onDeleteNote} />
              ))
            ) : (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyTitle}>No notes yet</Text>
                <Text style={styles.emptyBody}>
                  {showingMatchups
                    ? "Start a matchup notebook for this pairing."
                    : "Add a general note for this fighter."}
                </Text>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      <Pressable
        style={[styles.fab, showingMatchups && !canCreateMatchupNote && styles.fabDisabled]}
        onPress={onCreateNote}
      >
        <Text style={styles.fabLabel}>+ {createLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
    backgroundColor: "#F6F7FB",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  titleWrap: {
    flex: 1,
    marginRight: 12,
  },
  appTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1A2B48",
  },
  subtitle: {
    marginTop: 4,
    color: "#5E6B80",
    fontSize: 14,
  },
  mainText: {
    marginTop: 6,
    color: "#20304E",
    fontWeight: "700",
    fontSize: 12,
  },
  mainPickerBlock: {
    marginBottom: 12,
  },
  mainPickerLabel: {
    color: "#20304E",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  mainPickerWrap: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E6E8EB",
    overflow: "hidden",
  },
  mainPicker: {
    color: "#1A2B48",
    height: 48,
  },
  signOutBtn: {
    backgroundColor: "#EEF1F5",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  signOutLabel: {
    color: "#1A2B48",
    fontWeight: "700",
    fontSize: 12,
  },
  backBtn: {
    backgroundColor: "#FFF3EE",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  backBtnLabel: {
    color: "#C14D22",
    fontWeight: "800",
    fontSize: 12,
  },
  characterHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  heroCard: {
    backgroundColor: "#1E2A3A",
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },
  heroIdentity: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroIconWrap: {
    width: 82,
    marginRight: 14,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  heroSubtitle: {
    color: "#D7DFEA",
    lineHeight: 20,
  },
  mainPickerBlockHero: {
    marginTop: 14,
  },
  mainPickerLabelHero: {
    color: "#D7DFEA",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  mainPickerWrapHero: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4A607A",
    backgroundColor: "#2A3C52",
    overflow: "hidden",
  },
  mainPickerHero: {
    color: "#FFFFFF",
    height: 48,
  },
  mainSavingText: {
    marginTop: 6,
    color: "#D7DFEA",
    fontSize: 12,
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  syncLabel: {
    color: "#637083",
    fontSize: 13,
  },
  tabRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    backgroundColor: "#EEF1F5",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: "#FF6B3D",
  },
  tabLabel: {
    color: "#20304E",
    fontWeight: "800",
  },
  tabLabelActive: {
    color: "#FFFFFF",
  },
  search: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E6E8EB",
    marginBottom: 12,
    color: "#1A2B48",
  },
  gridRow: {
    justifyContent: "space-between",
  },
  gridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  listContent: {
    paddingBottom: 92,
    flexGrow: 1,
  },
  characterContent: {
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#20304E",
    marginBottom: 10,
  },
  matchupHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#20304E",
    marginBottom: 12,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyStateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6E8EB",
    padding: 18,
    marginBottom: 12,
  },
  emptyTitle: {
    fontWeight: "700",
    fontSize: 20,
    color: "#1A2B48",
    marginBottom: 8,
  },
  emptyBody: {
    textAlign: "center",
    color: "#637083",
    lineHeight: 21,
  },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 18,
    backgroundColor: "#FF6B3D",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    boxShadow: "0px 5px 8px rgba(0,0,0,0.2)",
    elevation: 4,
  },
  fabDisabled: {
    opacity: 0.72,
  },
  fabLabel: {
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});