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

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:password@localhost/plant_monitor')
pool = SimpleConnectionPool(1, 10, dsn=DATABASE_URL)

def get_db():
    if 'db' not in g:
        g.db = pool.getconn()
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        pool.putconn(db)

def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS plants (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_plant_access (
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE,
            can_view BOOLEAN DEFAULT TRUE,
            can_receive_alerts BOOLEAN DEFAULT TRUE,
            PRIMARY KEY (user_id, plant_id)
        )
    """)
    cur.execute("""
CREATE TABLE IF NOT EXISTS sensor_readings (
    id SERIAL PRIMARY KEY,
    plant_id INTEGER REFERENCES plants(id),
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
        CREATE TABLE IF NOT EXISTS pending_notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            plant_id INTEGER REFERENCES plants(id),
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            delivered BOOLEAN DEFAULT FALSE
        )
    """)
    conn.commit()

@app.before_request
def before_request():
    init_db()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def generate_token():
    return secrets.token_hex(16)

def get_current_user():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT * FROM users WHERE username = %s', (token,))
    user = cur.fetchone()
    return user

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
    cur.execute('INSERT INTO users (username, password_hash) VALUES (%s, %s)', (username, password_hash))
    conn.commit()
    token = username
    return jsonify({"message": "User created", "token": token}), 201

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
    token = username
    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": {"id": user['id'], "username": user['username'], "created_at": user['created_at']}
    }), 200

@app.route('/api/plants', methods=['GET'])
def get_plants():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT p.id, p.name, p.owner_id, u.username as owner_username,
               (p.owner_id = %s) as is_owner, p.created_at
        FROM plants p
        LEFT JOIN user_plant_access upa ON upa.plant_id = p.id
        LEFT JOIN users u ON u.id = p.owner_id
        WHERE p.owner_id = %s OR upa.user_id = %s
        GROUP BY p.id, u.username, p.owner_id, p.created_at
        ORDER BY p.created_at DESC
    """, (user['id'], user['id'], user['id']))
    plants = cur.fetchall()
    return jsonify(plants), 200

@app.route('/api/plants', methods=['POST'])
def create_plant():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({"error": "Plant name required"}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute('INSERT INTO plants (name, owner_id) VALUES (%s, %s) RETURNING id', (name, user['id']))
    plant_id = cur.fetchone()[0]
    cur.execute('INSERT INTO user_plant_access (user_id, plant_id) VALUES (%s, %s)', (user['id'], plant_id))
    conn.commit()
    return jsonify({"id": plant_id, "name": name, "owner_id": user['id']}), 201

@app.route('/api/plants/<int:plant_id>/share', methods=['POST'])
def share_plant(plant_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.get_json()
    target_username = data.get('username')
    if not target_username:
        return jsonify({"error": "Username required"}), 400
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT owner_id FROM plants WHERE id = %s', (plant_id,))
    plant = cur.fetchone()
    if not plant:
        return jsonify({"error": "Plant not found"}), 404
    if plant['owner_id'] != user['id']:
        return jsonify({"error": "Only the plant owner can share"}), 403
    cur.execute('SELECT id FROM users WHERE username = %s', (target_username,))
    target = cur.fetchone()
    if not target:
        return jsonify({"error": "User not found"}), 404
    if target['id'] == user['id']:
        return jsonify({"error": "You cannot share with yourself"}), 400
    cur.execute('SELECT * FROM user_plant_access WHERE user_id = %s AND plant_id = %s', (target['id'], plant_id))
    if cur.fetchone():
        return jsonify({"error": "Already shared with this user"}), 400
    cur.execute('INSERT INTO user_plant_access (user_id, plant_id) VALUES (%s, %s)', (target['id'], plant_id))
    conn.commit()
    return jsonify({"message": f"Plant shared with {target_username}"}), 200

@app.route('/api/plants/<int:plant_id>/unshare', methods=['DELETE'])
def unshare_plant(plant_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.get_json()
    target_username = data.get('username')
    if not target_username:
        return jsonify({"error": "Username required"}), 400
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT owner_id FROM plants WHERE id = %s', (plant_id,))
    plant = cur.fetchone()
    if not plant:
        return jsonify({"error": "Plant not found"}), 404
    if plant['owner_id'] != user['id']:
        return jsonify({"error": "Only the plant owner can remove sharing"}), 403
    cur.execute('SELECT id FROM users WHERE username = %s', (target_username,))
    target = cur.fetchone()
    if not target:
        return jsonify({"error": "User not found"}), 404
    cur.execute('DELETE FROM user_plant_access WHERE user_id = %s AND plant_id = %s', (target['id'], plant_id))
    conn.commit()
    return jsonify({"message": f"Sharing removed for {target_username}"}), 200

@app.route('/api/latest', methods=['GET'])
def get_latest():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    plant_id = request.args.get('plantId', type=int)
    if not plant_id:
        return jsonify({"error": "plantId required"}), 400
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT 1 FROM plants p
        LEFT JOIN user_plant_access upa ON upa.plant_id = p.id
        WHERE p.id = %s AND (p.owner_id = %s OR upa.user_id = %s)
    """, (plant_id, user['id'], user['id']))
    if not cur.fetchone():
        return jsonify({"error": "Unauthorized to view this plant"}), 403
    cur.execute('SELECT * FROM sensor_readings WHERE plant_id = %s ORDER BY timestamp DESC LIMIT 1', (plant_id,))
    row = cur.fetchone()
    if row:
        return jsonify(dict(row))
    return jsonify({"error": "No data"}), 404

@app.route('/api/history', methods=['GET'])
def get_history():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    plant_id = request.args.get('plantId', type=int)
    if not plant_id:
        return jsonify({"error": "plantId required"}), 400
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT 1 FROM plants p
        LEFT JOIN user_plant_access upa ON upa.plant_id = p.id
        WHERE p.id = %s AND (p.owner_id = %s OR upa.user_id = %s)
    """, (plant_id, user['id'], user['id']))
    if not cur.fetchone():
        return jsonify({"error": "Unauthorized"}), 403
    hours = request.args.get('hours', default=24, type=int)
    cur.execute('''
        SELECT * FROM sensor_readings
        WHERE plant_id = %s AND timestamp >= NOW() - INTERVAL '%s hours'
        ORDER BY timestamp DESC
    ''', (plant_id, hours))
    rows = cur.fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/check-alerts', methods=['GET'])
def check_alerts():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    plant_id = request.args.get('plantId', type=int)
    if not plant_id:
        return jsonify({"error": "plantId required"}), 400
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT 1 FROM plants p
        LEFT JOIN user_plant_access upa ON upa.plant_id = p.id
        WHERE p.id = %s AND (p.owner_id = %s OR upa.user_id = %s)
    """, (plant_id, user['id'], user['id']))
    if not cur.fetchone():
        return jsonify({"error": "Unauthorized"}), 403
    cur.execute('SELECT * FROM sensor_readings WHERE plant_id = %s ORDER BY timestamp DESC LIMIT 1', (plant_id,))
    row = cur.fetchone()
    if not row:
        return jsonify({"error": "No data"}), 404
    data = dict(row)
    alerts = []
    if data.get('soil_moisture_status') == 'DRY':
        alerts.append({"type": "water", "message": "Soil is dry – time to water!", "severity": "high"})
    if data.get('air_temperature') and data['air_temperature'] > 30:
        alerts.append({"type": "temperature", "message": f"Temperature high ({data['air_temperature']:.1f}°C)", "severity": "medium"})
    if alerts:
        cur.execute("""
            SELECT u.id FROM users u
            JOIN user_plant_access upa ON upa.user_id = u.id
            WHERE upa.plant_id = %s AND upa.can_receive_alerts = TRUE
        """, (plant_id,))
        friend_ids = [row2['id'] for row2 in cur.fetchall()]
        for friend_id in friend_ids:
            for alert in alerts:
                cur.execute("""
                    INSERT INTO pending_notifications (user_id, plant_id, message)
                    VALUES (%s, %s, %s)
                """, (friend_id, plant_id, alert['message']))
        conn.commit()
    return jsonify({"timestamp": data['timestamp'], "alert_count": len(alerts), "alerts": alerts})

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
    plant_id = data.get('plant_id')
    if not plant_id:
        return jsonify({"error": "plant_id required"}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO sensor_readings 
        (plant_id, light_raw, light_percent, air_temperature, air_humidity,
         soil_moisture_raw, soil_moisture_status, soil_temperature)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        plant_id,
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

@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT * FROM pending_notifications WHERE user_id = %s AND delivered = FALSE ORDER BY created_at DESC', (user['id'],))
    notifs = cur.fetchall()
    cur.execute('UPDATE pending_notifications SET delivered = TRUE WHERE user_id = %s AND delivered = FALSE', (user['id'],))
    conn.commit()
    return jsonify(notifs), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)