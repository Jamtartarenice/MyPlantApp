// src/screens/HistoryScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from '../styles/HistoryScreenStyle';
import { API_URL } from '../config';

const screenWidth = Dimensions.get('window').width;

const RANGES = [
  { label: '1h', hours: 1, maxPoints: 30 },
  { label: '24h', hours: 24, maxPoints: 48 },
  { label: 'Week', hours: 168, maxPoints: 28 },
  { label: 'Month', hours: 720, maxPoints: 30 },
];

export default function HistoryScreen({ route, navigation }) {
  const { sensor, plantId } = route.params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedRange, setSelectedRange] = useState(RANGES[1]);
  const [isUsingMock, setIsUsingMock] = useState(false);

  const sensorConfig = {
    temperature: { field: 'air_temperature', unit: '°C', color: '#F5A623', optimalRange: '18–26°C' },
    humidity:    { field: 'air_humidity',    unit: '%',  color: '#50E3C2', optimalRange: '40–60%' },
    light:       { field: 'light_percent',   unit: '%',  color: '#FF6B6B', optimalRange: '30–80%' },
    moisture:    { field: 'soil_moisture_raw', unit: '', color: '#4A90E2', optimalRange: '300–700' },
    soiltemp:    { field: 'soil_temperature', unit: '°C', color: '#8B4513', optimalRange: '15–25°C' },
  };

  const config = sensorConfig[sensor] || sensorConfig.temperature;

  // Fetch exactly the number of hours for the selected range
  const fetchHistory = async (rangeHours) => {
    try {
      setError(null);
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(
        `${API_URL}/api/history?plantId=${plantId}&hours=${rangeHours}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      if (Array.isArray(data)) {
        // Sort oldest first for the chart
        return data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      }
      throw new Error('Invalid data format');
    } catch (err) {
      console.log('Failed to load history:', err);
      return null;
    }
  };

  const loadData = async () => {
    setLoading(true);
    const rawData = await fetchHistory(selectedRange.hours);
    if (rawData && rawData.length > 0) {
      setFilteredData(rawData);
      setIsUsingMock(false);
    } else {
      const { generateMockHistory } = await import('../services/mockData');
      const mockData = generateMockHistory(7, 30);
      setFilteredData(mockData);
      setIsUsingMock(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (plantId) {
      loadData();
    } else {
      setError('No plant ID provided');
      setLoading(false);
    }
  }, [sensor, plantId, selectedRange]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  }, [selectedRange, plantId]);

  // Linear downsampling: keep roughly maxPoints equally spaced points
  const downsample = (data, maxPoints) => {
    if (data.length <= maxPoints) return data;
    const step = Math.floor(data.length / (maxPoints - 1));
    const sampled = [];
    for (let i = 0; i < data.length; i += step) {
      sampled.push(data[i]);
      if (sampled.length >= maxPoints) break;
    }
    // Ensure we always have at least 2 points for a line
    if (sampled.length < 2 && data.length >= 2) {
      sampled.push(data[data.length - 1]);
    }
    return sampled;
  };

  const prepareChartData = () => {
    if (!filteredData.length) return null;

    let points = filteredData.map(item => ({
      timestamp: new Date(item.timestamp),
      value: item[config.field],
    })).filter(p => p.value !== null && p.value !== undefined);

    if (points.length === 0) return null;

    // Aggressively downsample based on range
    const maxPoints = selectedRange.maxPoints;
    const downsampled = downsample(points, maxPoints);

    // Format labels – show fewer for longer ranges
    const formatLabel = (date) => {
      const range = selectedRange.hours;
      if (range <= 1) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (range <= 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (range <= 168) {
        // Week: show day abbreviation
        return date.toLocaleDateString([], { weekday: 'short' });
      } else {
        // Month: show day number
        return date.toLocaleDateString([], { day: 'numeric' });
      }
    };

    // Show at most 7 labels
    const labelStep = Math.max(1, Math.floor(downsampled.length / 7));
    const labels = downsampled.map((p, i) => (i % labelStep === 0 ? formatLabel(p.timestamp) : ''));

    return {
      labels,
      datasets: [{
        data: downsampled.map(p => p.value),
        color: (opacity = 1) => config.color,
        strokeWidth: 2,
      }],
    };
  };

  const renderStats = () => {
    const values = filteredData
      .map(item => item[config.field])
      .filter(v => v !== null && v !== undefined);
    if (values.length === 0) return <Text style={styles.noData}>No data in this range</Text>;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return (
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Summary</Text>
        <Text>Min: {min.toFixed(1)}{config.unit}</Text>
        <Text>Max: {max.toFixed(1)}{config.unit}</Text>
        <Text>Avg: {avg.toFixed(1)}{config.unit}</Text>
      </View>
    );
  };

  const chartData = prepareChartData();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text>Loading history...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>{sensor.charAt(0).toUpperCase() + sensor.slice(1)} History</Text>

      {isUsingMock && (
        <Text style={{ textAlign: 'center', fontSize: 12, color: '#FFA000', marginBottom: 8 }}>
          ⚡ Offline Demo Data
        </Text>
      )}

      <View style={styles.rangeContainer}>
        {RANGES.map((range) => (
          <TouchableOpacity
            key={range.label}
            style={[
              styles.rangeButton,
              selectedRange.label === range.label && styles.rangeButtonActive,
            ]}
            onPress={() => setSelectedRange(range)}
          >
            <Text style={[
              styles.rangeButtonText,
              selectedRange.label === range.label && styles.rangeButtonTextActive,
            ]}>
              {range.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          {chartData ? (
            <View>
              <View style={styles.chartContainer}>
                <LineChart
                  data={chartData}
                  width={screenWidth - 32}
                  height={220}
                  yAxisLabel=""
                  yAxisSuffix={config.unit}
                  fromZero={true}
                  chartConfig={{
                    backgroundColor: '#ffffff',
                    backgroundGradientFrom: '#ffffff',
                    backgroundGradientTo: '#ffffff',
                    decimalPlaces: 0,
                    color: (opacity = 1) => config.color,
                    style: { borderRadius: 16 },
                    propsForLabels: { fontSize: 10 },
                  }}
                  bezier
                  style={styles.chart}
                  formatXLabel={(label) => label}
                  withDots={false}
                />
              </View>
              {config.optimalRange && (
                <Text style={styles.optimalText}>📈 Optimal range: {config.optimalRange}</Text>
              )}
            </View>
          ) : (
            <Text style={styles.noData}>No data available for this range</Text>
          )}
          {renderStats()}
        </>
      )}
    </ScrollView>
  );
}