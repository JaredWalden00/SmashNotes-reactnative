import { SafeAreaView, StatusBar, StyleSheet, useColorScheme } from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import AuthScreen from "./src/components/AuthScreen";
import LoadingScreen from "./src/components/LoadingScreen";
import NoteEditorModal from "./src/components/NoteEditorModal";
import NotesScreen from "./src/components/NotesScreen";
import { useStartGGAuth } from "./src/lib/startggAuth";
import StatusModal from "./src/components/StatusModal";
import { useAuth } from "./src/hooks/useAuth";
import { useNotes } from "./src/hooks/useNotes";
import { useStatusPopup } from "./src/hooks/useStatusPopup";

export default function App() {
  // Start.gg OAuth
  const {
    user: startggUser,
    accessToken: startggAccessToken,
    isAuthenticated: startggIsAuthenticated,
    login: startggLogin,
    logout: startggLogout,
  } = useStartGGAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const { statusPopup, closeStatusPopup, showStatusPopup, showServerOverloadedPopup } =
    useStatusPopup();

  const {
    session,
    isAuthLoading,
    isAuthSubmitting,
    authMode,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    confirmPassword,
    setConfirmPassword,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    isPasswordRecovery,
    isForgotPassword,
    pendingConfirmation,
    setPendingConfirmation,
    handleSignIn,
    handleGoogleSignIn,
    handleSignUp,
    handleForgotPassword,
    handleUpdatePassword,
    cancelPasswordRecovery,
    startForgotPassword,
    cancelForgotPassword,
    startSignUpMode,
    backToSignInMode,
    handleSignOut,
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
    notes: allNotes,
    recentNotes,
    selectedCharacter,
    selectedOpponent,
    userMainCharacter,
    isMainSaving,
    activeTab,
    selectCharacter,
    setMainCharacter,
    goBackToRoster,
    selectTab,
    selectOpponent,
    displayedNotes,
    canCreateMatchupNote,
    editorContextLabel,
    draftCharacter,
    isNotesLoading,
    isEditorOpen,
    draftId,
    titleInput,
    setTitleInput,
    draftPlayerTag,
    setDraftPlayerTag,
    editorSections,
    editorSectionKeys,
    updateSection,
    setDraftCharacter,
    addEditorSection,
    addCustomEditorSection,
    removeEditorSection,
    moveEditorSection,
    openNewEditor,
    openQuickEditorForCharacter,
    openEditEditor,
    closeEditor,
    saveDraft,
    removeNote,
    saveInlineEdit,
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
      <SafeAreaView style={[styles.safe, isDark && styles.safeDark]}>
        <ExpoStatusBar style={isDark ? "light" : "dark"} />
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#101521" : "#F6F7FB"} />
        <AuthScreen
          authEmail={authEmail}
          setAuthEmail={setAuthEmail}
          authPassword={authPassword}
          setAuthPassword={setAuthPassword}
          authMode={authMode}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmNewPassword={confirmNewPassword}
          setConfirmNewPassword={setConfirmNewPassword}
          isPasswordRecovery={isPasswordRecovery}
          isForgotPassword={isForgotPassword}
          isAuthSubmitting={isAuthSubmitting}
          pendingConfirmation={pendingConfirmation}
          onBackToSignIn={() => setPendingConfirmation(false)}
          onSignIn={handleSignIn}
          onGoogleSignIn={handleGoogleSignIn}
          onSignUp={handleSignUp}
          onStartSignUp={startSignUpMode}
          onBackFromSignUp={backToSignInMode}
          onStartForgotPassword={startForgotPassword}
          onForgotPassword={handleForgotPassword}
          onUpdatePassword={handleUpdatePassword}
          onCancelPasswordRecovery={cancelPasswordRecovery}
          onCancelForgotPassword={cancelForgotPassword}
        />
        <StatusModal statusPopup={statusPopup} onClose={closeStatusPopup} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, isDark && styles.safeDark]}>
      <ExpoStatusBar style={isDark ? "light" : "dark"} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#101521" : "#F6F7FB"} />

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
        recentNotes={recentNotes}
        allNotes={allNotes}
        selectedCharacter={selectedCharacter}
        selectedOpponent={selectedOpponent}
        userMainCharacter={userMainCharacter}
        isMainSaving={isMainSaving}
        activeTab={activeTab}
        onSelectCharacter={selectCharacter}
        onSetMainCharacter={setMainCharacter}
        onBackToRoster={goBackToRoster}
        onSelectTab={selectTab}
        onSelectOpponent={selectOpponent}
        displayedNotes={displayedNotes}
        canCreateMatchupNote={canCreateMatchupNote}
        onEditNote={openEditEditor}
        onDeleteNote={removeNote}
        onSaveInlineEdit={saveInlineEdit}
        onCreateNote={openNewEditor}
        onQuickCreateNote={openQuickEditorForCharacter}
        onSignOut={handleSignOut}
        startggUser={startggUser}
        startggIsAuthenticated={startggIsAuthenticated}
        startggLogin={startggLogin}
        startggLogout={startggLogout}
        playerId={startggUser?.player?.id}
        accessToken={startggAccessToken}
      />

      <NoteEditorModal
        visible={isEditorOpen}
        draftId={draftId}
        editorContextLabel={editorContextLabel}
        titleInput={titleInput}
        setTitleInput={setTitleInput}
        draftCharacter={draftCharacter}
        onChangeDraftCharacter={setDraftCharacter}
        draftPlayerTag={draftPlayerTag}
        setDraftPlayerTag={setDraftPlayerTag}
        editorSections={editorSections}
        editorSectionKeys={editorSectionKeys}
        updateSection={updateSection}
        onAddSection={addEditorSection}
        onAddCustomSection={addCustomEditorSection}
        onRemoveSection={removeEditorSection}
        onMoveSection={moveEditorSection}
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
  safeDark: {
    backgroundColor: "#101521",
  },
});
