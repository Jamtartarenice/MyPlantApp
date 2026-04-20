// Use __DEV__ to detect development mode
const DEV_API_URL = 'https://plant-monitor-api-1sww.onrender.com';  // local backend IP
const PROD_API_URL = 'https://plant-monitor-api-1sww.onrender.com';  // Render URL

export const API_URL = process.env.NODE_ENV === 'production' ? PROD_API_URL : DEV_API_URL;