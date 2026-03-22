import { SafeAreaView, StatusBar, StyleSheet } from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import AuthScreen from "./src/components/AuthScreen";
import LoadingScreen from "./src/components/LoadingScreen";
import NoteEditorModal from "./src/components/NoteEditorModal";
import NotesScreen from "./src/components/NotesScreen";
import StatusModal from "./src/components/StatusModal";
import { useAuth } from "./src/hooks/useAuth";
import { useNotes } from "./src/hooks/useNotes";
import { useStatusPopup } from "./src/hooks/useStatusPopup";

export default function App() {
  const { statusPopup, closeStatusPopup, showStatusPopup, showServerOverloadedPopup } =
    useStatusPopup();

  const {
    session,
    isAuthLoading,
    isAuthSubmitting,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    pendingConfirmation,
    setPendingConfirmation,
    handleSignIn,
    handleSignUp,
    handleSignOut,
    userMain,
    isMainUpdating,
    handleUpdateMain,
    userId,
  } = useAuth({ showStatusPopup, showServerOverloadedPopup });

  const {
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
    activeTab,
    selectCharacter,
    goBackToRoster,
    selectTab,
    selectOpponent,
    displayedNotes,
    canCreateMatchupNote,
    editorContextLabel,
    isNotesLoading,
    isEditorOpen,
    draftId,
    titleInput,
    setTitleInput,
    editorSections,
    updateSection,
    openNewEditor,
    openEditEditor,
    closeEditor,
    saveDraft,
    removeNote,
  } = useNotes({ userId, showStatusPopup, showServerOverloadedPopup });

  if (isAuthLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingScreen />
        <StatusModal statusPopup={statusPopup} onClose={closeStatusPopup} />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <ExpoStatusBar style="dark" />
        <StatusBar barStyle="dark-content" backgroundColor="#F6F7FB" />
        <AuthScreen
          authEmail={authEmail}
          setAuthEmail={setAuthEmail}
          authPassword={authPassword}
          setAuthPassword={setAuthPassword}
          isAuthSubmitting={isAuthSubmitting}
          pendingConfirmation={pendingConfirmation}
          onBackToSignIn={() => setPendingConfirmation(false)}
          onSignIn={handleSignIn}
          onSignUp={handleSignUp}
        />
        <StatusModal statusPopup={statusPopup} onClose={closeStatusPopup} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ExpoStatusBar style="dark" />
      <StatusBar barStyle="dark-content" backgroundColor="#F6F7FB" />

      <NotesScreen
        isNotesLoading={isNotesLoading}
        fighterSearch={fighterSearch}
        setFighterSearch={setFighterSearch}
        noteSearch={noteSearch}
        setNoteSearch={setNoteSearch}
        opponentSearch={opponentSearch}
        setOpponentSearch={setOpponentSearch}
        visibleFighters={visibleFighters}
        visibleOpponents={visibleOpponents}
        fighterNoteCounts={fighterNoteCounts}
        selectedCharacter={selectedCharacter}
        selectedOpponent={selectedOpponent}
        activeTab={activeTab}
        onSelectCharacter={selectCharacter}
        onBackToRoster={goBackToRoster}
        onSelectTab={selectTab}
        onSelectOpponent={selectOpponent}
        displayedNotes={displayedNotes}
        canCreateMatchupNote={canCreateMatchupNote}
        onEditNote={openEditEditor}
        onDeleteNote={removeNote}
        onCreateNote={openNewEditor}
        onSignOut={handleSignOut}
        userMain={userMain}
        isMainUpdating={isMainUpdating}
        onUpdateMain={handleUpdateMain}
      />

      <NoteEditorModal
        visible={isEditorOpen}
        draftId={draftId}
        editorContextLabel={editorContextLabel}
        titleInput={titleInput}
        setTitleInput={setTitleInput}
        editorSections={editorSections}
        updateSection={updateSection}
        onClose={closeEditor}
        onSave={saveDraft}
      />

      <StatusModal statusPopup={statusPopup} onClose={closeStatusPopup} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F6F7FB",
  },
});
