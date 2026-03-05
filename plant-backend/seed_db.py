# seed_db.py
import sqlite3
import random
from datetime import datetime, timedelta

DB_PATH = 'plant_data.db'

def seed_sensor_data(days=7, interval_minutes=30):
    """
    Populate sensor_readings with realistic mock data.
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Clear existing sensor data (optional – remove if you want to keep real data)
    c.execute("DELETE FROM sensor_readings")
    print("Cleared existing sensor readings.")

    # Generate timestamps from 'days' ago until now
    end = datetime.now()
    start = end - timedelta(days=days)
    current = start
    count = 0

    while current <= end:
        # Create realistic sensor values
        hour = current.hour
        day_factor = (current - start).days / days  # 0 to 1 over the period

        # Light: higher during day (6am–6pm)
        if 6 <= hour <= 18:
            light_percent = 30 + 60 * (1 - abs(hour - 12)/6) + random.uniform(-5, 5)
        else:
            light_percent = 5 + random.uniform(0, 10)
        light_percent = max(0, min(100, light_percent))
        light_raw = int(light_percent / 100 * 65535)

        # Air temperature: daily cycle + slight trend
        base_temp = 20 + 5 * (1 - abs(hour - 14)/10)  # warmer afternoon
        air_temp = base_temp + random.uniform(-2, 2) + (day_factor * 2)  # slight upward trend

        # Humidity: inverse of temp + random
        air_hum = 70 - (air_temp - 15) * 2 + random.uniform(-5, 5)
        air_hum = max(20, min(90, air_hum))

        # Soil moisture raw (0–1023 typical range)
        # Simulate a drying trend with occasional watering
        # Let's make it drop slowly over time, then spike (watering)
        if random.random() < 0.1:  # 10% chance of "watering" event
            soil_raw = random.randint(700, 900)  # wet
        else:
            # Gradually decreasing over time
            soil_raw = 800 - (day_factor * 500) + random.uniform(-50, 50)
        soil_raw = max(200, min(1023, int(soil_raw)))

        soil_status = "WET" if soil_raw > 500 else "DRY"

        # Soil temperature: slightly below air temp
        soil_temp = air_temp - 2 + random.uniform(-1, 1)

        # Insert
        c.execute('''
            INSERT INTO sensor_readings 
            (timestamp, light_raw, light_percent, air_temperature, air_humidity,
             soil_moisture_raw, soil_moisture_status, soil_temperature)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            current.isoformat(),
            light_raw,
            round(light_percent, 1),
            round(air_temp, 1),
            round(air_hum, 1),
            soil_raw,
            soil_status,
            round(soil_temp, 1)
        ))
        count += 1
        current += timedelta(minutes=interval_minutes)

    conn.commit()
    conn.close()
    print(f"✅ Inserted {count} mock sensor readings.")

def create_test_user(username="testuser", password="password123"):
    """Create a test user for login testing (optional)."""
    import hashlib
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    try:
        c.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)",
                  (username, password_hash))
        conn.commit()
        print(f"✅ Test user '{username}' created.")
    except sqlite3.IntegrityError:
        print(f"⚠️ User '{username}' already exists.")
    finally:
        conn.close()

if __name__ == "__main__":
    seed_sensor_data(days=7, interval_minutes=30)
    create_test_user()  # optional