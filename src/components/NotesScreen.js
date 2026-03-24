import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
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
  const isDark = useColorScheme() === "dark";
  const mainOptions = getRosterFighters();
  const mainPickerValue = userMainCharacter || MAIN_NONE_VALUE;

  if (!selectedCharacter) {
    return (
      <View style={[styles.screen, isDark && styles.screenDark]}>
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <Text style={[styles.appTitle, isDark && styles.appTitleDark]}>SmashNotes</Text>
            <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>Pick a fighter, then drill into general or matchup notes.</Text>
            {userMainCharacter ? (
              <Text style={[styles.mainText, isDark && styles.mainTextDark]}>Current main: {userMainCharacter}</Text>
            ) : (
              <Text style={[styles.mainText, isDark && styles.mainTextDark]}>No main selected yet.</Text>
            )}
          </View>
          <Pressable style={[styles.signOutBtn, isDark && styles.signOutBtnDark]} onPress={onSignOut}>
            <Text style={[styles.signOutLabel, isDark && styles.signOutLabelDark]}>Sign out</Text>
          </Pressable>
        </View>

        {isNotesLoading ? (
          <View style={styles.syncRow}>
            <ActivityIndicator size="small" color="#FF6B3D" />
            <Text style={[styles.syncLabel, isDark && styles.syncLabelDark]}>Syncing notebook...</Text>
          </View>
        ) : null}

        <View style={styles.mainPickerBlock}>
          <Text style={[styles.mainPickerLabel, isDark && styles.mainPickerLabelDark]}>Main Character</Text>
          <View style={[styles.mainPickerWrap, isDark && styles.mainPickerWrapDark]}>
            <Picker
              selectedValue={mainPickerValue}
              onValueChange={(value) => onSetMainCharacter(value === MAIN_NONE_VALUE ? null : value)}
              enabled={!isMainSaving}
              style={[styles.mainPicker, isDark && styles.mainPickerDark]}
            >
              <Picker.Item label="No selected main" value={MAIN_NONE_VALUE} />
              {mainOptions.map((fighter) => (
                <Picker.Item key={fighter.name} label={fighter.name} value={fighter.name} />
              ))}
            </Picker>
          </View>
        </View>

        <TextInput
          style={[styles.search, isDark && styles.searchDark]}
          value={fighterSearch}
          onChangeText={setFighterSearch}
          placeholder="Search fighters"
          placeholderTextColor={isDark ? "#8A93A7" : "#98A2B3"}
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
              <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>No fighters found</Text>
              <Text style={[styles.emptyBody, isDark && styles.emptyBodyDark]}>Try a different search term.</Text>
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
    <View style={[styles.screen, isDark && styles.screenDark]}>
      <View style={styles.characterHeaderRow}>
        <Pressable style={[styles.backBtn, isDark && styles.backBtnDark]} onPress={onBackToRoster}>
          <Text style={styles.backBtnLabel}>Back</Text>
        </Pressable>
        <Pressable style={[styles.signOutBtn, isDark && styles.signOutBtnDark]} onPress={onSignOut}>
          <Text style={[styles.signOutLabel, isDark && styles.signOutLabelDark]}>Sign out</Text>
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
          <Text style={[styles.syncLabel, isDark && styles.syncLabelDark]}>Syncing notebook...</Text>
        </View>
      ) : null}

      {!isGeneralNotebook ? (
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabButton, isDark && styles.tabButtonDark, activeTab === "general" && styles.tabButtonActive]}
            onPress={() => onSelectTab("general")}
          >
            <Text style={[styles.tabLabel, isDark && styles.tabLabelDark, activeTab === "general" && styles.tabLabelActive]}>General</Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, isDark && styles.tabButtonDark, activeTab === "matchups" && styles.tabButtonActive]}
            onPress={() => onSelectTab("matchups")}
          >
            <Text style={[styles.tabLabel, isDark && styles.tabLabelDark, activeTab === "matchups" && styles.tabLabelActive]}>Matchups</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.characterContent}>
        {showingMatchups ? (
          <>
            <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>Opponent Select</Text>
            <TextInput
              style={[styles.search, isDark && styles.searchDark]}
              value={opponentSearch}
              onChangeText={setOpponentSearch}
              placeholder="Search opponents"
              placeholderTextColor={isDark ? "#8A93A7" : "#98A2B3"}
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
              <Text style={[styles.matchupHeading, isDark && styles.matchupHeadingDark]}>{selectedCharacter} vs {selectedOpponent}</Text>
            ) : (
              <View style={[styles.emptyStateCard, isDark && styles.emptyStateCardDark]}>
                <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>Pick an opponent</Text>
                <Text style={[styles.emptyBody, isDark && styles.emptyBodyDark]}>Choose a fighter above to open matchup-specific notes.</Text>
              </View>
            )}
          </>
        ) : null}

        {(!showingMatchups || selectedOpponent) ? (
          <>
            <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>Notebook</Text>
            <TextInput
              style={[styles.search, isDark && styles.searchDark]}
              value={noteSearch}
              onChangeText={setNoteSearch}
              placeholder={noteSearchPlaceholder}
              placeholderTextColor={isDark ? "#8A93A7" : "#98A2B3"}
            />

            {displayedNotes.length ? (
              displayedNotes.map((note) => (
                <NoteItem key={note.id} note={note} onEdit={onEditNote} onDelete={onDeleteNote} />
              ))
            ) : (
              <View style={[styles.emptyStateCard, isDark && styles.emptyStateCardDark]}>
                <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>No notes yet</Text>
                <Text style={[styles.emptyBody, isDark && styles.emptyBodyDark]}>
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
  screenDark: {
    backgroundColor: "#101521",
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
  appTitleDark: {
    color: "#ECF2FF",
  },
  subtitle: {
    marginTop: 4,
    color: "#5E6B80",
    fontSize: 14,
  },
  subtitleDark: {
    color: "#A8B5CB",
  },
  mainText: {
    marginTop: 6,
    color: "#20304E",
    fontWeight: "700",
    fontSize: 12,
  },
  mainTextDark: {
    color: "#C9D4E8",
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
  mainPickerLabelDark: {
    color: "#C9D4E8",
  },
  mainPickerWrap: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E6E8EB",
    overflow: "hidden",
  },
  mainPickerWrapDark: {
    backgroundColor: "#1B2333",
    borderColor: "#2A3449",
  },
  mainPicker: {
    color: "#1A2B48",
    height: 48,
  },
  mainPickerDark: {
    color: "#ECF2FF",
  },
  signOutBtn: {
    backgroundColor: "#EEF1F5",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  signOutBtnDark: {
    backgroundColor: "#273348",
  },
  signOutLabel: {
    color: "#1A2B48",
    fontWeight: "700",
    fontSize: 12,
  },
  signOutLabelDark: {
    color: "#ECF2FF",
  },
  backBtn: {
    backgroundColor: "#FFF3EE",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  backBtnDark: {
    backgroundColor: "#3A2B22",
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
  syncLabelDark: {
    color: "#A8B5CB",
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
  tabButtonDark: {
    backgroundColor: "#273348",
  },
  tabButtonActive: {
    backgroundColor: "#FF6B3D",
  },
  tabLabel: {
    color: "#20304E",
    fontWeight: "800",
  },
  tabLabelDark: {
    color: "#ECF2FF",
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
  searchDark: {
    backgroundColor: "#1B2333",
    borderColor: "#2A3449",
    color: "#ECF2FF",
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
  sectionTitleDark: {
    color: "#ECF2FF",
  },
  matchupHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#20304E",
    marginBottom: 12,
  },
  matchupHeadingDark: {
    color: "#ECF2FF",
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
  emptyStateCardDark: {
    backgroundColor: "#1B2333",
    borderColor: "#2A3449",
  },
  emptyTitle: {
    fontWeight: "700",
    fontSize: 20,
    color: "#1A2B48",
    marginBottom: 8,
  },
  emptyTitleDark: {
    color: "#ECF2FF",
  },
  emptyBody: {
    textAlign: "center",
    color: "#637083",
    lineHeight: 21,
  },
  emptyBodyDark: {
    color: "#A8B5CB",
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