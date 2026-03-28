import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator
} from "react-native";
import { useStartGGConnection } from "../hooks/useStartGG";
import { useStartGGAuth } from "../lib/startggAuth";
import { testStartGGConnection } from "../utils/startggData";

export default function StartGGSettings() {
  const {
    isConnected,
    isAuthenticated: apiAuthenticated,
    connectionError,
    checking,
    checkConnection
  } = useStartGGConnection();
  
  const {
    isAuthenticated: oauthAuthenticated,
    isLoading: authLoading,
    user,
    login,
    logout
  } = useStartGGAuth();

  const handleOpenDeveloperSettings = () => {
    Linking.openURL('https://start.gg/admin/profile/developer')
      .catch(() => {
        Alert.alert(
          "Cannot Open Link",
          "Please visit start.gg and navigate to Admin > Profile > Developer Settings"
        );
      });
  };

  const handleOpenDocumentation = () => {
    Linking.openURL('https://developer.start.gg/docs/intro')
      .catch(() => {
        Alert.alert(
          "Cannot Open Link",
          "Please visit https://developer.start.gg/docs/intro"
        );
      });
  };

  const handleTestAPI = async () => {
    try {
      const result = await testStartGGConnection();
      if (result.success) {
        Alert.alert("API Test Success", "Start.gg API is working correctly!");
      } else {
        Alert.alert("API Test Failed", result.message);
      }
    } catch (error) {
      Alert.alert("API Test Error", error.message);
    }
  };

  const renderConnectionStatus = () => {
    if (checking) {
      return (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.statusText}>Checking connection...</Text>
        </View>
      );
    }

    if (isConnected === null) {
      return (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>Connection not tested yet</Text>
          <TouchableOpacity style={styles.testButton} onPress={checkConnection}>
            <Text style={styles.testButtonText}>Test Connection</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (isConnected && apiAuthenticated) {
      return (
        <View style={[styles.statusContainer, styles.successContainer]}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successText}>Start.gg API Connected</Text>
          <Text style={styles.successSubtext}>
            Your API token is valid and working correctly
          </Text>
        </View>
      );
    }

    if (isConnected && !apiAuthenticated) {
      return (
        <View style={[styles.statusContainer, styles.warningContainer]}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>Authentication Required</Text>
          <Text style={styles.warningSubtext}>
            Connection successful but API token is invalid or missing
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.statusContainer, styles.errorContainer]}>
        <Text style={styles.errorIcon}>❌</Text>
        <Text style={styles.errorText}>Connection Failed</Text>
        <Text style={styles.errorSubtext}>
          {connectionError || "Unable to connect to Start.gg API"}
        </Text>
      </View>
    );
  };

  const renderSetupInstructions = () => {
    if (isConnected && apiAuthenticated) {
      return null;
    }

    return (
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsHeader}>Setup Instructions</Text>
        
        <View style={styles.stepContainer}>
          <Text style={styles.stepNumber}>1</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Get Start.gg API Token</Text>
            <Text style={styles.stepText}>
              Visit the Start.gg Developer Settings page to create a new API token
            </Text>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={handleOpenDeveloperSettings}
            >
              <Text style={styles.linkButtonText}>Open Developer Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.stepContainer}>
          <Text style={styles.stepNumber}>2</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Add Token to Environment</Text>
            <Text style={styles.stepText}>
              Add your API token to your environment variables:
            </Text>
            <View style={styles.codeContainer}>
              <Text style={styles.codeText}>
                EXPO_PUBLIC_START_GG_API_TOKEN=your_token_here
              </Text>
            </View>
            <Text style={styles.stepNote}>
              Add this to your .env file or export it in your shell
            </Text>
          </View>
        </View>

        <View style={styles.stepContainer}>
          <Text style={styles.stepNumber}>3</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Restart Your App</Text>
            <Text style={styles.stepText}>
              Restart your development server to load the new environment variable
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Start.gg Integration</Text>
        <Text style={styles.subtitle}>
          Connect to Start.gg to access tournament and player data
        </Text>
      </View>

      {renderConnectionStatus()}

      {/* OAuth Authentication Section */}
      <View style={styles.oauthContainer}>
        <Text style={styles.sectionTitle}>User Authentication</Text>
        <Text style={styles.sectionSubtitle}>
          Login to access your personal Start.gg profile and email
        </Text>
        
        {oauthAuthenticated ? (
          <View style={styles.userContainer}>
            <View style={styles.userInfo}>
              <Text style={styles.userIcon}>👤</Text>
              <View>
                <Text style={styles.userName}>{user?.player?.gamerTag || user?.name || user?.email || 'Authenticated User'}</Text>
                <Text style={styles.userSlug}>@{user?.slug || 'user'}</Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.logoutButton]}
              onPress={logout}
              disabled={authLoading}
            >
              <Text style={styles.logoutButtonText}>
                {authLoading ? "Signing out..." : "Sign Out"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.loginContainer}>
            <Text style={styles.loginDescription}>
              Connect your Start.gg account to identify yourself and access personalized features. 
              We'll use your profile info combined with our API for tournament data.
            </Text>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.loginButton]}
              onPress={login}
              disabled={authLoading}
            >
              <Text style={styles.actionButtonText}>
                {authLoading ? "Connecting..." : "Connect Start.gg Account"}
              </Text>
            </TouchableOpacity>
            
            <Text style={styles.privacyNote}>
              We only request access to your basic profile information and email address. 
              Your login credentials are handled securely by Start.gg.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={checkConnection}
          disabled={checking}
        >
          <Text style={styles.actionButtonText}>
            {checking ? "Testing..." : "Test Connection"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleOpenDocumentation}
        >
          <Text style={styles.secondaryButtonText}>View Documentation</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.testButton}
          onPress={handleTestAPI}
        >
          <Text style={styles.testButtonText}>Test API Connection</Text>
        </TouchableOpacity>
      </View>

      {renderSetupInstructions()}

      <View style={styles.featuresContainer}>
        <Text style={styles.featuresHeader}>Available Features</Text>
        
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>🏆</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Tournament Search</Text>
            <Text style={styles.featureDescription}>
              Search for tournaments and view brackets
            </Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>🎮</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Player Lookup</Text>
            <Text style={styles.featureDescription}>
              Find players and analyze their tournament history
            </Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>📊</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Character Analytics</Text>
            <Text style={styles.featureDescription}>
              View character usage and win rate statistics
            </Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>📝</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Auto-Generate Notes</Text>
            <Text style={styles.featureDescription}>
              Create matchup notes from tournament data
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.disclaimerContainer}>
        <Text style={styles.disclaimerText}>
          Start.gg is a trademark of Battlefy Inc. This integration uses the public Start.gg API.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22
  },
  statusContainer: {
    margin: 15,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  successContainer: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
    borderWidth: 1
  },
  warningContainer: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1
  },
  errorContainer: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1
  },
  successIcon: {
    fontSize: 40,
    marginBottom: 10
  },
  warningIcon: {
    fontSize: 40,
    marginBottom: 10
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 10
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center'
  },
  successText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#155724',
    textAlign: 'center',
    marginBottom: 8
  },
  successSubtext: {
    fontSize: 14,
    color: '#155724',
    textAlign: 'center'
  },
  warningText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
    textAlign: 'center',
    marginBottom: 8
  },
  warningSubtext: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center'
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#721c24',
    textAlign: 'center',
    marginBottom: 8
  },
  errorSubtext: {
    fontSize: 14,
    color: '#721c24',
    textAlign: 'center'
  },
  testButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 15
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  actionsContainer: {
    margin: 15,
    gap: 10
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center'
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  secondaryButton: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF'
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600'
  },
  testButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center'
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  instructionsContainer: {
    margin: 15,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  instructionsHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start'
  },
  stepNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#007AFF',
    width: 32,
    height: 32,
    borderRadius: 16,
    textAlign: 'center',
    lineHeight: 32,
    marginRight: 15
  },
  stepContent: {
    flex: 1
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  stepText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10
  },
  stepNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8
  },
  linkButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  linkButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600'
  },
  codeContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    marginVertical: 8
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333'
  },
  featuresContainer: {
    margin: 15,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  featuresHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 15,
    width: 40,
    textAlign: 'center'
  },
  featureContent: {
    flex: 1
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18
  },
  disclaimerContainer: {
    margin: 15,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10
  },
  disclaimerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16
  },
  oauthContainer: {
    margin: 15,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20
  },
  userContainer: {
    alignItems: 'center'
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%'
  },
  userIcon: {
    fontSize: 24,
    marginRight: 12
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  userSlug: {
    fontSize: 14,
    color: '#666'
  },
  loginContainer: {
    alignItems: 'center'
  },
  loginDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20
  },
  loginButton: {
    backgroundColor: '#e91e63'
  },
  logoutButton: {
    backgroundColor: '#dc3545'
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  privacyNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16
  }
});