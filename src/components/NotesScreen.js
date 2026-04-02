import RecentCharactersCard from "./RecentCharactersCard";
import RecentOpponentsCard from "./RecentOpponentsCard";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme, useWindowDimensions } from "react-native";
import { GENERAL_FIGHTER_NAME, getFighterIcon, getRosterFighters } from "../data/smashFighters";
import FighterTile from "./FighterTile";
import NoteItem from "./NoteItem";
import SelectMenuButton from "./SelectMenuButton";
import StartGGScreen from "./StartGGScreen";
import StatsTab from "./StatsTab";
import PlayersTab from "./PlayersTab";
import SettingsTab from "./SettingsTab";
import VodReviewTab from "./VodReviewTab";
import FrameDataTab from "./FrameDataTab";
import TournamentTab from "./TournamentTab";
import UpcomingTournamentCard from "./UpcomingTournamentCard";
import { matchesSmashNoteSearch } from "../utils/smashNoteModel";
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
  allNotes,
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
  onSaveInlineEdit,
  onCreateNote,
  onQuickCreateNote,
  onCreateNoteSilent,
  onSignOut,
  startggUser,
  startggIsAuthenticated,
  startggLogin,
  startggLogout,
  playerId,
  accessToken,
  session,
  userId,
}) {
  const isDark = useColorScheme() === "dark";
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 980;
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [activeNavSection, setActiveNavSection] = useState("my-stuff");
  const [filteredPlayerTag, setFilteredPlayerTag] = useState(null);
  const [filteredPlayerId, setFilteredPlayerId] = useState(null);
  const [showAllMatchups, setShowAllMatchups] = useState(false);
  const [allNotesSearch, setAllNotesSearch] = useState("");
  const [allNotesCharFilter, setAllNotesCharFilter] = useState(null);
  const [allNotesPlayerFilter, setAllNotesPlayerFilter] = useState("");
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [pendingVodNote, setPendingVodNote] = useState(null);

  function handleViewVod(note) {
    if (note && note.vodUrl) {
      setPendingVodNote(note);
      navigateTo("vod-review");
    }
  }

  function navigateTo(section) {
    setActiveNavSection(section);
    if (section === "my-stuff") {
      setDashboardRefreshKey((k) => k + 1);
    }
  }
  const { getTournamentsForDate, loading: tournamentsLoading } = useStartGGSchedule();
  const mainOptions = getRosterFighters();
  const mainMenuOptions = [
    { label: "No main", value: MAIN_NONE_VALUE },
    ...mainOptions.map((fighter) => ({ label: fighter.name, value: fighter.name, icon: fighter.icon })),
  ];
  const visibleRecentNotes = recentNotes;

  function handleSignOutFromMenu() {
    setIsAccountMenuOpen(false);
    onSignOut();
  }

  function handleMainMenuSelect(nextMain) {
    onSetMainCharacter(nextMain === MAIN_NONE_VALUE ? null : nextMain);
  }

  function handleStartGGLogin() {
    if (startggLogin) {
      startggLogin();
    }
  }

  function handleStartGGLogout() {
    if (startggLogout) {
      startggLogout();
    }
  }

  function handleCreateNoteFromStartGG(noteData) {
    // When creating a note from Start.gg data, switch back to notes view and create the note
    navigateTo("my-stuff");
    onCreateNote(noteData);
  }

  function renderAccountPanel(variant) {
    const panelStyle =
      variant === "side"
        ? styles.accountPanelSide
        : variant === "character"
          ? styles.accountPanelCharacter
          : styles.accountPanel;

    return (
      <View style={panelStyle}>
        {/* SmashNotes account */}
        <View style={styles.accountPanelSection}>
          <Text style={styles.accountPanelSectionTitle}>SmashNotes</Text>
          <Text style={styles.accountPanelConnected}>Signed in</Text>
        </View>

        <View style={styles.accountPanelDivider} />

        {/* Start.gg connection */}
        <View style={styles.accountPanelSection}>
          <Text style={styles.accountPanelSectionTitle}>Start.gg</Text>
          {startggIsAuthenticated && startggUser ? (
            <View>
              <View style={styles.accountPanelStartggUser}>
                <Text style={styles.accountPanelGamerTag}>
                  {startggUser.player?.gamerTag || startggUser.name || "Connected"}
                </Text>
                <Text style={styles.accountPanelConnected}>Connected</Text>
              </View>
              <Pressable style={styles.accountPanelStartggDisconnect} onPress={handleStartGGLogout}>
                <Text style={styles.accountPanelStartggDisconnectLabel}>Disconnect</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={styles.accountPanelStartggHint}>
                Connect Start.gg to see your recent characters, tournament history, and matchup data.
              </Text>
              <Pressable style={styles.accountPanelStartggBtn} onPress={handleStartGGLogin}>
                <Text style={styles.accountPanelStartggBtnLabel}>Connect Start.gg</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.accountPanelDivider} />

        {/* Sign out */}
        <Pressable style={styles.accountPanelSignOut} onPress={handleSignOutFromMenu}>
          <Text style={styles.accountPanelSignOutLabel}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  // All Notes view
  if (activeNavSection === "all-notes" && !selectedCharacter) {
    const ALL_CHARS_VALUE = "__all__";
    const charFilterOptions = [
      { label: "All Characters", value: ALL_CHARS_VALUE },
      ...getRosterFighters().map((f) => ({ label: f.name, value: f.name })),
    ];

    const filteredAllNotes = (allNotes || []).filter((note) => {
      if (allNotesCharFilter && allNotesCharFilter !== ALL_CHARS_VALUE) {
        if (note.character !== allNotesCharFilter) return false;
      }
      if (allNotesPlayerFilter.trim()) {
        const pf = allNotesPlayerFilter.trim().toLowerCase();
        const tag = (note.playerTag || "").toLowerCase();
        if (!tag.includes(pf)) return false;
      }
      if (allNotesSearch.trim()) {
        if (!matchesSmashNoteSearch(note, allNotesSearch)) return false;
      }
      return true;
    });

    return (
      <View style={[styles.dashboardShell, isDark && styles.dashboardShellDark]}>
        {isWideLayout ? renderSideRail("all-notes") : null}

        <View style={styles.dashboardMain}>
          <View style={styles.dashboardTopBar}>
            {!isWideLayout ? (
              <Pressable style={styles.backToNotesBtn} onPress={() => navigateTo("my-stuff")}>
                <Text style={styles.backToNotesBtnLabel}>← My Stuff</Text>
              </Pressable>
            ) : null}
            <Text style={styles.dashboardTitle}>All Notes</Text>
          </View>

          <View style={styles.allNotesFilters}>
            <TextInput
              style={[styles.search, styles.searchDark]}
              value={allNotesSearch}
              onChangeText={setAllNotesSearch}
              placeholder="Search all notes..."
              placeholderTextColor="#8A93A7"
            />
            <View style={styles.allNotesFilterRow}>
              <View style={styles.allNotesFilterItem}>
                <SelectMenuButton
                  value={allNotesCharFilter || ALL_CHARS_VALUE}
                  options={charFilterOptions}
                  onSelect={(v) => setAllNotesCharFilter(v === ALL_CHARS_VALUE ? null : v)}
                  searchable
                  searchPlaceholder="Search characters..."
                  anchorStyle={styles.allNotesFilterAnchor}
                  buttonStyle={styles.allNotesFilterBtn}
                  labelStyle={styles.allNotesFilterBtnLabel}
                  caretStyle={styles.allNotesFilterBtnCaret}
                  dropdownStyle={styles.allNotesFilterDropdown}
                  listStyle={styles.allNotesFilterList}
                  itemStyle={styles.allNotesFilterDropdownItem}
                  itemActiveStyle={styles.allNotesFilterDropdownItemActive}
                  itemLabelStyle={styles.allNotesFilterDropdownItemLabel}
                  maxListHeight={220}
                />
              </View>
              <TextInput
                style={[styles.allNotesPlayerInput, styles.searchDark]}
                value={allNotesPlayerFilter}
                onChangeText={setAllNotesPlayerFilter}
                placeholder="Filter by player tag..."
                placeholderTextColor="#8A93A7"
              />
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dashboardContent}>
            <View style={styles.dashboardCard}>
              <View style={styles.dashboardCardHeader}>
                <Text style={styles.dashboardCardTitle}>
                  {allNotesCharFilter && allNotesCharFilter !== ALL_CHARS_VALUE ? allNotesCharFilter + " Notes" : "All Notes"}
                </Text>
                <Text style={styles.dashboardCardMeta}>{filteredAllNotes.length} note{filteredAllNotes.length !== 1 ? "s" : ""}</Text>
              </View>
              {filteredAllNotes.length > 0 ? (
                <View style={styles.recentNotesWrap}>
                  {filteredAllNotes.map((note) => (
                    <NoteItem key={note.id} note={note} onEdit={onEditNote} onDelete={onDeleteNote} onSave={onSaveInlineEdit} onViewVod={handleViewVod} forceDark compact />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyWrap}>
                  <Text style={[styles.emptyTitle, styles.emptyTitleDark]}>No notes found</Text>
                  <Text style={[styles.emptyBody, styles.emptyBodyDark]}>Try adjusting your filters.</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  // Helper to render side rail nav for any tab
  function renderSideRail(activeSection) {
    const navItems = [
      { key: "my-stuff", label: "My Stuff" },
      { key: "all-notes", label: "All Notes" },
      { key: "tournaments", label: "Tournaments" },
      { key: "stats", label: "Stats" },
      { key: "players", label: "Players" },
      { key: "vod-review", label: "VOD Review" },
      { key: "frame-data", label: "Frame Data" },
    ];
    return (
      <View style={styles.sideRail}>
        <Text style={styles.sideBrand}>SmashNotes</Text>
        {navItems.map((item) => (
          <Pressable
            key={item.key}
            style={item.key === activeSection ? styles.sidePrimaryNav : styles.sideNavItem}
            onPress={() => item.key !== activeSection && navigateTo(item.key)}
          >
            <Text style={item.key === activeSection ? styles.sidePrimaryNavLabel : styles.sideNavLabel}>
              {item.label}
            </Text>
          </Pressable>
        ))}
        <View style={styles.sideBottomNav}>
          <Pressable
            style={activeSection === "settings" ? styles.sidePrimaryNav : styles.sideNavItem}
            onPress={() => navigateTo("settings")}
          >
            <Text style={activeSection === "settings" ? styles.sidePrimaryNavLabel : styles.sideNavLabel}>Settings</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Helper for mobile top bar nav buttons
  function renderMobileNav(activeSection) {
    const navItems = [
      { key: "all-notes", label: "All Notes" },
      { key: "tournaments", label: "Tournaments" },
      { key: "stats", label: "Stats" },
      { key: "players", label: "Players" },
      { key: "vod-review", label: "VOD Review" },
      { key: "frame-data", label: "Frame Data" },
      { key: "settings", label: "Settings" },
    ];
    return navItems
      .filter((item) => item.key !== activeSection)
      .map((item) => (
        <Pressable key={item.key} style={styles.startggBtn} onPress={() => navigateTo(item.key)}>
          <Text style={styles.startggBtnLabel}>{item.label}</Text>
        </Pressable>
      ));
  }

  // Stats tab
  // Tournaments tab
  if (activeNavSection === "tournaments" && !selectedCharacter) {
    return (
      <View style={[styles.dashboardShell, isDark && styles.dashboardShellDark]}>
        {isWideLayout ? renderSideRail("tournaments") : null}
        <View style={styles.dashboardMain}>
          <View style={styles.dashboardTopBar}>
            {!isWideLayout && (
              <Pressable style={styles.backToNotesBtn} onPress={() => navigateTo("my-stuff")}>
                <Text style={styles.backToNotesBtnLabel}>← My Stuff</Text>
              </Pressable>
            )}
            <Text style={styles.dashboardTitle}>Tournaments</Text>
          </View>
          <TournamentTab
            allNotes={allNotes}
            accessToken={accessToken}
            playerGamerTag={startggUser?.player?.gamerTag}
            onCreateNoteSilent={onCreateNoteSilent}
            onEditNote={onEditNote}
            onDeleteNote={onDeleteNote}
            onSaveInlineEdit={onSaveInlineEdit}
            onViewVod={handleViewVod}
          />
        </View>
      </View>
    );
  }

  if (activeNavSection === "stats" && !selectedCharacter) {
    return (
      <View style={[styles.dashboardShell, isDark && styles.dashboardShellDark]}>
        {isWideLayout ? renderSideRail("stats") : null}
        <View style={styles.dashboardMain}>
          <View style={styles.dashboardTopBar}>
            {!isWideLayout && (
              <Pressable style={styles.backToNotesBtn} onPress={() => navigateTo("my-stuff")}>
                <Text style={styles.backToNotesBtnLabel}>← My Stuff</Text>
              </Pressable>
            )}
            <Text style={styles.dashboardTitle}>Stats</Text>
          </View>
          <StatsTab
            playerId={playerId}
            accessToken={accessToken}
            onCreateSetNote={(setData) => {
              onQuickCreateNote(GENERAL_FIGHTER_NAME, {
                setId: setData.setId,
                setTournament: setData.setTournament,
                setEvent: setData.setEvent,
                setScore: setData.setScore,
                playerTag: setData.playerTag,
                opponent: setData.playerTag,
              });
            }}
          />
        </View>
      </View>
    );
  }

  // Players tab
  if (activeNavSection === "players" && !selectedCharacter) {
    return (
      <View style={[styles.dashboardShell, isDark && styles.dashboardShellDark]}>
        {isWideLayout ? renderSideRail("players") : null}
        <View style={styles.dashboardMain}>
          <View style={styles.dashboardTopBar}>
            {!isWideLayout && (
              <Pressable style={styles.backToNotesBtn} onPress={() => navigateTo("my-stuff")}>
                <Text style={styles.backToNotesBtnLabel}>← My Stuff</Text>
              </Pressable>
            )}
            <Text style={styles.dashboardTitle}>Players</Text>
          </View>
          <PlayersTab
            allNotes={allNotes}
            accessToken={accessToken}
            playerId={playerId}
            onEditNote={onEditNote}
            onDeleteNote={onDeleteNote}
            onSaveInlineEdit={onSaveInlineEdit}
            onViewVod={handleViewVod}
            onTrackPlayer={(playerData) => {
              onCreateNoteSilent({
                title: `${playerData.gamerTag} — Player Notes`,
                playerTag: playerData.gamerTag,
                startggPlayerId: playerData.playerId,
                content: "",
              });
            }}
          />
        </View>
      </View>
    );
  }

  // Settings tab
  // VOD Review tab
  if (activeNavSection === "vod-review" && !selectedCharacter) {
    return (
      <View style={[styles.dashboardShell, isDark && styles.dashboardShellDark]}>
        {isWideLayout ? renderSideRail("vod-review") : null}
        <View style={styles.dashboardMain}>
          <View style={styles.dashboardTopBar}>
            {!isWideLayout && (
              <Pressable style={styles.backToNotesBtn} onPress={() => navigateTo("my-stuff")}>
                <Text style={styles.backToNotesBtnLabel}>← My Stuff</Text>
              </Pressable>
            )}
            <Text style={styles.dashboardTitle}>VOD Review</Text>
          </View>
          <VodReviewTab
            allNotes={allNotes}
            pendingVodNote={pendingVodNote}
            onClearPendingVodNote={() => setPendingVodNote(null)}
            onCreateVodNote={(vodData) => {
              onCreateNoteSilent({
                vodUrl: vodData.vodUrl,
                title: vodData.title,
                content: vodData.content,
              });
            }}
            onEditNote={onEditNote}
            onDeleteNote={onDeleteNote}
            onSaveInlineEdit={onSaveInlineEdit}
          />
        </View>
      </View>
    );
  }

  // Frame Data tab
  if (activeNavSection === "frame-data" && !selectedCharacter) {
    return (
      <View style={[styles.dashboardShell, isDark && styles.dashboardShellDark]}>
        {isWideLayout ? renderSideRail("frame-data") : null}
        <View style={styles.dashboardMain}>
          <View style={styles.dashboardTopBar}>
            {!isWideLayout && (
              <Pressable style={styles.backToNotesBtn} onPress={() => navigateTo("my-stuff")}>
                <Text style={styles.backToNotesBtnLabel}>← My Stuff</Text>
              </Pressable>
            )}
            <Text style={styles.dashboardTitle}>Frame Data</Text>
          </View>
          <FrameDataTab />
        </View>
      </View>
    );
  }

  if (activeNavSection === "settings" && !selectedCharacter) {
    const MAIN_NONE = "__none__";
    const settingsMainOptions = [
      { label: "No main", value: MAIN_NONE },
      ...getRosterFighters().map((f) => ({ label: f.name, value: f.name, icon: f.icon })),
    ];
    return (
      <View style={[styles.dashboardShell, isDark && styles.dashboardShellDark]}>
        {isWideLayout ? renderSideRail("settings") : null}
        <View style={styles.dashboardMain}>
          <View style={styles.dashboardTopBar}>
            {!isWideLayout && (
              <Pressable style={styles.backToNotesBtn} onPress={() => navigateTo("my-stuff")}>
                <Text style={styles.backToNotesBtnLabel}>← My Stuff</Text>
              </Pressable>
            )}
            <Text style={styles.dashboardTitle}>Settings</Text>
          </View>
          <SettingsTab
            startggUser={startggUser}
            startggIsAuthenticated={startggIsAuthenticated}
            startggLogin={startggLogin}
            startggLogout={startggLogout}
            userMainCharacter={userMainCharacter}
            onSetMainCharacter={onSetMainCharacter}
            mainMenuOptions={settingsMainOptions}
            isMainSaving={isMainSaving}
            onSignOut={onSignOut}
            allNotes={allNotes}
            userId={userId}
            session={session}
          />
        </View>
      </View>
    );
  }

  // If we're showing Start.gg features, render that instead of the normal dashboard
  // Full "Most Played Against" page
  if (!selectedCharacter && showAllMatchups) {
    return (
      <View style={[styles.dashboardShell, isDark && styles.dashboardShellDark]}>
        <View style={styles.dashboardMain}>
          <View style={styles.dashboardTopBar}>
            <Pressable
              style={styles.backToNotesBtn}
              onPress={() => setShowAllMatchups(false)}
            >
              <Text style={styles.backToNotesBtnLabel}>← Back</Text>
            </Pressable>
            <Text style={styles.dashboardTitle}>Most Played Against</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dashboardContent}>
            <View style={styles.dashboardCard}>
              <RecentCharactersCard
                playerId={playerId}
                accessToken={accessToken}
                refreshKey={dashboardRefreshKey}
                showAll
                onSelectCharacter={(characterName) => {
                  setShowAllMatchups(false);
                  if (onSelectCharacter) onSelectCharacter(characterName);
                }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  // Opponent notes filtered view
  if (!selectedCharacter && filteredPlayerTag) {
    const opponentNotes = (allNotes || []).filter(
      (n) =>
        (n.startggPlayerId && String(n.startggPlayerId) === String(filteredPlayerId)) ||
        (n.playerTag && n.playerTag.toLowerCase() === filteredPlayerTag.toLowerCase())
    );

    return (
      <View style={[styles.dashboardShell, isDark && styles.dashboardShellDark]}>
        <View style={styles.dashboardMain}>
          <View style={styles.dashboardTopBar}>
            <Pressable
              style={styles.backToNotesBtn}
              onPress={() => { setFilteredPlayerTag(null); setFilteredPlayerId(null); }}
            >
              <Text style={styles.backToNotesBtnLabel}>← Back</Text>
            </Pressable>
            <Text style={styles.dashboardTitle}>Notes for {filteredPlayerTag}</Text>
            <Pressable
              style={styles.dashboardAddNoteBtn}
              onPress={() => {
                onQuickCreateNote(GENERAL_FIGHTER_NAME, {
                  playerTag: filteredPlayerTag,
                  startggPlayerId: filteredPlayerId,
                  opponent: filteredPlayerTag,
                });
              }}
            >
              <Text style={styles.dashboardAddNoteLabel}>+ Add Note</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dashboardContent}>
            {opponentNotes.length > 0 ? (
              <View style={styles.dashboardCard}>
                <View style={styles.dashboardCardHeader}>
                  <Text style={styles.dashboardCardTitle}>Notes about {filteredPlayerTag}</Text>
                  <Text style={styles.dashboardCardMeta}>{opponentNotes.length} note{opponentNotes.length !== 1 ? "s" : ""}</Text>
                </View>
                <View style={styles.recentNotesWrap}>
                  {opponentNotes.map((note) => (
                    <NoteItem key={note.id} note={note} onEdit={onEditNote} onDelete={onDeleteNote} onSave={onSaveInlineEdit} onViewVod={handleViewVod} forceDark compact />
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.dashboardCard}>
                <View style={styles.emptyWrap}>
                  <Text style={[styles.emptyTitle, styles.emptyTitleDark]}>No notes yet for {filteredPlayerTag}</Text>
                  <Text style={[styles.emptyBody, styles.emptyBodyDark]}>
                    Create a note to start tracking this opponent.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    );
  }

  if (!selectedCharacter) {
    const scheduleDays = ["Today", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Monday"];

    return (
      <View style={[styles.dashboardShell, isDark && styles.dashboardShellDark]}>
        {isWideLayout ? renderSideRail("my-stuff") : null}

        <View style={styles.dashboardMain}>
          <View style={styles.dashboardTopBar}>
            <Text style={styles.dashboardTitle}>My Stuff</Text>
            <View style={styles.topBarActions}>
              {!isWideLayout && renderMobileNav("my-stuff")}
              <Pressable
                style={styles.dashboardAddNoteBtn}
                onPress={() => onQuickCreateNote(GENERAL_FIGHTER_NAME)}
              >
                <Text style={styles.dashboardAddNoteLabel}>+ Add note</Text>
              </Pressable>
              <SelectMenuButton
                value={userMainCharacter || MAIN_NONE_VALUE}
                options={mainMenuOptions}
                onSelect={handleMainMenuSelect}
                disabled={isMainSaving}
                searchable
                searchPlaceholder="Search characters..."
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
                  {isAccountMenuOpen ? renderAccountPanel("dropdown") : null}
                </View>
              ) : null}
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dashboardContent}>
            {/* Upcoming Tournament */}
            <UpcomingTournamentCard
              accessToken={accessToken}
              playerGamerTag={startggUser?.player?.gamerTag}
              allNotes={allNotes}
              onNavigateToTournament={() => navigateTo("tournaments")}
              onNavigateToPlayer={(tag) => {
                setFilteredPlayerTag(tag);
                setFilteredPlayerId(null);
              }}
            />

            {/* Quick Stats Row */}
            {allNotes && allNotes.length > 0 && (
              <View style={styles.quickStatsRow}>
                <Pressable style={styles.quickStatBox} onPress={() => navigateTo("all-notes")}>
                  <Text style={styles.quickStatNumber}>{allNotes.length}</Text>
                  <Text style={styles.quickStatLabel}>Notes</Text>
                </Pressable>
                <Pressable style={styles.quickStatBox} onPress={() => navigateTo("players")}>
                  <Text style={styles.quickStatNumber}>
                    {new Set(allNotes.map((n) => n.playerTag).filter(Boolean)).size}
                  </Text>
                  <Text style={styles.quickStatLabel}>Players</Text>
                </Pressable>
                <Pressable style={styles.quickStatBox} onPress={() => navigateTo("stats")}>
                  <Text style={styles.quickStatNumber}>
                    {new Set(allNotes.map((n) => n.character).filter((c) => c && c !== "General")).size}
                  </Text>
                  <Text style={styles.quickStatLabel}>Characters</Text>
                </Pressable>
                <Pressable style={styles.quickStatBox} onPress={() => navigateTo("vod-review")}>
                  <Text style={styles.quickStatNumber}>
                    {allNotes.filter((n) => n.vodUrl).length}
                  </Text>
                  <Text style={styles.quickStatLabel}>VODs</Text>
                </Pressable>
              </View>
            )}

            {/* Recent Notes */}
            <View style={styles.dashboardCard}>
              <View style={styles.dashboardCardHeader}>
                <Text style={styles.dashboardCardTitle}>Recent Notes</Text>
                <Pressable onPress={() => navigateTo("all-notes")}>
                  <Text style={styles.dashboardCardLink}>View All</Text>
                </Pressable>
              </View>

              {isNotesLoading ? (
                <View style={styles.syncRow}>
                  <ActivityIndicator size="small" color="#FF6B3D" />
                  <Text style={[styles.syncLabel, styles.syncLabelDark]}>Syncing notebook...</Text>
                </View>
              ) : null}

              <View style={styles.recentNotesWrap}>
                {visibleRecentNotes.map((note) => (
                  <NoteItem key={note.id} note={note} onEdit={onEditNote} onDelete={onDeleteNote} onSave={onSaveInlineEdit} onViewVod={handleViewVod} forceDark compact />
                ))}
              </View>

              {!visibleRecentNotes.length ? (
                <View style={styles.emptyWrap}>
                  <Text style={[styles.emptyTitle, styles.emptyTitleDark]}>No recent notes found</Text>
                  <Text style={[styles.emptyBody, styles.emptyBodyDark]}>Create a note or adjust your search.</Text>
                </View>
              ) : null}
            </View>

            {/* Recent Opponents — 4 shown, View All goes to Players tab */}
            <View style={styles.dashboardCard}>
              <RecentOpponentsCard
                playerId={playerId}
                accessToken={accessToken}
                refreshKey={dashboardRefreshKey}
                notes={allNotes}
                maxShown={4}
                onSelectOpponent={(opponent) => {
                  navigateTo("my-stuff");
                  setFilteredPlayerTag(opponent.gamerTag);
                  setFilteredPlayerId(opponent.playerId);
                }}
                onShowAll={() => navigateTo("players")}
              />
            </View>

            {/* Most Played Against — 3 shown, View All expands */}
            <View style={styles.dashboardCard}>
              <RecentCharactersCard
                playerId={playerId}
                accessToken={accessToken}
                refreshKey={dashboardRefreshKey}
                onSelectCharacter={(characterName) => {
                  if (onSelectCharacter) onSelectCharacter(characterName);
                  navigateTo && navigateTo("my-stuff");
                }}
                onShowAll={() => setShowAllMatchups(true)}
              />
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
          {isAccountMenuOpen ? renderAccountPanel("character") : null}
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
            searchable
            searchPlaceholder="Search characters..."
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
                <NoteItem key={note.id} note={note} onEdit={onEditNote} onDelete={onDeleteNote} onSave={onSaveInlineEdit} onViewVod={handleViewVod} />
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
  // Account panel (expanded dropdown)
  accountPanel: {
    position: "absolute",
    top: 42,
    right: 0,
    width: 280,
    backgroundColor: "#10192C",
    borderColor: "#2D3957",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    zIndex: 999,
    elevation: 999,
  },
  accountPanelCharacter: {
    position: "absolute",
    top: 42,
    right: 0,
    width: 280,
    backgroundColor: "#1B2333",
    borderColor: "#2A3449",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    zIndex: 999,
    elevation: 999,
  },
  accountPanelSide: {
    position: "absolute",
    bottom: 44,
    left: 0,
    width: 280,
    backgroundColor: "#10192C",
    borderColor: "#2D3957",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    zIndex: 999,
    elevation: 999,
  },
  accountPanelSection: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  accountPanelSectionTitle: {
    color: "#8A93A7",
    fontWeight: "800",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  accountPanelConnected: {
    color: "#4ADE80",
    fontWeight: "700",
    fontSize: 11,
  },
  accountPanelDivider: {
    height: 1,
    backgroundColor: "#2D3957",
    marginVertical: 4,
  },
  accountPanelStartggUser: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  accountPanelGamerTag: {
    color: "#ECF2FF",
    fontWeight: "800",
    fontSize: 14,
  },
  accountPanelStartggDisconnect: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#3A242B",
    alignSelf: "flex-start",
  },
  accountPanelStartggDisconnectLabel: {
    color: "#F87171",
    fontWeight: "700",
    fontSize: 11,
  },
  accountPanelStartggHint: {
    color: "#8A93A7",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  accountPanelStartggBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#CB3F73",
    alignItems: "center",
  },
  accountPanelStartggBtnLabel: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
  accountPanelSignOut: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  accountPanelSignOutLabel: {
    color: "#F87171",
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
  dashboardCardLink: {
    color: "#FF6B3D",
    fontSize: 13,
    fontWeight: "700",
  },
  quickStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  quickStatBox: {
    flex: 1,
    backgroundColor: "#1B2333",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A3449",
  },
  quickStatNumber: {
    color: "#FF6B3D",
    fontSize: 22,
    fontWeight: "800",
  },
  quickStatLabel: {
    color: "#96A3BD",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
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
  allNotesFilters: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  allNotesFilterRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  allNotesFilterItem: {
    flex: 1,
    zIndex: 100,
  },
  allNotesPlayerInput: {
    flex: 1,
    backgroundColor: "#1B2333",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#2A3449",
    color: "#ECF2FF",
    marginBottom: 12,
  },
  allNotesFilterAnchor: {
    marginBottom: 12,
    zIndex: 200,
  },
  allNotesFilterBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A3449",
    backgroundColor: "#1B2333",
    paddingHorizontal: 12,
  },
  allNotesFilterBtnLabel: {
    color: "#ECF2FF",
    fontSize: 13,
    fontWeight: "700",
  },
  allNotesFilterBtnCaret: {
    color: "#C9D4E8",
    fontSize: 11,
    fontWeight: "900",
  },
  allNotesFilterDropdown: {
    top: 48,
    left: 0,
    right: 0,
    borderColor: "#344158",
    backgroundColor: "#141C2B",
    zIndex: 9999,
  },
  allNotesFilterList: {
    maxHeight: 220,
  },
  allNotesFilterDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  allNotesFilterDropdownItemActive: {
    backgroundColor: "#20334B",
  },
  allNotesFilterDropdownItemLabel: {
    color: "#ECF2FF",
    fontSize: 12,
    fontWeight: "700",
  },
});