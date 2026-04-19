import sqlite3
import psycopg2
import os

# Connect to SQLite (your existing db)
sqlite_conn = sqlite3.connect('plant_data.db')
sqlite_cursor = sqlite_conn.cursor()

# Connect to PostgreSQL (use your local or Render URL)
pg_conn = psycopg2.connect(os.environ.get('DATABASE_URL', 'postgresql://postgres:password@localhost/plant_monitor'))
pg_cursor = pg_conn.cursor()

# Clear existing data (optional)
pg_cursor.execute("TRUNCATE TABLE sensor_readings RESTART IDENTITY CASCADE")
pg_cursor.execute("TRUNCATE TABLE users RESTART IDENTITY CASCADE")

# Migrate sensor_readings
sqlite_cursor.execute("SELECT * FROM sensor_readings")
rows = sqlite_cursor.fetchall()
for row in rows:
    pg_cursor.execute("""
        INSERT INTO sensor_readings 
        (id, timestamp, light_raw, light_percent, air_temperature, air_humidity,
         soil_moisture_raw, soil_moisture_status, soil_temperature, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, row)

# Migrate users
sqlite_cursor.execute("SELECT * FROM users")
users = sqlite_cursor.fetchall()
for user in users:
    pg_cursor.execute("""
        INSERT INTO users (id, username, password_hash, created_at)
        VALUES (%s, %s, %s, %s)
    """, user)

pg_conn.commit()
pg_conn.close()
sqlite_conn.close()
print("Migration complete!")