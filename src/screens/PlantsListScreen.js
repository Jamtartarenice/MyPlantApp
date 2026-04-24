// src/screens/PlantsListScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

export default function PlantsListScreen({ navigation, setUserToken }) { // <-- Receive setUserToken
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPlants = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_URL}/api/plants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        // Unauthorized – clear token and let App.js handle the screen change
        await AsyncStorage.clear();
        setUserToken(null); // This triggers the conditional rendering in App.js
        return;
      }
      const data = await response.json();
      if (response.ok) {
        setPlants(data);
      } else {
        Alert.alert('Error', data.error || 'Failed to load plants');
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Network error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    setUserToken(null); // This triggers the conditional rendering in App.js
  };

  useEffect(() => {
    fetchPlants();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPlants();
  };

  const createNewPlant = async () => {
    Alert.prompt(
      'New Plant',
      'Enter plant name:',
      async (name) => {
        if (!name) return;
        try {
          const token = await AsyncStorage.getItem('userToken');
          const response = await fetch(`${API_URL}/api/plants`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name }),
          });
          const data = await response.json();
          if (response.ok) {
            fetchPlants();
          } else {
            Alert.alert('Error', data.error);
          }
        } catch (error) {
          Alert.alert('Error', 'Could not create plant');
        }
      },
      'plain-text'
    );
  };

  const renderPlant = ({ item }) => (
    <TouchableOpacity
      style={styles.plantCard}
      onPress={() => navigation.navigate('PlantDetail', { plantId: item.id, plantName: item.name })}
    >
      <Text style={styles.plantName}>{item.name}</Text>
      <Text style={styles.plantOwner}>
        {item.isOwner ? '🌱 Your plant' : `👤 Shared by ${item.ownerUsername}`}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>My Plants</Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={createNewPlant} style={styles.addButton}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>🚪</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={plants}
        renderItem={renderPlant}
        keyExtractor={(item) => item.id.toString()}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No plants yet. Tap + to add one.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1e2b3c' },
  addButton: {
    backgroundColor: '#4CAF50',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  addButtonText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  logoutButton: {
    backgroundColor: '#f44336',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButtonText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  plantCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  plantName: { fontSize: 18, fontWeight: '600', color: '#333' },
  plantOwner: { fontSize: 14, color: '#7f8c8d', marginTop: 4 },
  empty: { textAlign: 'center', color: '#95a5a6', marginTop: 40, fontSize: 16 },
});