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
import styles from '../styles/HistoryScreenStyle'; // import the styles

const screenWidth = Dimensions.get('window').width;
const PI_BASE_URL = 'http://192.168.1.104:5000'; // Replace with your Pi's IP

const RANGES = [
  { label: '1h', hours: 1 },
  { label: '24h', hours: 24 },
  { label: 'Week', hours: 168 },
  { label: 'Month', hours: 720 },
];

export default function HistoryScreen({ route, navigation }) {
  const { sensor } = route.params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [allData, setAllData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedRange, setSelectedRange] = useState(RANGES[1]); // default 24h

  const sensorConfig = {
    temperature: { field: 'air_temperature', unit: '°C', color: '#F5A623', optimalRange: '18–26°C' },
    humidity:    { field: 'air_humidity',    unit: '%',  color: '#50E3C2', optimalRange: '40–60%' },
    light:       { field: 'light_percent',   unit: '%',  color: '#FF6B6B', optimalRange: '30–80%' },
    moisture:    { field: 'soil_moisture_raw', unit: '', color: '#4A90E2', optimalRange: '300–700' },
    soiltemp:    { field: 'soil_temperature', unit: '°C', color: '#8B4513', optimalRange: '15–25°C' },
  };

  const config = sensorConfig[sensor] || sensorConfig.temperature;

  const fetchAllData = async () => {
    try {
      setError(null);
      const response = await fetch(`${PI_BASE_URL}/api/history?hours=720`);
      const data = await response.json();
      if (Array.isArray(data)) {
        const sorted = data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setAllData(sorted);
        filterDataByRange(sorted, selectedRange);
      } else {
        setError('Invalid data format');
      }
    } catch (err) {
      setError('Failed to load history');
      console.log(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterDataByRange = (data, range) => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - range.hours * 60 * 60 * 1000);
    const filtered = data.filter(item => new Date(item.timestamp) >= cutoff);
    setFilteredData(filtered);
  };

  useEffect(() => {
    fetchAllData();
  }, [sensor]);

  useEffect(() => {
    if (allData.length > 0) {
      filterDataByRange(allData, selectedRange);
    }
  }, [selectedRange]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAllData();
  }, []);

  const prepareChartData = () => {
    const points = filteredData.slice(0, 30).reverse().map(item => ({
      timestamp: new Date(item.timestamp),
      value: item[config.field],
    })).filter(p => p.value !== null && p.value !== undefined);

    if (points.length === 0) return null;

    const formatLabel = (date) => {
      if (selectedRange.hours <= 1) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (selectedRange.hours <= 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (selectedRange.hours <= 168) {
        return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit' });
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    };

    const step = Math.max(1, Math.floor(points.length / 6));
    const labels = points.map((p, i) => (i % step === 0 ? formatLabel(p.timestamp) : ''));

    return {
      labels,
      datasets: [{
        data: points.map(p => p.value),
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>{sensor.charAt(0).toUpperCase() + sensor.slice(1)} History</Text>

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
                    decimalPlaces: 1,
                    color: (opacity = 1) => config.color,
                    style: { borderRadius: 16 },
                    propsForLabels: { fontSize: 10 },
                  }}
                  bezier
                  style={styles.chart}
                  formatXLabel={(label) => label}
                />
              </View>
              {config.optimalRange && (
                <Text style={styles.optimalText}>
                  🌿 Optimal range: {config.optimalRange}
                </Text>
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