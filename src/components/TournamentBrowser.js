import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image
} from "react-native";
import { useStartGGTournaments, useStartGGConnection } from "../hooks/useStartGG";

export default function TournamentBrowser({ onTournamentSelect }) {
  const { isConnected, isAuthenticated, connectionError } = useStartGGConnection();
  const {
    tournaments,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    searchForTournaments,
    clearSearch
  } = useStartGGTournaments();

  const [searchOptions, setSearchOptions] = useState({
    upcoming: true,
    countryCode: null
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      Alert.alert("Error", "Please enter a tournament name to search");
      return;
    }
    searchForTournaments(searchQuery, searchOptions);
  };

  const renderConnectionStatus = () => {
    if (!isConnected) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            ❌ Start.gg API not connected
          </Text>
          <Text style={styles.errorSubtext}>
            {connectionError || "Check your internet connection"}
          </Text>
        </View>
      );
    }

    if (!isAuthenticated) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            ⚠️ Start.gg API token not configured
          </Text>
          <Text style={styles.errorSubtext}>
            Set EXPO_PUBLIC_START_GG_API_TOKEN in your environment
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.successContainer}>
        <Text style={styles.successText}>✅ Start.gg API connected</Text>
      </View>
    );
  };

  const renderTournament = ({ item }) => {
    const startDate = item.startAt ? new Date(item.startAt * 1000) : null;
    const isOnline = item.isOnline;
    
    return (
      <TouchableOpacity
        style={styles.tournamentItem}
        onPress={() => onTournamentSelect?.(item)}
      >
        <View style={styles.tournamentHeader}>
          <Text style={styles.tournamentName} numberOfLines={2}>
            {item.name}
          </Text>
          {isOnline && (
            <View style={styles.onlineBadge}>
              <Text style={styles.onlineText}>ONLINE</Text>
            </View>
          )}
        </View>
        
        <View style={styles.tournamentDetails}>
          {startDate && (
            <Text style={styles.dateText}>
              📅 {startDate.toLocaleDateString()}
            </Text>
          )}
          
          {item.city && item.addrState && (
            <Text style={styles.locationText}>
              📍 {item.city}, {item.addrState}
            </Text>
          )}
          
          {item.numAttendees && (
            <Text style={styles.attendeesText}>
              👥 {item.numAttendees} attendees
            </Text>
          )}
        </View>

        {item.events && item.events.length > 0 && (
          <View style={styles.eventsContainer}>
            <Text style={styles.eventsHeader}>Events:</Text>
            {item.events.slice(0, 3).map((event, index) => (
              <Text key={event.id} style={styles.eventText}>
                • {event.name} ({event.numEntrants} entrants)
              </Text>
            ))}
            {item.events.length > 3 && (
              <Text style={styles.moreEventsText}>
                +{item.events.length - 3} more events
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Searching tournaments...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load tournaments</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleSearch}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (searchQuery && tournaments.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No tournaments found</Text>
          <Text style={styles.emptySubtext}>
            Try adjusting your search or check back later
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>🏆 Tournament Browser</Text>
        <Text style={styles.emptySubtext}>
          Search for Smash Ultimate tournaments to find matches and players
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderConnectionStatus()}
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search tournaments (e.g., 'Genesis', 'EVO', 'Big House')"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          editable={isConnected && isAuthenticated}
        />
        
        <View style={styles.searchButtons}>
          <TouchableOpacity
            style={[styles.searchButton, (!isConnected || !isAuthenticated) && styles.disabledButton]}
            onPress={handleSearch}
            disabled={!isConnected || !isAuthenticated || loading}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearSearch}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={tournaments}
        renderItem={renderTournament}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  successContainer: {
    backgroundColor: '#d4edda',
    padding: 10,
    borderRadius: 5,
    margin: 10,
    borderWidth: 1,
    borderColor: '#c3e6cb'
  },
  successText: {
    color: '#155724',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  },
  errorContainer: {
    backgroundColor: '#f8d7da',
    padding: 10,
    borderRadius: 5,
    margin: 10,
    borderWidth: 1,
    borderColor: '#f5c6cb'
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  },
  errorSubtext: {
    color: '#721c24',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4
  },
  searchContainer: {
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: 'white'
  },
  searchButtons: {
    flexDirection: 'row',
    gap: 10
  },
  searchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  clearButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  disabledButton: {
    backgroundColor: '#ccc'
  },
  listContainer: {
    padding: 15,
    flexGrow: 1
  },
  tournamentItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  tournamentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10
  },
  onlineBadge: {
    backgroundColor: '#28a745',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  onlineText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold'
  },
  tournamentDetails: {
    marginBottom: 10
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4
  },
  attendeesText: {
    fontSize: 14,
    color: '#666'
  },
  eventsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10
  },
  eventsHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5
  },
  eventText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 2
  },
  moreEventsText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 2
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666'
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center'
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 15
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  }
});