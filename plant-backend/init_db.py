import sqlite3

conn = sqlite3.connect('plant_data.db')
c = conn.cursor()

# Create sensor_readings table (same as before)
c.execute('''
    CREATE TABLE IF NOT EXISTS sensor_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        light_raw INTEGER,
        light_percent REAL,
        air_temperature REAL,
        air_humidity REAL,
        soil_moisture_raw INTEGER,
        soil_moisture_status TEXT,
        soil_temperature REAL,
        notes TEXT
    )
''')

# Create users table for authentication
c.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
''')

conn.commit()
conn.close()
print("Database initialized with users table.")