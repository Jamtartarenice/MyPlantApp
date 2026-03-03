// src/services/mockData.js
// Generates mock sensor data for a week

const generateMockReading = (timestamp) => {
  // Helper to create daily patterns
  const hour = timestamp.getHours();
  const day = timestamp.getDate(); // just for variation

  // Light: high during day (6am-6pm), low at night
  let lightPercent;
  if (hour >= 6 && hour <= 18) {
    // Peak around noon
    const peakFactor = 1 - Math.abs(hour - 12) / 6;
    lightPercent = 30 + 60 * peakFactor + Math.random() * 10;
  } else {
    lightPercent = 5 + Math.random() * 15;
  }
  lightPercent = Math.min(100, Math.max(0, lightPercent));
  const lightRaw = Math.round((lightPercent / 100) * 65535);

  // Air temperature: 15-30°C with daily cycle
  const baseTemp = 20 + 5 * Math.sin((hour - 6) * Math.PI / 12); // warmer afternoon
  const airTemp = baseTemp + (Math.random() * 2 - 1);
  
  // Humidity: 30-80%, higher at night/lower during day
  let humidity = 50 + 20 * Math.sin((hour + 6) * Math.PI / 12) + (Math.random() * 10 - 5);
  humidity = Math.min(80, Math.max(30, humidity));

  // Soil moisture raw (typical range 200-800)
  // Simulate drying trend and occasional watering
  const dayFactor = Math.sin(day * 0.5); // fake long-term trend
  let soilRaw = 300 + 300 * (0.5 + 0.3 * Math.sin(day * 0.8 + hour * 0.1)) + (Math.random() * 100 - 50);
  soilRaw = Math.min(800, Math.max(200, Math.round(soilRaw)));

  // Soil temperature (slightly below air temp)
  const soilTemp = airTemp - 2 + (Math.random() * 2 - 1);

  return {
    timestamp: timestamp.toISOString(),
    light_raw: lightRaw,
    light_percent: parseFloat(lightPercent.toFixed(1)),
    air_temperature: parseFloat(airTemp.toFixed(1)),
    air_humidity: parseFloat(humidity.toFixed(1)),
    soil_moisture_raw: soilRaw,
    soil_temperature: parseFloat(soilTemp.toFixed(1)),
    soil_moisture_status: soilRaw > 500 ? 'WET' : 'DRY',
  };
};

// Generate a week of data with 30-minute intervals
export const generateMockHistory = (days = 7, intervalMinutes = 30) => {
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const data = [];
  
  for (let time = start; time <= now; time = new Date(time.getTime() + intervalMinutes * 60 * 1000)) {
    data.push(generateMockReading(new Date(time)));
  }
  return data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // newest first
};

// Get a single latest reading (most recent from mock history)
export const getMockLatestReading = () => {
  const now = new Date();
  return generateMockReading(now);
};

// For alerts – return some mock alerts occasionally
export const getMockAlerts = () => {
  const shouldAlert = Math.random() > 0.7; // 30% chance of alert
  if (!shouldAlert) return { alert_count: 0, alerts: [] };

  const alertTypes = [
    { type: 'water', message: 'Soil is dry – time to water!', severity: 'high' },
    { type: 'temperature', message: 'Temperature is a bit high', severity: 'medium' },
    { type: 'light', message: 'Low light conditions', severity: 'low' },
  ];
  const randomAlert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
  return {
    alert_count: 1,
    alerts: [randomAlert],
  };
};