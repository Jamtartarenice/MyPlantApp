# plant_api.py
import os
import hashlib
import secrets
from datetime import datetime
from flask import Flask, jsonify, request, g
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool

app = Flask(__name__)
CORS(app)

# Database configuration
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:password@localhost/plant_monitor')

# Connection pool
pool = SimpleConnectionPool(1, 10, dsn=DATABASE_URL)

def get_db():
    """Get a database connection from the pool"""
    if 'db' not in g:
        g.db = pool.getconn()
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    """Return connection to pool when request ends"""
    db = g.pop('db', None)
    if db is not None:
        pool.putconn(db)

def init_db():
    """Create tables if they don't exist"""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sensor_readings (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            light_raw INTEGER,
            light_percent REAL,
            air_temperature REAL,
            air_humidity REAL,
            soil_moisture_raw INTEGER,
            soil_moisture_status TEXT,
            soil_temperature REAL,
            notes TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    print("Database tables created/verified")

# Initialize database when the app starts
@app.before_request
def before_request():
    init_db()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def generate_token():
    return secrets.token_hex(16)

@app.route('/api/latest', methods=['GET'])
def get_latest():
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT 1')
    row = cur.fetchone()
    if row:
        return jsonify(row)
    return jsonify({"error": "No data"}), 404

@app.route('/api/history', methods=['GET'])
def get_history():
    hours = request.args.get('hours', default=24, type=int)
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('''
        SELECT * FROM sensor_readings
        WHERE timestamp >= NOW() - INTERVAL '%s hours'
        ORDER BY timestamp DESC
    ''', (hours,))
    rows = cur.fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/check-alerts', methods=['GET'])
def check_alerts():
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT 1')
    row = cur.fetchone()
    if not row:
        return jsonify({"error": "No data"}), 404
    data = dict(row)
    alerts = []
    if data.get('soil_moisture_status') == 'DRY':
        alerts.append({"type": "water", "message": "Soil is dry – time to water!", "severity": "high"})
    if data.get('air_temperature') and data['air_temperature'] > 30:
        alerts.append({"type": "temperature", "message": f"Temperature high ({data['air_temperature']:.1f}°C)", "severity": "medium"})
    return jsonify({"timestamp": data['timestamp'], "alert_count": len(alerts), "alerts": alerts})

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT id FROM users WHERE username = %s', (username,))
    if cur.fetchone():
        return jsonify({"error": "Username already taken"}), 400

    password_hash = hash_password(password)
    cur.execute('INSERT INTO users (username, password_hash) VALUES (%s, %s)',
                (username, password_hash))
    conn.commit()

    token = generate_token()
    return jsonify({"message": "User created", "token": token}), 201

@app.route('/api/reading', methods=['POST', 'OPTIONS'])
def add_reading():
    if request.method == 'OPTIONS':
        response = app.make_response('')
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST")
        return response
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO sensor_readings 
        (light_raw, light_percent, air_temperature, air_humidity,
         soil_moisture_raw, soil_moisture_status, soil_temperature)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (
        data.get('light_raw'),
        data.get('light_percent'),
        data.get('air_temperature'),
        data.get('air_humidity'),
        data.get('soil_moisture_raw'),
        data.get('soil_moisture_status'),
        data.get('soil_temperature')
    ))
    conn.commit()
    return jsonify({"message": "Reading added"}), 201

@app.route('/api/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        response = app.make_response('')
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST")
        return response

    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT * FROM users WHERE username = %s', (username,))
    user = cur.fetchone()
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    password_hash = hash_password(password)
    if password_hash != user['password_hash']:
        return jsonify({"error": "Invalid credentials"}), 401

    token = generate_token()
    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": {"id": user['id'], "username": user['username'], "created_at": user['created_at']}
    }), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)