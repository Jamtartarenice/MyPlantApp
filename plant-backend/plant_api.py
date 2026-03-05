#!/usr/bin/env python3
import sqlite3
import hashlib
import secrets
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from datetime import datetime, timedelta

DB_PATH = 'plant_data.db'
app = Flask(__name__)
CORS(app)

# ------------------- Database helpers -------------------
def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

# ------------------- Authentication helpers -------------------
def hash_password(password):
    """Simple hash (use bcrypt in production)"""
    return hashlib.sha256(password.encode()).hexdigest()

def generate_token():
    return secrets.token_hex(16)

# ------------------- Existing endpoints (slightly modified) -------------------
@app.route('/api/latest', methods=['GET'])
def get_latest():
    db = get_db()
    cur = db.execute('SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT 1')
    row = cur.fetchone()
    if row:
        return jsonify(dict(row))
    return jsonify({"error": "No data"}), 404

@app.route('/api/history', methods=['GET'])
def get_history():
    hours = request.args.get('hours', default=24, type=int)
    db = get_db()
    cur = db.execute('''
        SELECT * FROM sensor_readings
        WHERE timestamp >= datetime('now', ?)
        ORDER BY timestamp DESC
    ''', (f'-{hours} hours',))
    rows = cur.fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/check-alerts', methods=['GET'])
def check_alerts():
    db = get_db()
    cur = db.execute('SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT 1')
    row = cur.fetchone()
    if not row:
        return jsonify({"error": "No data"}), 404
    data = dict(row)
    alerts = []
    # (same threshold logic as before)
    if data.get('soil_moisture_status') == 'DRY':
        alerts.append({"type": "water", "message": "Soil is dry – time to water!", "severity": "high"})
    if data.get('air_temperature') and data['air_temperature'] > 30:
        alerts.append({"type": "temperature", "message": f"Temperature high ({data['air_temperature']:.1f}°C)", "severity": "medium"})
    # add more thresholds if needed
    return jsonify({"timestamp": data['timestamp'], "alert_count": len(alerts), "alerts": alerts})

# ------------------- NEW AUTH ENDPOINTS -------------------
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    db = get_db()
    # Check if user exists
    cur = db.execute('SELECT id FROM users WHERE username = ?', (username,))
    if cur.fetchone():
        return jsonify({"error": "Username already taken"}), 400

    password_hash = hash_password(password)
    db.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)',
               (username, password_hash))
    db.commit()

    # Return a token (simple – just a random string; in production use JWT)
    token = generate_token()
    # You could store token in a separate table, but for simplicity we'll just return it
    # For now, we'll assume the client keeps this token.
    return jsonify({"message": "User created", "token": token}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    db = get_db()
    cur = db.execute('SELECT * FROM users WHERE username = ?', (username,))
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
        "user": {
            "id": user['id'],
            "username": user['username'],
            "created_at": user['created_at']
        }
    }), 200
@app.route('/api/user', methods=['GET'])
def get_user():
    # For demonstration, we'll accept a token in the header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Missing or invalid token"}), 401
    token = auth_header.split(' ')[1]
    # In a real app, you'd validate the token against a stored session.
    # For simplicity, we'll just return a dummy user.
    # You could store tokens in a `sessions` table.
    return jsonify({"username": "demo_user"})

if __name__ == '__main__':
    print("🌱 Plant Monitor API with Authentication")
    print("Running on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)