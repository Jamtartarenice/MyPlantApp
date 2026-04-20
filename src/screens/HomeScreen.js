// src/screens/HomeScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import styles from '../styles/HomeScreenStyle';
import { getMockLatestReading, getMockAlerts } from '../services/mockData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

const MOISTURE_THRESHOLD = 500;
const CAMERA_STREAM_URL = 'https://camera.airplants.online/video_feed';

export default function HomeScreen({ navigation, setUserToken }) {
  const [loading, setLoading] = useState(true);
  const [sensorData, setSensorData] = useState({
    light_percent: null,
    air_temperature: null,
    air_humidity: null,
    soil_moisture_raw: null,
    soil_temperature: null,
    timestamp: null,
  });
  const [alerts, setAlerts] = useState([]);
  const [isUsingMock, setIsUsingMock] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const lastAlertState = useRef('');

  const fetchLatestData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/latest`);
      if (!response.ok) throw new Error('Network response not ok');
      const data = await response.json();
      if (data && !data.error) {
        setSensorData({
          light_percent: data.light_percent,
          air_temperature: data.air_temperature,
          air_humidity: data.air_humidity,
          soil_moisture_raw: data.soil_moisture_raw,
          soil_temperature: data.soil_temperature,
          timestamp: data.timestamp,
        });
        setIsUsingMock(false);
      }
    } catch (error) {
      console.log('Error fetching sensor data, using mock:', error);
      const mock = getMockLatestReading();
      setSensorData({
        light_percent: mock.light_percent,
        air_temperature: mock.air_temperature,
        air_humidity: mock.air_humidity,
        soil_moisture_raw: mock.soil_moisture_raw,
        soil_temperature: mock.soil_temperature,
        timestamp: mock.timestamp,
      });
      setIsUsingMock(true);
    } finally {
      setLoading(false);
    }
  };

  const checkForAlerts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/check-alerts`);
      if (!response.ok) throw new Error('Network error');
      const result = await response.json();
      if (result.alert_count > 0) {
        setAlerts(result.alerts);
        const alertSummary = result.alerts.map(a => a.type).join(',');
        if (alertSummary !== lastAlertState.current) {
          Alert.alert('🌱 Plant Alert', result.alerts[0].message);
          lastAlertState.current = alertSummary;
        }
      } else {
        setAlerts([]);
        lastAlertState.current = '';
      }
    } catch (error) {
      console.log('Polling error, using mock alerts:', error);
      const mockAlerts = getMockAlerts();
      setAlerts(mockAlerts.alerts);
      if (mockAlerts.alert_count > 0) {
        const alertSummary = mockAlerts.alerts.map(a => a.type).join(',');
        if (alertSummary !== lastAlertState.current) {
          Alert.alert('🌱 Plant Alert (Demo)', mockAlerts.alerts[0].message);
          lastAlertState.current = alertSummary;
        }
      }
    }
  };

  useEffect(() => {
    fetchLatestData();
    checkForAlerts();
    const dataInterval = setInterval(fetchLatestData, 10000);
    const alertInterval = setInterval(checkForAlerts, 10000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(alertInterval);
    };
  }, []);

  const handleCardPress = (sensor) => {
    navigation.navigate('History', { sensor });
  };

  const handleHelpPress = () => {
    Alert.alert('Help', 'Contact support at plant@monitor.com');
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    setUserToken(null);
  };

  const formatValue = (value, unit, decimals = 1) => {
    if (value === null || value === undefined) return '--';
    if (unit === '°C') return `${value.toFixed(decimals)}°C`;
    if (unit === '%') return `${value.toFixed(decimals)}%`;
    return value.toString();
  };

  const getMoistureStatus = (raw) => {
    if (raw === null) return '--';
    return raw > MOISTURE_THRESHOLD ? 'Wet' : 'Dry';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text>Connecting to plant monitor...</Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.cameraContainer}>
        {cameraLoading && (
          <View style={styles.cameraLoadingOverlay}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text>Loading plant camera...</Text>
          </View>
        )}
<WebView
  source={{ html: `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <style>
          body { margin: 0; padding: 0; background: black; }
          img { width: 100%; height: 100%; object-fit: cover; }
        </style>
      </head>
      <body>
        <img src="${CAMERA_STREAM_URL}" />
      </body>
    </html>
  ` }}
  style={styles.cameraWebView}
  onLoad={() => setCameraLoading(false)}
  onError={() => {
    setCameraLoading(false);
    Alert.alert('Camera Error', 'Unable to load the plant camera stream.');
  }}
  scrollEnabled={false}
  bounces={false}
  cacheEnabled={false}
/>
      </View>

      <View style={styles.header}>
        <View style={{ width: 28 }} />
        <Text style={styles.headerTitle}>live camera view</Text>
        <TouchableOpacity onPress={() => Alert.alert('Camera pressed')}>
          <Text style={styles.headerIcon}>📷</Text>
        </TouchableOpacity>
      </View>

      {isUsingMock && (
        <View style={{ backgroundColor: '#FFE082', padding: 4, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: '#8D6E63' }}>📱 Offline Demo Mode</Text>
        </View>
      )}

      {alerts.length > 0 && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertTitle}>⚠️ Attention Needed</Text>
          {alerts.map((alert, index) => (
            <Text key={index} style={styles.alertMessage}>
              • {alert.message}
            </Text>
          ))}
        </View>
      )}

      <Text style={styles.plantName}>Monstera Deliciosa</Text>

      <View style={styles.grid}>
        <TouchableOpacity
          style={[styles.card, styles.cardLight]}
          onPress={() => handleCardPress('light')}
        >
          <Text style={styles.cardTitle}>Light</Text>
          <Text style={styles.cardStatus}>
            {sensorData.light_percent !== null
              ? sensorData.light_percent > 70
                ? 'Great'
                : sensorData.light_percent > 30
                ? 'Good'
                : 'Bad'
              : '--'}
          </Text>
          <Text style={styles.cardValue}>
            {formatValue(sensorData.light_percent, '%', 0)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.cardTemp]}
          onPress={() => handleCardPress('temperature')}
        >
          <Text style={styles.cardTitle}>Temperature</Text>
          <Text style={styles.cardStatus}>
            {sensorData.air_temperature !== null
              ? sensorData.air_temperature > 28
                ? 'High'
                : sensorData.air_temperature < 18
                ? 'Low'
                : 'Good'
              : '--'}
          </Text>
          <Text style={styles.cardValue}>
            {formatValue(sensorData.air_temperature, '°C')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.cardHumidity]}
          onPress={() => handleCardPress('humidity')}
        >
          <Text style={styles.cardTitle}>Humidity</Text>
          <Text style={styles.cardStatus}>
            {sensorData.air_humidity !== null
              ? sensorData.air_humidity > 70
                ? 'High'
                : sensorData.air_humidity < 30
                ? 'Low'
                : 'Good'
              : '--'}
          </Text>
          <Text style={styles.cardValue}>
            {formatValue(sensorData.air_humidity, '%', 0)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.cardMoisture]}
          onPress={() => handleCardPress('moisture')}
        >
          <Text style={styles.cardTitle}>Soil Moisture</Text>
          <Text style={styles.cardStatus}>
            {getMoistureStatus(sensorData.soil_moisture_raw)}
          </Text>
          <Text style={styles.cardValue}>
            {sensorData.soil_moisture_raw ?? '--'}
          </Text>
        </TouchableOpacity>
      </View>

      {sensorData.soil_temperature !== null && (
        <TouchableOpacity
          style={styles.soilTempRow}
          onPress={() => handleCardPress('soiltemp')}
        >
          <Text style={styles.soilTempText}>
            🌱 Soil temperature: {formatValue(sensorData.soil_temperature, '°C')}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.footer}>
        <Text style={styles.lastReading}>
          Last reading:{' '}
          {sensorData.timestamp
            ? new Date(sensorData.timestamp).toLocaleString()
            : 'never'}
        </Text>
      </View>
      
      <TouchableOpacity
        onPress={handleLogout}
        style={{ marginTop: 10, marginBottom: 20, alignItems: 'center' }}
      >
        <Text style={{ color: '#f44336', fontSize: 16 }}>🚪 Logout (dev only)</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}