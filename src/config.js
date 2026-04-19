// Use __DEV__ to detect development mode
const DEV_API_URL = 'http://192.168.1.145:5000';  // local backend IP
const PROD_API_URL = 'https://plant-monitor-api.onrender.com';  // Render URL

export const API_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;