/**
 * Example integration of Start.gg components into your SmashNotes app
 * 
 * This file shows how you can integrate the Start.gg components into your existing app structure.
 * You can adapt this to your specific navigation setup (Tab Navigator, Stack Navigator, etc.)
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import TournamentBrowser from '../components/TournamentBrowser';
import PlayerLookup from '../components/PlayerLookup';
import StartGGSettings from '../components/StartGGSettings';
import PlayerOpponentsTab from '../components/PlayerOpponentsTab';

export default function StartGGScreen({ onCreateNote }) {
  const [activeTab, setActiveTab] = useState('tournaments');

  const handleTournamentSelect = (tournament) => {
    console.log('Selected tournament:', tournament);
    // You could navigate to a tournament details screen
    // or show tournament events in a modal
  };

  const handleCreateNote = (noteData) => {
    console.log('Creating note with Start.gg data:', noteData);
    // Pass the note data back to your main app
    // This could create a new note or open the note editor
    onCreateNote?.(noteData);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'tournaments':
        return (
          <TournamentBrowser 
            onTournamentSelect={handleTournamentSelect}
          />
        );
      case 'players':
        return (
          <PlayerLookup 
            onCreateNote={handleCreateNote}
          />
        );
      case 'opponents':
        return <PlayerOpponentsTab />;
      case 'settings':
        return <StartGGSettings />;
      default:
        return (
          <View style={styles.centerContainer}>
            <Text>Select a tab to get started</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tournaments' && styles.activeTab]}
          onPress={() => setActiveTab('tournaments')}
        >
          <Text style={[styles.tabText, activeTab === 'tournaments' && styles.activeTabText]}>
            🏆 Tournaments
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'players' && styles.activeTab]}
          onPress={() => setActiveTab('players')}
        >
          <Text style={[styles.tabText, activeTab === 'players' && styles.activeTabText]}>
            🎮 Players
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'opponents' && styles.activeTab]}
          onPress={() => setActiveTab('opponents')}
        >
          <Text style={[styles.tabText, activeTab === 'opponents' && styles.activeTabText]}>
            🤼 Opponents
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>
            ⚙️ Settings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {renderTabContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  tab: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent'
  },
  activeTab: {
    borderBottomColor: '#007AFF'
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500'
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600'
  },
  content: {
    flex: 1
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  }
});

/* 
 * Alternative: Using React Navigation with Bottom Tabs
 * 
 * If you're using @react-navigation/bottom-tabs, you could set up the tabs like this:
 * 
 * import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
 * 
 * const Tab = createBottomTabNavigator();
 * 
 * export default function StartGGNavigator({ onCreateNote }) {
 *   return (
 *     <Tab.Navigator
 *       screenOptions={{
 *         tabBarActiveTintColor: '#007AFF',
 *         tabBarInactiveTintColor: '#666',
 *       }}
 *     >
 *       <Tab.Screen 
 *         name="Tournaments" 
 *         component={TournamentBrowser}
 *         options={{
 *           tabBarIcon: ({ color }) => <Text style={{ color }}>🏆</Text>,
 *         }}
 *       />
 *       <Tab.Screen 
 *         name="Players" 
 *         options={{
 *           tabBarIcon: ({ color }) => <Text style={{ color }}>🎮</Text>,
 *         }}
 *       >
 *         {() => <PlayerLookup onCreateNote={onCreateNote} />}
 *       </Tab.Screen>
 *       <Tab.Screen 
 *         name="Settings" 
 *         component={StartGGSettings}
 *         options={{
 *           tabBarIcon: ({ color }) => <Text style={{ color }}>⚙️</Text>,
 *         }}
 *       />
 *     </Tab.Navigator>
 *   );
 * }
 */