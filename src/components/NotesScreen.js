import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme, useWindowDimensions } from "react-native";
import { GENERAL_FIGHTER_NAME, getFighterIcon, getRosterFighters } from "../data/smashFighters";
import FighterTile from "./FighterTile";
import NoteItem from "./NoteItem";
import SelectMenuButton from "./SelectMenuButton";
import StartGGScreen from "./StartGGScreen";
import { useStartGGSchedule } from "../hooks/useStartGG";

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
  recentNotes,
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
  onQuickCreateNote,
  onSignOut,
}) {
  const isDark = useColorScheme() === "dark";
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 980;
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [activeNavSection, setActiveNavSection] = useState("my-stuff");
  const { getTournamentsForDate, loading: tournamentsLoading } = useStartGGSchedule();
  const mainOptions = getRosterFighters();
  const mainMenuOptions = [
    { label: "No main", value: MAIN_NONE_VALUE },
    ...mainOptions.map((fighter) => ({ label: fighter.name, value: fighter.name })),
  ];
  const visibleRecentNotes = recentNotes;

  function handleSignOutFromMenu() {
    setIsAccountMenuOpen(false);
    onSignOut();
  }

  function handleMainMenuSelect(nextMain) {
    onSetMainCharacter(nextMain === MAIN_NONE_VALUE ? null : nextMain);
  }

  function handleCreateNoteFromStartGG(noteData) {
    // When creating a note from Start.gg data, switch back to notes view and create the note
    setActiveNavSection("my-stuff");
    onCreateNote(noteData);
  }

  // If we're showing Start.gg features, render that instead of the normal dashboard
  if (activeNavSection === "discovery" && !selectedCharacter) {
    return (
      <View style={[styles.dashboardShell, isDark && styles.dashboardShellDark]}>
        {isWideLayout ? (
          <View style={styles.sideRail}>
            <Text style={styles.sideBrand}>SmashNotes</Text>
            <Pressable 
              style={styles.sideNavItem} 
              onPress={() => setActiveNavSection("my-stuff")}
            >
              <Text style={styles.sideNavLabel}>My Stuff</Text>
            </Pressable>
            <Pressable style={styles.sidePrimaryNav}>
              <Text style={styles.sidePrimaryNavLabel}>Start.gg</Text>
            </Pressable>

            <View style={styles.sideBottomNav}>
              <Pressable style={styles.sideNavItem}>
                <Text style={styles.sideNavLabel}>Search</Text>
              </Pressable>
              <Pressable style={styles.sideNavItem}>
                <Text style={styles.sideNavLabel}>Chat</Text>
              </Pressable>
              <View style={styles.sideAccountAnchor}>
                <Pressable style={styles.sideNavItem} onPress={() => setIsAccountMenuOpen((current) => !current)}>
                  <Text style={styles.sideNavLabel}>Account</Text>
                </Pressable>
                {isAccountMenuOpen ? (
                  <View style={styles.accountDropdownSide}>
                    <Pressable style={styles.accountDropdownItem} onPress={handleSignOutFromMenu}>
                      <Text style={styles.accountDropdownLabel}>Sign out</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.dashboardMain}>
          {!isWideLayout && (
            <View style={styles.dashboardTopBar}>
              <Pressable
                style={styles.backToNotesBtn}  
                onPress={() => setActiveNavSection("my-stuff")}
              >
                <Text style={styles.backToNotesBtnLabel}>← My Stuff</Text>
              </Pressable>
              <Text style={styles.dashboardTitle}>Start.gg</Text>
            </View>
          )}
          <StartGGScreen onCreateNote={handleCreateNoteFromStartGG} />
        </View>
      </View>
    );
  }

  if (!selectedCharacter) {
    const scheduleDays = ["Today", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Monday"];

    return (
      <View style={[styles.dashboardShell, isDark && styles.dashboardShellDark]}>
        {isWideLayout ? (
          <View style={styles.sideRail}>
            <Text style={styles.sideBrand}>SmashNotes</Text>
            <Pressable style={styles.sidePrimaryNav}>
              <Text style={styles.sidePrimaryNavLabel}>My Stuff</Text>
            </Pressable>
            <Pressable 
              style={styles.sideNavItem}
              onPress={() => setActiveNavSection("discovery")}
            >
              <Text style={styles.sideNavLabel}>Start.gg</Text>
            </Pressable>

            <View style={styles.sideBottomNav}>
              <Pressable style={styles.sideNavItem}>
                <Text style={styles.sideNavLabel}>Search</Text>
              </Pressable>
              <Pressable style={styles.sideNavItem}>
                <Text style={styles.sideNavLabel}>Chat</Text>
              </Pressable>
              <View style={styles.sideAccountAnchor}>
                <Pressable style={styles.sideNavItem} onPress={() => setIsAccountMenuOpen((current) => !current)}>
                  <Text style={styles.sideNavLabel}>Account</Text>
                </Pressable>
                {isAccountMenuOpen ? (
                  <View style={styles.accountDropdownSide}>
                    <Pressable style={styles.accountDropdownItem} onPress={handleSignOutFromMenu}>
                      <Text style={styles.accountDropdownLabel}>Sign out</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.dashboardMain}>
          <View style={styles.dashboardTopBar}>
            <Text style={styles.dashboardTitle}>My Stuff</Text>
            <View style={styles.topBarActions}>
              {!isWideLayout && (
                <Pressable
                  style={styles.startggBtn}
                  onPress={() => setActiveNavSection("discovery")}
                >
                  <Text style={styles.startggBtnLabel}>🏆 Start.gg</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.dashboardAddNoteBtn}
                onPress={() => onQuickCreateNote(userMainCharacter || GENERAL_FIGHTER_NAME)}
              >
                <Text style={styles.dashboardAddNoteLabel}>+ Add note</Text>
              </Pressable>
              <SelectMenuButton
                value={userMainCharacter || MAIN_NONE_VALUE}
                options={mainMenuOptions}
                onSelect={handleMainMenuSelect}
                disabled={isMainSaving}
                onToggleOpen={(isOpen) => {
                  if (isOpen) {
                    setIsAccountMenuOpen(false);
                  }
                }}
                anchorStyle={styles.mainSwitcherAnchor}
                buttonStyle={styles.mainSwitcherBtn}
                labelStyle={styles.mainSwitcherLabel}
                caretStyle={styles.mainSwitcherCaret}
                dropdownStyle={styles.mainSwitcherDropdown}
                listStyle={styles.mainSwitcherList}
                itemStyle={styles.mainSwitcherItem}
                itemActiveStyle={styles.mainSwitcherItemActive}
                itemLabelStyle={styles.mainSwitcherItemLabel}
              />
              {!isWideLayout ? (
                <View style={styles.accountMenuAnchor}>
                  <Pressable style={styles.accountBtn} onPress={() => setIsAccountMenuOpen((current) => !current)}>
                    <Text style={styles.accountBtnLabel}>Account</Text>
                  </Pressable>
                  {isAccountMenuOpen ? (
                    <View style={styles.accountDropdown}>
                      <Pressable style={styles.accountDropdownItem} onPress={handleSignOutFromMenu}>
                        <Text style={styles.accountDropdownLabel}>Sign out</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dashboardContent}>
            <View style={styles.schedulePanel}>
              <View style={styles.schedulePillRow}>
                <View style={styles.schedulePillActive}>
                  <Text style={styles.schedulePillActiveLabel}>Up next</Text>
                </View>
                <View style={styles.schedulePill}>
                  <Text style={styles.schedulePillLabel}>Posts</Text>
                </View>
              </View>

              <View style={styles.scheduleGrid}>
                {scheduleDays.map((day, index) => {
                  // Calculate the date for each day
                  const currentDate = new Date();
                  currentDate.setDate(currentDate.getDate() + index);
                  const tournaments = getTournamentsForDate(currentDate);
                  
                  return (
                    <View key={day} style={styles.scheduleCol}>
                      <Text style={[styles.scheduleDayLabel, index === 0 && styles.scheduleDayLabelActive]}>{day}</Text>
                      <View style={[styles.scheduleCell, index === 0 && styles.scheduleCellActive]}>
                        <Text style={styles.scheduleDate}>{currentDate.getDate()}</Text>
                        
                        {/* Tournament indicators */}
                        {tournaments.length > 0 && (
                          <View style={styles.tournamentIndicators}>
                            {tournaments.slice(0, 2).map((tournament, tourIndex) => (
                              <View key={tournament.id} style={styles.tournamentPill}>
                                <Text style={styles.tournamentPillText} numberOfLines={1}>
                                  {tournament.isOnline ? '🌐 ' : '🏟️ '}
                                  {tournament.smashEvents.length > 0 ? '⚡ ' : ''}
                                  {tournament.name.length > 8 
                                    ? tournament.name.substring(0, 8) + '...' 
                                    : tournament.name}
                                </Text>
                              </View>
                            ))}
                            {tournaments.length > 2 && (
                              <View style={styles.tournamentMore}>
                                <Text style={styles.tournamentMoreText}>+{tournaments.length - 2}</Text>
                              </View>
                            )}
                          </View>
                        )}
                        
                        {/* Loading indicator */}
                        {tournamentsLoading && index === 0 && (
                          <ActivityIndicator size="small" color="#FF6B3D" style={styles.tournamentLoader} />
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.dashboardCard}>
              <View style={styles.dashboardCardHeader}>
                <Text style={styles.dashboardCardTitle}>Recent Notes</Text>
                <Text style={styles.dashboardCardMeta}>
                  {visibleRecentNotes.length} shown
                </Text>
              </View>

              {isNotesLoading ? (
                <View style={styles.syncRow}>
                  <ActivityIndicator size="small" color="#FF6B3D" />
                  <Text style={[styles.syncLabel, styles.syncLabelDark]}>Syncing notebook...</Text>
                </View>
              ) : null}

              <View style={styles.recentNotesWrap}>
                {visibleRecentNotes.map((note) => (
                  <NoteItem key={note.id} note={note} onEdit={onEditNote} onDelete={onDeleteNote} forceDark />
                ))}
              </View>

              {!visibleRecentNotes.length ? (
                <View style={styles.emptyWrap}>
                  <Text style={[styles.emptyTitle, styles.emptyTitleDark]}>No recent notes found</Text>
                  <Text style={[styles.emptyBody, styles.emptyBodyDark]}>Create a note or adjust your search.</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>
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
        <View style={styles.accountMenuAnchorCharacter}>
          <Pressable
            style={[styles.accountBtn, styles.accountBtnCharacter]}
            onPress={() => setIsAccountMenuOpen((current) => !current)}
          >
            <Text style={styles.accountBtnLabel}>Account</Text>
          </Pressable>
          {isAccountMenuOpen ? (
            <View style={styles.accountDropdownCharacter}>
              <Pressable style={styles.accountDropdownItem} onPress={handleSignOutFromMenu}>
                <Text style={styles.accountDropdownLabel}>Sign out</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
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
          <SelectMenuButton
            value={userMainCharacter || MAIN_NONE_VALUE}
            options={mainMenuOptions}
            onSelect={handleMainMenuSelect}
            disabled={isMainSaving}
            onToggleOpen={(isOpen) => {
              if (isOpen) {
                setIsAccountMenuOpen(false);
              }
            }}
            anchorStyle={styles.mainMenuAnchorHero}
            buttonStyle={styles.mainHeroButton}
            labelStyle={styles.mainHeroButtonLabel}
            caretStyle={styles.mainHeroButtonCaret}
            dropdownStyle={styles.mainHeroDropdown}
            listStyle={styles.mainHeroList}
            itemStyle={styles.mainHeroItem}
            itemActiveStyle={styles.mainHeroItemActive}
            itemLabelStyle={styles.mainHeroItemLabel}
            maxListHeight={198}
          />
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
                    : "Add a note for this fighter."}
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
  dashboardShell: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#060913",
  },
  dashboardShellDark: {
    backgroundColor: "#060913",
  },
  sideRail: {
    width: 150,
    paddingTop: 16,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: "#141C2E",
  },
  sideBrand: {
    color: "#F3F6FF",
    fontWeight: "900",
    marginBottom: 16,
    paddingHorizontal: 6,
    fontSize: 14,
  },
  sidePrimaryNav: {
    backgroundColor: "#1B2338",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  sidePrimaryNavLabel: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
  sideNavItem: {
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  sideNavLabel: {
    color: "#96A3BD",
    fontWeight: "700",
    fontSize: 12,
  },
  sideBottomNav: {
    marginTop: "auto",
    marginBottom: 10,
  },
  dashboardMain: {
    flex: 1,
  },
  dashboardTopBar: {
    position: "relative",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#141C2E",
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 100,
    elevation: 100,
  },
  dashboardTitle: {
    color: "#F0F4FF",
    fontSize: 19,
    fontWeight: "900",
  },
  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dashboardSearch: {
    minWidth: 210,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#242E47",
    backgroundColor: "#0F1628",
    color: "#ECF2FF",
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
  },
  dashboardAddNoteBtn: {
    borderRadius: 8,
    backgroundColor: "#2A4D9B",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dashboardAddNoteLabel: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
  startggBtn: {
    borderRadius: 8,
    backgroundColor: "#28a745",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  startggBtnLabel: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
  backToNotesBtn: {
    borderRadius: 6,
    backgroundColor: "#6c757d",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backToNotesBtnLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 12,
  },
  mainSwitcherAnchor: {
    position: "relative",
    minWidth: 180,
    zIndex: 400,
  },
  mainSwitcherBtn: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2C3855",
    backgroundColor: "#111A2D",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  mainSwitcherLabel: {
    color: "#ECF2FF",
    fontWeight: "700",
    fontSize: 12,
    flex: 1,
  },
  mainSwitcherCaret: {
    color: "#9FB0CF",
    fontSize: 11,
    fontWeight: "900",
  },
  mainSwitcherDropdown: {
    position: "absolute",
    top: 44,
    right: 0,
    minWidth: 220,
    maxWidth: 260,
    maxHeight: 260,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2D3957",
    backgroundColor: "#10192C",
    zIndex: 9999,
    elevation: 9999,
    paddingVertical: 6,
  },
  mainSwitcherList: {
    maxHeight: 220,
  },
  mainSwitcherItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mainSwitcherItemActive: {
    backgroundColor: "#1A2540",
  },
  mainSwitcherItemLabel: {
    color: "#ECF2FF",
    fontWeight: "700",
    fontSize: 12,
  },
  accountMenuAnchor: {
    position: "relative",
    zIndex: 120,
  },
  accountMenuAnchorCharacter: {
    position: "relative",
    zIndex: 120,
  },
  sideAccountAnchor: {
    position: "relative",
  },
  accountBtn: {
    borderRadius: 8,
    backgroundColor: "#1F2840",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  accountBtnCharacter: {
    backgroundColor: "#273348",
  },
  accountBtnLabel: {
    color: "#ECF2FF",
    fontWeight: "700",
    fontSize: 12,
  },
  accountDropdown: {
    position: "absolute",
    top: 42,
    right: 0,
    minWidth: 140,
    backgroundColor: "#10192C",
    borderColor: "#2D3957",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    zIndex: 999,
    elevation: 999,
  },
  accountDropdownCharacter: {
    position: "absolute",
    top: 42,
    right: 0,
    minWidth: 140,
    backgroundColor: "#1B2333",
    borderColor: "#2A3449",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    zIndex: 999,
    elevation: 999,
  },
  accountDropdownSide: {
    position: "absolute",
    bottom: 44,
    left: 0,
    minWidth: 130,
    backgroundColor: "#10192C",
    borderColor: "#2D3957",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    zIndex: 999,
    elevation: 999,
  },
  accountDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  accountDropdownLabel: {
    color: "#ECF2FF",
    fontWeight: "700",
    fontSize: 12,
  },
  dashboardSignOutBtn: {
    borderRadius: 8,
    backgroundColor: "#1F2840",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dashboardSignOutLabel: {
    color: "#ECF2FF",
    fontWeight: "700",
    fontSize: 12,
  },
  dashboardContent: {
    padding: 16,
    paddingBottom: 30,
  },
  schedulePanel: {
    borderWidth: 1,
    borderColor: "#1A2438",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#070C18",
    marginBottom: 12,
  },
  schedulePillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  schedulePillActive: {
    backgroundColor: "#F6F8FD",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  schedulePillActiveLabel: {
    color: "#111828",
    fontWeight: "900",
    fontSize: 12,
  },
  schedulePill: {
    borderRadius: 999,
    backgroundColor: "#151C2E",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  schedulePillLabel: {
    color: "#9DA8BF",
    fontWeight: "700",
    fontSize: 12,
  },
  scheduleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  scheduleCol: {
    width: 102,
  },
  scheduleDayLabel: {
    color: "#8B98B0",
    fontSize: 11,
    marginBottom: 5,
  },
  scheduleDayLabelActive: {
    color: "#F6F8FD",
    fontWeight: "700",
  },
  scheduleCell: {
    height: 84,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#242D45",
    backgroundColor: "#0E1324",
    padding: 7,
  },
  scheduleCellActive: {
    backgroundColor: "#1B1E30",
    borderColor: "#2D3552",
  },
  scheduleDate: {
    color: "#7E8BA5",
    fontSize: 10,
  },
  tournamentIndicators: {
    marginTop: 4,
    gap: 2,
  },
  tournamentPill: {
    backgroundColor: "#FF6B3D",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  tournamentPillText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "600",
  },
  tournamentMore: {
    backgroundColor: "#666",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  tournamentMoreText: {
    color: "#FFFFFF",
    fontSize: 7,
    fontWeight: "600",
  },
  tournamentLoader: {
    marginTop: 4,
    alignSelf: 'center',
  },
  dashboardCard: {
    borderWidth: 1,
    borderColor: "#1A2438",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#070C18",
    marginBottom: 12,
  },
  dashboardCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  dashboardCardTitle: {
    color: "#F4F7FF",
    fontSize: 20,
    fontWeight: "800",
  },
  dashboardCardMeta: {
    color: "#96A3BD",
    fontSize: 12,
    fontWeight: "700",
  },
  dashboardPickerWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2C3855",
    backgroundColor: "#111A2D",
    overflow: "hidden",
  },
  dashboardPicker: {
    color: "#ECF2FF",
    height: 48,
  },
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
    position: "relative",
    zIndex: 130,
    overflow: "visible",
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
    position: "relative",
    zIndex: 160,
  },
  mainPickerLabelHero: {
    color: "#D7DFEA",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  mainMenuAnchorHero: {
    position: "relative",
    zIndex: 180,
  },
  mainHeroButton: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#32435D",
    backgroundColor: "#182536",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  mainHeroButtonLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
  },
  mainHeroButtonCaret: {
    color: "#B7C4D8",
    fontSize: 11,
    fontWeight: "900",
  },
  mainHeroDropdown: {
    position: "absolute",
    top: 46,
    left: 0,
    right: 0,
    maxHeight: 240,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#32435D",
    backgroundColor: "#131F30",
    zIndex: 9999,
    elevation: 9999,
    paddingVertical: 6,
  },
  mainHeroList: {
    maxHeight: 198,
  },
  mainHeroItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mainHeroItemActive: {
    backgroundColor: "#20334B",
  },
  mainHeroItemLabel: {
    color: "#ECF2FF",
    fontSize: 12,
    fontWeight: "700",
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
  recentNotesWrap: {
    gap: 10,
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