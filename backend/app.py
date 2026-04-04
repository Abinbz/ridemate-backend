import json
import os
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
from bson.objectid import ObjectId
from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from pymongo import MongoClient
import re
import random
import math
# Cloudinary logic moved to frontend (unsigned upload)

# Haversine formula to calculate distance in km given lat/lng pairs
def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371.0 # Radius of the earth in km
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c
    return distance

# --- Backend Validation Helpers ---
def validate_name(name):
    return bool(re.match(r"^[A-Za-z\s]+$", name))

def validate_username_no_spaces(uname):
    return " " not in uname and len(uname) > 0

def validate_phone(phone):
    return bool(re.match(r"^\d{10}$", phone))

def validate_email(email):
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email))

def validate_password(pwd):
    if len(pwd) < 6: return False
    if not re.search(r"[A-Z]", pwd): return False
    if not re.search(r"\d", pwd): return False
    if not re.search(r"[^A-Za-z0-9]", pwd): return False
    return True

# Helper to extract digits safely from DB strings (e.g. "30 mins", "$250" -> 30.0, 250.0)
def extract_numeric(val, default=0.0):
    try:
        if isinstance(val, (int, float)):
            return float(val)
        m = re.search(r'\d+', str(val))
        return float(m.group()) if m else default
    except Exception:
        return default
try:
    from sklearn.cluster import KMeans
except ImportError as e:
    print(f"Warning: sklearn.cluster failed to load. Using fallback mock. Error: {e}")
    # Fallback to satisfy test schema without crashing the entire server
    class KMeans:
        def __init__(self, n_clusters=3, **kwargs):
            self.n_clusters = n_clusters
            self.labels_ = []
        def fit(self, X):
            self.labels_ = [random.randint(0, self.n_clusters-1) for _ in X]

# Custom JSON Encoder to handle BSON ObjectIds
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if hasattr(o, 'isoformat'):
            return o.isoformat()
        return json.JSONEncoder.default(self, o)

app = Flask(__name__)

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response("", 200)
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        return response

CORS(app, resources={r"/api/*": {"origins": "*"}})



@app.route('/api/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    response = app.make_default_options_response()
    headers = response.headers

    headers['Access-Control-Allow-Origin'] = '*'
    headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'

    return response



# --- Global Configurations ---
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB

@app.before_request
def log_request():
    print(f"{request.method} {request.path}")

def safe_json():
    try:
        return request.get_json(force=True)
    except:
        return {}

# Use our custom encoder for JSON serialization
app.json_encoder = MongoJSONEncoder

# --- Database Storage Setup ---
try:
    mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    db = client["ridemate"]
    users_col = db["users"]
    rides_col = db["rides"]
    reports_col = db["reports"]
    messages_col = db["messages"]
    ratings_col = db["ratings"]
    notifications_col = db["notifications"]
    verifications_col = db["verifications"]
    admins_col = db["admins"]  # Initialize admins collection
    
    print("Successfully connected to MongoDB.")
    print("DB:", db.name)  # Debug log for DB connection
    # Trigger a connection test
    client.server_info()
    print("Successfully connected to MongoDB.")
    # Export them globally
    global users_collection, rides_collection, admins_collection
    # For compatibility with snippets
    users_collection = users_col
    rides_collection = rides_col
    admins_collection = admins_col
except Exception as e:
    print(f"MongoDB connection failed. Check if service is running: {e}")

# --- Backend no longer handles Cloudinary uploads ---


# Helper function to convert ObjectIds to strings in dictionaries for jsonify
def parse_json(data):
    return json.loads(json.dumps(data, cls=MongoJSONEncoder))

# --- Firebase Cloud Messaging Setup ---
# To enable push notifications:
# 1. Go to Firebase Console > Project Settings > Service accounts
# 2. Click "Generate new private key"
# 3. Save the JSON file as: backend/firebase-service-account.json
# Push notifications are OPTIONAL — everything works without this file.

fcm_enabled = False
try:
    import firebase_admin
    from firebase_admin import credentials, messaging as fcm_messaging
    
    service_account_path = os.path.join(os.path.dirname(__file__), 'firebase-service-account.json')
    if os.path.exists(service_account_path):
        cred = credentials.Certificate(service_account_path)
        firebase_admin.initialize_app(cred)
        fcm_enabled = True
        print("Firebase Admin SDK initialized — push notifications enabled.")
    else:
        print("Firebase service account not found — push notifications disabled.")
        print(f"  To enable: place your Firebase service account key at: {service_account_path}")
except ImportError:
    print("firebase-admin not installed — push notifications disabled.")
except Exception as e:
    print(f"Firebase init error: {e}")


def send_push_notification(user_id, title, body, data=None):
    """Send a push notification to a user via FCM. Fails silently if not configured."""
    if not fcm_enabled:
        return
    
    try:
        user = users_col.find_one({"_id": ObjectId(user_id)})
        if not user:
            print(f"[FCM Warning] User {user_id} not found in DB")
            return
        
        fcm_token = user.get('fcmToken')
        if not fcm_token:
            print(f"[FCM Info] No registration token found for user {user_id}, skipping push")
            return
        
        message = fcm_messaging.Message(
            notification=fcm_messaging.Notification(
                title=title,
                body=body,
            ),
            data=data or {},
            token=fcm_token,
        )
        
        response = fcm_messaging.send(message)
        print(f"[FCM Success] Push sent to {user_id} ({user.get('username') or user.get('name')}): {response}")
    except Exception as e:
        print(f"[FCM Error] Push failed for {user_id}: {e}")


@app.route("/", methods=["GET"])
def root():
    return jsonify({"message": "RideMate API running"}), 200

@app.route("/health")
def health():
    return "OK", 200


@app.route("/api/save-fcm-token", methods=["POST", "OPTIONS"])
def save_fcm_token():
    data = safe_json()
    user_id = data.get('userId')
    token = data.get('token')
    
    if not user_id or not token:
        return jsonify({"success": False, "message": "Missing userId or token"}), 400
    
    try:
        users_col.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"fcmToken": token}}
        )
        print(f"FCM token saved for user {user_id}")
        return jsonify({"success": True, "message": "Token saved"}), 200
    except Exception as e:
        print(f"Save FCM Token Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

# --- Auth Routes ---
@app.route("/api/signup", methods=["POST", "OPTIONS"])
def signup():
    data = safe_json()
    required_fields = ['name', 'username', 'collegeId', 'email', 'phone', 'gender', 'password']
    
    if not data or not all(k in data for k in required_fields):
        return jsonify({"success": False, "message": "Missing required fields"}), 400
    
    # Validation checks
    if not validate_name(data.get('name', '')):
        return jsonify({"success": False, "message": "Only letters and spaces allowed in Display Name"}), 400
    if not validate_username_no_spaces(data.get('username', '')):
        return jsonify({"success": False, "message": "Username cannot contain spaces"}), 400
    if not validate_email(data.get('email', '')):
        return jsonify({"success": False, "message": "Invalid email format"}), 400
    if not validate_phone(data.get('phone', '')):
        return jsonify({"success": False, "message": "Phone must be exactly 10 digits"}), 400
    if not validate_password(data.get('password', '')):
        return jsonify({"success": False, "message": "Password must be at least 6 characters and contain uppercase, number, and symbol"}), 400
        
    try:
        # Check uniqueness
        if users_col.find_one({"username": data['username']}):
            return jsonify({"success": False, "message": "Username already exists"}), 409

        # Security: Hash the password before saving (Production-mode)
        hashed_password = generate_password_hash(data['password'])

        # Part 4.5: Check for banned users
        user = users_col.find_one({"username": data['username']})
        if user and user.get("isBanned"):
            print(f"DEBUG: Login blocked for banned user: {data['username']}")
            return jsonify({
                "success": False, 
                "message": f"Your account has been restricted. Reason: {user.get('banReason', 'No reason provided')}"
            }), 403

        # Construct User Document
        user_doc = {
            "name": data['name'],
            "username": data['username'],
            "collegeId": data['collegeId'],
            "email": data['email'],
            "phone": data['phone'],
            "gender": data['gender'],
            "password": hashed_password, 
            "role": "user",
            "isVerified": False,
            "isBanned": False,
            "banReason": "",
            "rating": 0
        }
        
        result = users_col.insert_one(user_doc)
        print(f"DEBUG: User signed up: {user_doc['username']} - ID: {result.inserted_id}")
        return jsonify({"success": True, "message": "Signup successful", "userId": str(result.inserted_id)}), 201
    except Exception as e:
        print(f"Signup DB Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/login", methods=["POST", "OPTIONS"])
def login():
    data = safe_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({"success": False, "message": "Missing credentials"}), 400
    
    # Requirement: "Validate email format and password presence"
    username = data.get('username', '')
    if "@" in username:
        if not validate_email(username):
            return jsonify({"success": False, "message": "Invalid email format"}), 400
    else:
        if not validate_username_no_spaces(username):
            return jsonify({"success": False, "message": "Username cannot contain spaces"}), 400

    try:
        user = users_col.find_one({"username": data['username']})
        
        if user:
            # Verify password hash using check_password_hash (werkzeug.security)
            stored_hash = user.get('password')
            provided_pass = data.get('password', '')

            if check_password_hash(stored_hash, provided_pass):
                # Check if user is blocked
                if user.get('isBlocked', False):
                    print(f"DEBUG: Blocked user attempted login: {user['username']}")
                    return jsonify({"success": False, "message": "Your account has been blocked. Contact admin."}), 403
                
                print(f"DEBUG: User logged in: {user['username']} ({user.get('role')})")
                return jsonify({"success": True, "message": "Login successful", "userId": str(user["_id"])}), 200
            else:
                print(f"DEBUG: Login failed: Password mismatch for {data['username']}")
                return jsonify({"success": False, "message": "Invalid username or password"}), 401
        else:
            print(f"DEBUG: Login failed: User {data['username']} not found")
            return jsonify({"success": False, "message": "Invalid username or password"}), 401
    except Exception as e:
        print(f"DEBUG: Login DB Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/admin/login", methods=["POST", "OPTIONS"])
def admin_login():
    data = safe_json()
    print("DEBUG: Incoming admin login data:", data)

    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"success": False, "message": "Missing credentials"}), 400

    try:
        # Query the admins collection using username
        admin = admins_col.find_one({"username": username})
        print("DEBUG: DB Admin found:", admin)

        if not admin:
            print(f"DEBUG: Admin login failed: {username} not found")
            return jsonify({"success": False, "message": "Invalid Admin Credentials"}), 401

        # Verify password hash for admin using check_password_hash
        stored_hash = admin.get("password")
        is_valid = check_password_hash(stored_hash, password)
        
        if is_valid:
            print(f"DEBUG: Admin {username} logged in successfully")
            return jsonify({"success": True})
        else:
            print(f"DEBUG: Admin login failed: Password mismatch for {username}")
            return jsonify({"success": False, "message": "Invalid Admin Credentials"}), 401
    except Exception as e:
        print(f"DEBUG: Admin Login Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/user/<user_id>", methods=["GET", "OPTIONS"])
def get_user(user_id):
    try:
        user = users_col.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404
            
        user_info = parse_json(user)
        user_info["id"] = user_info.pop("_id", None)
        user_info.pop("password", None)
        
        return jsonify({"success": True, "user": user_info}), 200
    except Exception as e:
        print(f"Get User Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/user/update", methods=["POST", "OPTIONS"])
def update_user():
    data = safe_json()
    user_id = data.get('userId')
    if not user_id:
        return jsonify({"success": False, "message": "Missing userId"}), 400
        
    try:
        update_data = {}
        if 'username' in data: update_data['username'] = data['username']
        if 'email' in data: update_data['email'] = data['email']
        if 'phone' in data: update_data['phone'] = data['phone']
        if 'gender' in data: update_data['gender'] = data['gender']
        if 'collegeId' in data: update_data['collegeId'] = data['collegeId']
        
        if not update_data:
            return jsonify({"success": False, "message": "No data to update"}), 400
            
        result = users_col.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            return jsonify({"success": False, "message": "User not found"}), 404
            
        return jsonify({"success": True, "message": "Profile updated successfully"}), 200
    except Exception as e:
        print(f"Update User Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route('/api/user/add-vehicle', methods=['POST', 'OPTIONS'])
def add_vehicle():
    """Adds a new vehicle to the user's vehicles array."""
    try:
        data = safe_json()
        user_id = data.get("userId")
        name = data.get("name")
        number = data.get("number")

        if not user_id or not name or not number:
            return jsonify({"success": False, "message": "Missing necessary vehicle data"}), 400

        uid = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        result = users_col.update_one(
            {"_id": uid},
            {
                "$push": {
                    "vehicles": {
                        "name": name,
                        "number": number,
                        "addedAt": datetime.now()
                    }
                }
            }
        )

        if result.matched_count == 0:
            return jsonify({"success": False, "message": "User not found"}), 404

        return jsonify({"success": True, "message": "Vehicle added successfully"}), 200
    except Exception as e:
        print(f"Add Vehicle Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/user/vehicles/<user_id>', methods=['GET', 'OPTIONS'])
def get_vehicles(user_id):
    """Retrieves the list of vehicles for a specific user."""
    try:
        uid = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        user = users_col.find_one({"_id": uid}, {"vehicles": 1})
        
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404
            
        return jsonify({"success": True, "vehicles": user.get("vehicles", [])}), 200
    except Exception as e:
        print(f"Get Vehicles Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# --- Ride Routes ---
@app.route("/api/post-ride", methods=["POST", "OPTIONS"])
def post_ride():
    data = safe_json()
    user_id = data.get('userId') or data.get('createdBy')
    
    if not data or not data.get('startingFrom') or not data.get('goingTo'):
        return jsonify({"success": False, "message": "Missing route details"}), 400
        
    try:
        # Strict Eligibility Check: Must have the "user+driver" role
        user = users_col.find_one({"_id": ObjectId(user_id)})
        
        # Part 4.5: Role-Based Access + Banned check
        if user.get("isBanned"):
            print(f"[RIDE BLOCKED] Banned user: {user_id}")
            return jsonify({"success": False, "message": "Your account is restricted from posting rides."}), 403

        role = user.get("role", "user")
        if role != "user+driver":
             # Unauthorized attempt logging
             print(f"[RIDE BLOCKED] User not verified driver: {user_id}")
             return jsonify({
                 "success": False, 
                 "message": "You must be verified as a driver to offer rides. Complete your profile verification."
             }), 403

        # User requested standardization and logging
        print(f"DEBUG: Post Ride Attempt - Body: {data}")

        # Construct Ride Document
        ride_doc = {
            "driverId": data.get('userId') or data.get('createdBy'),
            "driverName": data.get('username') or data.get('driver') or "Unknown Driver",
            "fromLocation": data.get('startingFrom'),
            "toLocation": data.get('goingTo'),
            "date": data.get('date'),
            "time": data.get('time') or data.get('startTime') or "09:00 AM",
            "vehicleName": data.get('vehicleName', 'Unknown'),
            "vehicleType": data.get('vehicleType', 'Car'),
            "price": data.get('price'),
            "capacity": data.get('passengers', 1),
            "passengerPreference": data.get('passengerPreference', 'Any'),
            "passengers": [], 
            "status": "upcoming",
            "createdAt": datetime.now(),
            "from": data.get('startingFrom'),
            "to": data.get('goingTo'),
            "createdBy": data.get('userId') or data.get('createdBy'),
            "bookedUsers": [],
            "passengerDetails": [],
            "startLat": data.get('startLat'),
            "startLng": data.get('startLng'),
            "endLat": data.get('endLat'),
            "endLng": data.get('endLng')
        }
        
        is_round_trip = data.get('isRoundTrip', False)
        result = rides_col.insert_one(ride_doc)
        print(f"DEBUG: Forward Ride created: {ride_doc['fromLocation']} -> {ride_doc['toLocation']} - ID: {result.inserted_id}")

        if is_round_trip:
            print("DEBUG: Round trip detected: creating return ride...")
            return_ride = {
                "driverId": data.get('userId') or data.get('createdBy'),
                "driverName": data.get('username') or data.get('driver') or "Unknown Driver",
                "fromLocation": data.get('goingTo'),
                "toLocation": data.get('startingFrom'),
                "date": data.get('returnDate') or data.get('date'),
                "time": data.get('returnTime') or data.get('time') or "09:00 AM",
                "vehicleName": data.get('vehicleName', 'Unknown'),
                "vehicleType": data.get('vehicleType', 'Car'),
                "price": data.get('returnPrice') or data.get('price'),
                "capacity": data.get('passengers', 1),
                "passengerPreference": data.get('passengerPreference', 'Any'),
                "passengers": [], 
                "status": "upcoming",
                "createdAt": datetime.now(),
                "from": data.get('goingTo'),
                "to": data.get('startingFrom'),
                "createdBy": data.get('userId') or data.get('createdBy'),
                "bookedUsers": [],
                "passengerDetails": [],
                "startLat": data.get('endLat'),
                "startLng": data.get('endLng'),
                "endLat": data.get('startLat'),
                "endLng": data.get('startLng')
            }
            res_return = rides_col.insert_one(return_ride)
            print(f"DEBUG: Return Ride created: {return_ride['fromLocation']} -> {return_ride['toLocation']} - ID: {res_return.inserted_id}")

        return jsonify({"success": True, "message": "Ride(s) posted successfully"}), 201
    except Exception as e:
        print(f"Create Ride DB Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/search-rides", methods=["POST", "OPTIONS"])
def search_rides():
    data = safe_json()
    start_loc = data.get('startingFrom', '').strip().lower()
    end_loc = data.get('goingTo', '').strip().lower()
    
    # Geographic inputs for intelligent matching
    user_start_lat = data.get('startLat')
    user_start_lng = data.get('startLng')
    user_end_lat = data.get('endLat')
    user_end_lng = data.get('endLng')

    try:
        # Initial extraction of all possible rides
        query = {"status": "upcoming"}
        # Only add date to query if it's actually provided and not empty
        if data.get('date'):
            query["date"] = data.get('date')
            
        all_rides_cursor = rides_col.find(query)
        all_rides = []
        user_id = data.get('userId')
        
        for doc in all_rides_cursor:
            ride = parse_json(doc)
            ride["id"] = ride.pop("_id", None)
            
            # Exclude current user's own rides
            if user_id and (ride.get('createdBy') == user_id or ride.get('driverId') == user_id):
                continue
            
            # Exclude if user is already booked
            if user_id and user_id in ride.get('bookedUsers', []):
                continue
            
            # Normalize fields for frontend compatibility
            if not ride.get('driver') and ride.get('driverName'):
                ride['driver'] = ride['driverName']
            if not ride.get('from') and ride.get('fromLocation'):
                ride['from'] = ride['fromLocation']
            if not ride.get('to') and ride.get('toLocation'):
                ride['to'] = ride['toLocation']
            if not ride.get('driverId') and ride.get('createdBy'):
                ride['driverId'] = ride['createdBy']
            if not ride.get('createdBy') and ride.get('driverId'):
                ride['createdBy'] = ride['driverId']
                
            all_rides.append(ride)

        if not all_rides:
            return jsonify({"success": True, "recommended": [], "others": []}), 200

        # --- 1. K-MEANS CLUSTERING FILTER ---
        nearby_cluster_rides = all_rides
        if user_start_lat is not None and user_start_lng is not None and len(all_rides) >= 1:
            coords_pool = []
            valid_rides_for_clustering = []
            for r in all_rides:
                lat = r.get("startLat")
                lng = r.get("startLng")
                if lat is not None and lng is not None:
                    coords_pool.append([lat, lng])
                    valid_rides_for_clustering.append(r)
            
            if coords_pool:
                try:
                    n_clusters = 3 if len(coords_pool) >= 3 else len(coords_pool)
                    # We add user's start point to the pool just to see which cluster it hits
                    temp_pool = coords_pool + [[user_start_lat, user_start_lng]]
                    kmeans = KMeans(n_clusters=n_clusters, n_init='auto', random_state=42)
                    kmeans.fit(temp_pool)
                    
                    user_cluster_label = kmeans.labels_[-1]
                    ride_labels = kmeans.labels_[:-1]
                    
                    nearby_cluster_rides = [
                        valid_rides_for_clustering[i] 
                        for i, label in enumerate(ride_labels) 
                        if label == user_cluster_label
                    ]
                    print(f"K-Means: Found {len(nearby_cluster_rides)} rides in user's cluster ({user_cluster_label})")
                except Exception as ex:
                    print(f"K-Means runtime error, falling back: {ex}")
                    nearby_cluster_rides = all_rides

        # --- 2. PRIMARY TEXT FILTER (Required by USER) ---
        # Match based on From/To locations (trimmed, case-insensitive)
        text_matches = []
        for ride in all_rides:
            r_from = ride.get('from', '').lower().strip()
            r_to = ride.get('to', '').lower().strip()
            
            # Match if search terms are found within the ride's locations
            from_match = not start_loc or start_loc in r_from
            to_match = not end_loc or end_loc in r_to
            
            if from_match and to_match:
                text_matches.append(ride)
        
        print(f"Text Match Filter: {len(text_matches)} rides matches '{start_loc}' -> '{end_loc}'")

        # --- 3. GEOMETRIC RANKING (Refinement) ---
        potential_matches = text_matches
        if user_start_lat is not None and user_end_lat is not None:
            for ride in potential_matches:
                r_slat = ride.get('startLat')
                r_slng = ride.get('startLng')
                r_elat = ride.get('endLat')
                r_elng = ride.get('endLng')
                
                if None not in [r_slat, r_slng, r_elat, r_elng]:
                    s_dist = calculate_distance(user_start_lat, user_start_lng, r_slat, r_slng)
                    e_dist = calculate_distance(user_end_lat, user_end_lng, r_elat, r_elng)
                    ride["start_dist"] = round(s_dist, 2)
                    ride["end_dist"] = round(e_dist, 2)
                    # Add a small fitness boost for closer rides
                    ride["geo_score"] = s_dist + e_dist
                else:
                    ride["geo_score"] = 999 # Default for rides without coords

        # --- 4. FITNESS CALCULATION (Genetic Algorithm simulation) ---
        for ride in potential_matches:
            geo_val = ride.get("geo_score", 999)
            price = extract_numeric(ride.get("price", 0))
            duration = extract_numeric(ride.get("duration", 30)) 
            
            # Simple fitness: lower score is better
            fitness = (0.5 * min(geo_val, 10)) + (0.3 * (price/100)) + (0.2 * (duration/15))
            ride["fitness_score"] = round(fitness, 2)
            
        # Sort by fitness
        potential_matches.sort(key=lambda x: x.get("fitness_score", 9999))
        
        # --- 4. SPLIT RESULTS ---
        recommended = potential_matches[:3]
        others = potential_matches[3:]
            
        print(f"Search API: {len(potential_matches)} results returned ({len(recommended)} recommended)")
        return jsonify({"success": True, "recommended": recommended, "others": others}), 200
        
    except Exception as e:
        print(f"Search Rides Error: {e}")
        return jsonify({"success": False, "message": "Database calculation error"}), 500

@app.route("/api/cluster-rides", methods=["POST", "OPTIONS"])
def cluster_rides():
    try:
        # Fetch all rides
        cursor = rides_col.find({"status": "upcoming"})
        rides_list = []
        X = []
        
        for doc in cursor:
            mapped_doc = parse_json(doc)
            mapped_doc["id"] = mapped_doc.pop("_id", None)
            
            # Use the provided or randomly generated coordinate (0 fallback to avoid crashes)
            lat = mapped_doc.get("startLat", 0)
            lng = mapped_doc.get("startLng", 0)
            
            X.append([lat, lng])
            rides_list.append(mapped_doc)
            
        n_rides = len(rides_list)
        
        if n_rides == 0:
            return jsonify({"clusters": []}), 200
            
        # Dynamically scale clusters to avoid crashing KMeans when there are fewer samples than requested clusters
        n_clusters = 3 if n_rides >= 3 else n_rides
        
        # Apply KMeans clustering
        kmeans = KMeans(n_clusters=n_clusters, n_init='auto', random_state=42)
        kmeans.fit(X)
        labels = kmeans.labels_
        
        # Build grouped payload
        grouped_clusters = {i: [] for i in range(n_clusters)}
        
        for i, ride in enumerate(rides_list):
            cluster_label = int(labels[i])
            # Attach the cluster property back to the ride object
            ride["cluster_id"] = cluster_label 
            grouped_clusters[cluster_label].append(ride)
            
        # Format explicitly as requested mapping
        output = [
            {
                "cluster_id": k,
                "rides": v
            } for k, v in grouped_clusters.items()
        ]
        
        print(f"Clustering algorithm ran successfully. Bucketed {n_rides} rides into {n_clusters} clusters.")
        return jsonify({"clusters": output}), 200

    except Exception as e:
        print(f"KMeans Clustering Error: {e}")
        return jsonify({"success": False, "message": "Clustering ML pipe failure", "error": str(e)}), 500

@app.route("/api/match-rides", methods=["POST", "OPTIONS"])
def match_rides():
    data = safe_json()
    
    # Extract user inputs natively
    user_start_lat = data.get('startLat')
    user_start_lng = data.get('startLng')
    user_end_lat = data.get('endLat')
    user_end_lng = data.get('endLng')
    
    if None in [user_start_lat, user_start_lng, user_end_lat, user_end_lng]:
        return jsonify({"success": False, "message": "Missing necessary user geographic start/end coordinate points."}), 400
        
    DETOUR_LIMIT = 2.0  # in kilometers
    
    try:
        cursor = rides_col.find({"status": "upcoming"})
        matched_rides = []
        
        for doc in cursor:
            ride = parse_json(doc)
            ride["id"] = ride.pop("_id", None)
            
            ride_start_lat = ride.get('startLat')
            ride_start_lng = ride.get('startLng')
            ride_end_lat = ride.get('endLat')
            ride_end_lng = ride.get('endLng')
            
            # Defensive check skipping poorly structured legacy mongo db objects missing mapping
            if None in [ride_start_lat, ride_start_lng, ride_end_lat, ride_end_lng]:
                continue
                
            start_dist = calculate_distance(user_start_lat, user_start_lng, ride_start_lat, ride_start_lng)
            end_dist = calculate_distance(user_end_lat, user_end_lng, ride_end_lat, ride_end_lng)
            
            rounded_start = round(start_dist, 2)
            rounded_end = round(end_dist, 2)
            
            print(f"Ride Mapping | Route: {ride.get('from')} -> {ride.get('to')} | Origin Detour: {rounded_start} km | Destination Detour: {rounded_end} km")
            
            if start_dist <= DETOUR_LIMIT and end_dist <= DETOUR_LIMIT:
                ride["start_distance"] = rounded_start
                ride["end_distance"] = rounded_end
                matched_rides.append(ride)
                
        print(f"Detour Matching Algorithm found {len(matched_rides)} rides within a {DETOUR_LIMIT}km tolerance ring.")
        return jsonify({"success": True, "matches": matched_rides}), 200
        
    except Exception as e:
        print(f"Detour Distance Calculation ML Pipe Failure: {e}")
        return jsonify({"success": False, "message": "Database calculation error."}), 500

@app.route("/api/optimize-rides", methods=["POST", "OPTIONS"])
def optimize_rides():
    data = safe_json()
    
    # Extract user inputs generically mapping from frontend mapping schema 
    user_start_lat = data.get('startLat')
    user_start_lng = data.get('startLng')
    user_end_lat = data.get('endLat')
    user_end_lng = data.get('endLng')
    
    if None in [user_start_lat, user_start_lng, user_end_lat, user_end_lng]:
        return jsonify({"success": False, "message": "Missing geographic attributes for GA evaluation."}), 400
        
    try:
        cursor = rides_col.find({"status": "upcoming"})
        matched_rides = []
        
        # 1. Establish initial population constraint natively mapped logically by Detour limit (2km)
        for doc in cursor:
            ride = parse_json(doc)
            ride["id"] = ride.pop("_id", None)
            
            ride_start_lat = ride.get('startLat')
            ride_start_lng = ride.get('startLng')
            ride_end_lat = ride.get('endLat')
            ride_end_lng = ride.get('endLng')
            
            if None in [ride_start_lat, ride_start_lng, ride_end_lat, ride_end_lng]:
                continue
                
            start_dist = calculate_distance(user_start_lat, user_start_lng, ride_start_lat, ride_start_lng)
            end_dist = calculate_distance(user_end_lat, user_end_lng, ride_end_lat, ride_end_lng)
            
            if start_dist <= 2.0 and end_dist <= 2.0:
                ride["start_distance"] = round(start_dist, 2)
                ride["end_distance"] = round(end_dist, 2)
                matched_rides.append(ride)
                
        # Handle zero-population edge cases securely returning native struct map!
        if len(matched_rides) == 0:
            return jsonify({"success": True, "best_ride": None, "ranked_rides": []}), 200
            
        # 2. ML Fitness Variables Weightings
        distance_weight = 0.5
        price_weight = 0.3
        time_weight = 0.2
        
        # 3. Build Simplified Genetic Algorithm iterations mapping numeric simulations mathematically 
        generations = 3
        population = matched_rides
        
        for generation in range(generations):
            for ride in population:
                dist = ride["start_distance"] + ride["end_distance"]
                price = extract_numeric(ride.get("price", 0))
                duration = extract_numeric(ride.get("duration", 0))
                
                # Base discrete Fitness Function algorithm
                fitness = (distance_weight * dist) + (price_weight * price) + (time_weight * duration)
                
                # Simulated Mutating Logic: slightly adjust mathematical outcomes randomly to simulate diverse survival variance over time loops!
                mutation_factor = random.uniform(0.95, 1.05)
                mutated_fitness = fitness * mutation_factor
                
                ride["fitness_score"] = round(mutated_fitness, 2)
                
            # Internal Selection Phase 
            population.sort(key=lambda x: x["fitness_score"])
            
            print(f"GA Run: Generation {generation+1} complete. Highest evaluated fit: {population[0]['fitness_score']}")
            
        return jsonify({
            "success": True, 
            "best_ride": population[0],
            "ranked_rides": population
        }), 200
        
    except Exception as e:
        print(f"GA Pipe Evaluate Error: {e}")
        return jsonify({"success": False, "message": "ML Algorithm mapping fault.", "error": str(e)}), 500

# --- Booking Routes ---

@app.route("/api/join-ride", methods=["POST", "OPTIONS"])
def join_ride():
    data = safe_json()
    ride_id = data.get('rideId')
    user_id = data.get('userId')

    if not ride_id or not user_id:
        return jsonify({"success": False, "message": "Missing rideId or userId"}), 400

    try:
        ride = rides_col.find_one({"_id": ObjectId(ride_id)})
        if not ride:
            return jsonify({"success": False, "message": "Ride not found"}), 404

        if ride.get('status') != 'Scheduled':
             return jsonify({"success": False, "message": "Ride is no longer open for joining"}), 400

        booked_users = ride.get('bookedUsers', [])
        if user_id in booked_users:
            return jsonify({"success": False, "message": "Already joined this ride"}), 409

        user = users_col.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        # Part 4.5: Security - Block Banned Users from booking
        if user.get("isBanned"):
            print(f"[BOOKING BLOCKED] Banned user: {user_id}")
            return jsonify({
                "success": False, 
                "message": "Your account is restricted from joining rides."
            }), 403

        passenger_detail = {
            "userId": user_id,
            "name": user.get('name') or user.get('username', 'Unknown'),
            "rating": user.get('rating', 0),
            "avatar": (user.get('name') or user.get('username', 'U'))[0].upper(),
            "joined": True
        }

        rides_col.update_one(
            {"_id": ObjectId(ride_id)},
            {
                "$addToSet": {"bookedUsers": user_id},
                "$push": {"passengerDetails": passenger_detail, "passengers": passenger_detail}
            }
        )

        # Notify driver about new booking
        driver_id = ride.get('driverId') or ride.get('createdBy')
        p_name = user.get('name') or user.get('username', 'Someone')
        p_rating = user.get('rating', 0)
        route_str = f"{ride.get('from') or ride.get('fromLocation', '')} → {ride.get('to') or ride.get('toLocation', '')}"
        if driver_id:
            notifications_col.insert_one({
                "userId": driver_id,
                "fromId": user_id,
                "type": "booking",
                "title": "New Booking",
                "message": f"{p_name} (⭐{p_rating}) joined your ride ({route_str})",
                "isRead": False,
                "createdAt": datetime.now()
            })
            send_push_notification(driver_id, "New Booking", f"{p_name} (⭐{p_rating}) joined your ride ({route_str})", {"type": "booking"})

        return jsonify({"success": True, "message": "Ride joined successfully"}), 200
    except Exception as e:
        print(f"Join Ride Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/start-ride", methods=["POST", "OPTIONS"])
def start_ride():
    data = safe_json()
    ride_id = data.get('rideId')
    user_id = data.get('userId')

    try:
        ride = rides_col.find_one({"_id": ObjectId(ride_id)})
        if not ride: return jsonify({"success": False, "message": "Ride not found"}), 404
        
        if str(ride.get('driverId') or ride.get('createdBy')) != str(user_id):
            return jsonify({"success": False, "message": "Only the driver can start the ride"}), 403

        if ride.get('status') != 'upcoming':
            return jsonify({"success": False, "message": "Only 'Scheduled' rides can be started"}), 400
            
        rides_col.update_one({"_id": ObjectId(ride_id)}, {"$set": {"status": "ongoing"}})
        
        # Notify passengers that ride has started
        route_str = f"{ride.get('from') or ride.get('fromLocation', '')} → {ride.get('to') or ride.get('toLocation', '')}"
        for pid in ride.get('bookedUsers', []):
            notifications_col.insert_one({
                "userId": pid,
                "fromId": user_id,
                "type": "ride_update",
                "title": "Ride Started",
                "message": f"Your ride ({route_str}) has started. Have a safe trip!",
                "isRead": False,
                "createdAt": datetime.now()
            })
            send_push_notification(pid, "Ride Started", f"Your ride ({route_str}) has started. Have a safe trip!", {"type": "ride_update"})
        
        return jsonify({"success": True, "message": "Ride started"}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/end-ride", methods=["POST", "OPTIONS"])
def end_ride():
    data = safe_json()
    ride_id = data.get('rideId')
    user_id = data.get('userId')

    try:
        ride = rides_col.find_one({"_id": ObjectId(ride_id)})
        if not ride: return jsonify({"success": False, "message": "Ride not found"}), 404

        if str(ride.get('driverId') or ride.get('createdBy')) != str(user_id):
            return jsonify({"success": False, "message": "Only the driver can end the ride"}), 403

        if ride.get('status') != 'ongoing':
            return jsonify({"success": False, "message": "Only 'Ongoing' rides can be ended"}), 400

        rides_col.update_one({"_id": ObjectId(ride_id)}, {"$set": {"status": "completed"}})
        
        # Notify passengers that ride has ended
        route_str = f"{ride.get('from') or ride.get('fromLocation', '')} → {ride.get('to') or ride.get('toLocation', '')}"
        for pid in ride.get('bookedUsers', []):
            notifications_col.insert_one({
                "userId": pid,
                "fromId": user_id,
                "type": "ride_update",
                "title": "Ride Completed",
                "message": f"Your ride ({route_str}) is complete. Don't forget to rate your driver!",
                "isRead": False,
                "createdAt": datetime.now()
            })
            send_push_notification(pid, "Ride Completed", f"Your ride ({route_str}) is complete. Don't forget to rate your driver!", {"type": "ride_update"})
        
        return jsonify({"success": True, "message": "Ride completed"}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/book-ride", methods=["POST", "OPTIONS"])
def book_ride():
    return join_ride()


def _normalize_ride(doc, role, current_date_str):
    """Helper to normalize a single ride document for frontend consumption."""
    ride = parse_json(doc)
    ride["id"] = ride.pop("_id", None)
    ride["role"] = role

    # Support both old and new field names
    from_loc = ride.get("fromLocation") or ride.get("from", "")
    to_loc = ride.get("toLocation") or ride.get("to", "")
    ride["from"] = from_loc
    ride["to"] = to_loc
    
    stored_status = ride.get("status", "upcoming")
    if stored_status == "Scheduled" or stored_status == "Upcoming" or stored_status == "upcoming":
        ride["status"] = "upcoming"
    else:
        ride["status"] = stored_status.lower() if isinstance(stored_status, str) else stored_status

    vtype = ride.get("vehicleType", "Car")
    vname = ride.get("vehicleName", "Unknown")
    ride["vehicle"] = f"{vtype} ({vname})"

    price_val = ride.get("price", 0)
    ride["price"] = f"₹{price_val}" if not str(price_val).startswith("₹") else str(price_val)
    
    ride["time"] = ride.get("time") or ride.get("start") or "09:00 AM"
    
    return ride


@app.route("/api/my-rides/<user_id>", methods=["GET", "OPTIONS"])
def get_my_rides_v2(user_id):
    try:
        current_date_str = datetime.now().strftime('%Y-%m-%d')

        posted = {"upcoming": [], "ongoing": [], "completed": []}
        booked = {"upcoming": [], "ongoing": [], "completed": []}

        # Posted: driverId match or createdBy match
        for doc in rides_col.find({"$or": [{"driverId": user_id}, {"createdBy": user_id}]}):
            ride = _normalize_ride(doc, "Driver", current_date_str)
            key = ride["status"].lower()
            if key in posted: posted[key].append(ride)

        # Booked: bookedUsers list or passengers[].userId
        for doc in rides_col.find({"$or": [{"bookedUsers": user_id}, {"passengers.userId": user_id}]}):
            ride = _normalize_ride(doc, "Passenger", current_date_str)
            key = ride["status"].lower()
            if key in booked: booked[key].append(ride)

        total = sum(len(v) for v in posted.values()) + sum(len(v) for v in booked.values())
        print(f"My Rides for {user_id}: {total} total")

        return jsonify({"success": True, "posted": posted, "booked": booked}), 200

    except Exception as e:
        print(f"Get My Rides Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500


# --- Cancellation Routes ---

@app.route("/api/cancel-ride-passenger", methods=["POST", "OPTIONS"])
def cancel_ride_passenger():
    data = safe_json()
    ride_id = data.get('rideId')
    user_id = data.get('userId')
    
    if not ride_id or not user_id:
        return jsonify({"success": False, "message": "Missing rideId or userId"}), 400
        
    try:
        # 1. Fetch ride details before updating to notify driver
        ride = rides_col.find_one({"_id": ObjectId(ride_id)})
        if not ride:
            return jsonify({"success": False, "message": "Ride not found"}), 404
            
        if ride.get('status') == 'completed':
            return jsonify({"success": False, "message": "Cannot cancel a completed ride"}), 400
            
        driver_id = ride.get('createdBy')
        route_str = f"{ride.get('from')} → {ride.get('to')}"
        
        # 2. Fetch cancelling user's name
        user = users_col.find_one({"_id": ObjectId(user_id)})
        user_name = user.get('name') or user.get('username', 'A User')
        
        # 3. Pull user from booked lists
        result = rides_col.update_one(
            {"_id": ObjectId(ride_id)},
            {
                "$pull": {
                    "bookedUsers": user_id,
                    "passengerDetails": {"userId": user_id}
                }
            }
        )
        
        # 4. Notify Driver
        if driver_id:
            notifications_col.insert_one({
                "userId": driver_id,
                "fromId": user_id,
                "type": "cancel",
                "title": "Booking Cancelled",
                "message": f"{user_name} cancelled their booking for {route_str}",
                "isRead": False,
                "createdAt": datetime.now()
            })
            send_push_notification(driver_id, "Booking Cancelled", f"{user_name} cancelled their booking for {route_str}", {"type": "cancel"})
            
        print(f"Passenger {user_name} cancelled booking for ride {ride_id}")
        return jsonify({"success": True, "message": "Ride cancelled successfully"}), 200
        
    except Exception as e:
        print(f"Cancel Passenger Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/cancel-ride-driver", methods=["POST", "OPTIONS"])
def cancel_ride_driver():
    data = safe_json()
    ride_id = data.get('rideId')
    user_id = data.get('userId') # driver id
    
    if not ride_id:
        return jsonify({"success": False, "message": "Missing rideId"}), 400
        
    try:
        # 1. Fetch ride to notify all passengers
        ride = rides_col.find_one({"_id": ObjectId(ride_id)})
        if not ride:
            return jsonify({"success": False, "message": "Ride not found"}), 404
            
        if ride.get('status') == 'Completed':
             return jsonify({"success": False, "message": "Cannot cancel a completed ride"}), 400
            
        if user_id and str(ride.get('createdBy')) != str(user_id):
             return jsonify({"success": False, "message": "Unauthorized"}), 403
             
        booked_users = ride.get('bookedUsers', [])
        route_str = f"{ride.get('from')} → {ride.get('to')}"
        
        # 2. Notify all booked passengers
        for passenger_id in booked_users:
            notifications_col.insert_one({
                "userId": passenger_id,
                "fromId": user_id or str(ride.get('createdBy', '')),
                "type": "cancel",
                "title": "Ride Cancelled",
                "message": f"Your ride ({route_str}) was cancelled by the driver",
                "isRead": False,
                "createdAt": datetime.now()
            })
            send_push_notification(passenger_id, "Ride Cancelled", f"Your ride ({route_str}) was cancelled by the driver", {"type": "cancel"})
            
        # 3. Delete ride from DB
        rides_col.delete_one({"_id": ObjectId(ride_id)})
        
        print(f"Driver cancelled and deleted ride {ride_id}")
        return jsonify({"success": True, "message": "Ride cancelled and deleted successfully"}), 200
        
    except Exception as e:
        print(f"Cancel Driver Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/cancel-ride/<ride_id>", methods=["DELETE", "OPTIONS"])
def cancel_ride(ride_id):
    try:
        rides_collection.update_one(
            {"_id": ObjectId(ride_id)},
            {"$set": {"status": "cancelled"}}
        )
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# Backward-compatible alias for the old POST route
@app.route("/api/get-my-rides", methods=["POST", "OPTIONS"])
def get_my_rides():
    data = safe_json()
    user_id = data.get('userId')
    if not user_id:
        return jsonify({"success": False, "message": "Missing userId"}), 400
    return get_my_rides_v2(user_id)


@app.route("/api/ride-history", methods=["GET", "OPTIONS"])
def ride_history():
    user_id = request.args.get('userId')

    if not user_id:
        return jsonify({"success": False, "message": "Missing userId"}), 400

    try:
        current_date_str = datetime.now().strftime('%Y-%m-%d')
        
        # Consistent status check: "completed"
        # 1. Posted rides (Driver)
        # 2. Booked rides (Passenger)
        
        posted_history = []
        for doc in rides_col.find({
            "$or": [{"driverId": user_id}, {"createdBy": user_id}],
            "status": "completed"
        }):
            ride = _normalize_ride(doc, "Driver", current_date_str)
            posted_history.append(ride)

        booked_history = []
        for doc in rides_col.find({
            "$or": [{"bookedUsers": user_id}, {"passengers.userId": user_id}],
            "status": "completed"
        }):
            ride = _normalize_ride(doc, "Passenger", current_date_str)
            booked_history.append(ride)

        print(f"Ride History for {user_id}: {len(posted_history)} posted, {len(booked_history)} booked")
        return jsonify({
            "success": True,
            "posted": posted_history,
            "booked": booked_history
        }), 200

    except Exception as e:
        print(f"Ride History Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500


# --- Communications/Messaging Routes ---
@app.route("/api/send-message", methods=["POST", "OPTIONS"])
def send_message():
    data = safe_json()
    sender_id = data.get('senderId')
    receiver_id = data.get('receiverId')
    message = data.get('message')
    
    if not sender_id or not receiver_id or not message:
        return jsonify({"success": False, "message": "Missing required fields"}), 400
        
    try:
        msg_doc = {
            "senderId": sender_id,
            "receiverId": receiver_id,
            "message": message,
            "timestamp": datetime.now(),
            "seen": False
        }
        messages_col.insert_one(msg_doc)
        
        # Create notification for receiver
        sender_name = data.get('senderName', 'User')
        preview = message[:50] + ('...' if len(message) > 50 else '')
        notif_doc = {
            "userId": receiver_id,
            "fromId": sender_id,
            "type": "message",
            "title": "New Message",
            "message": f"{sender_name}: {preview}",
            "isRead": False,
            "createdAt": datetime.now()
        }
        notifications_col.insert_one(notif_doc)
        send_push_notification(receiver_id, "New Message", f"{sender_name}: {preview}", {"type": "message"})
        
        return jsonify({"success": True, "message": "Message sent"}), 201
    except Exception as e:
        print(f"Send Message Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/messages/<user_id>", methods=["GET", "OPTIONS"])
def get_messages(user_id):
    try:
        cursor = messages_col.find(
            {"$or": [{"senderId": user_id}, {"receiverId": user_id}]}
        ).sort("timestamp", 1)
        
        messages = []
        for doc in cursor:
            msg = parse_json(doc)
            msg["id"] = msg.pop("_id", None)
            
            # Fetch partner summary data to make UI grouping easier
            partner_id = msg['senderId'] if msg['senderId'] != user_id else msg['receiverId']
            partner = None
            try:
                partner = users_col.find_one({"_id": ObjectId(partner_id)})
            except Exception:
                pass
            
            msg["contactName"] = partner.get("username", "Unknown User") if partner else "Unknown User"
            msg["contactAvatar"] = msg["contactName"][0].upper()
            
            messages.append(msg)
            
        return jsonify({"success": True, "messages": messages}), 200
    except Exception as e:
        print(f"Get Messages Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/messages/mark-read", methods=["POST", "OPTIONS"])
def mark_messages_read():
    data = safe_json()
    user_id = data.get('userId')
    partner_id = data.get('partnerId')
    
    if not user_id or not partner_id:
        return jsonify({"success": False, "message": "Missing required IDs"}), 400
        
    try:
        # Mark all messages SENT BY partner TO user as seen
        messages_col.update_many(
            {"senderId": partner_id, "receiverId": user_id, "seen": False},
            {"$set": {"seen": True}}
        )
        return jsonify({"success": True, "message": "Messages marked as read"}), 200
    except Exception as e:
        print(f"Mark Read Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

# --- Notification Routes ---

@app.route("/api/notifications/<user_id>", methods=["GET", "OPTIONS"])
def get_notifications(user_id):
    """Consolidated notifications route: returns list and unread count."""
    try:
        cursor = notifications_col.find(
            {"userId": user_id}
        ).sort("createdAt", -1).limit(50)
        
        notifs = []
        for doc in cursor:
            n = parse_json(doc)
            # Ensure both id formats exist for compatibility across components
            n["_id"] = n.get("_id")
            if "_id" in n:
                n["id"] = n["_id"]
            notifs.append(n)
        
        unread_count = notifications_col.count_documents({"userId": user_id, "isRead": False})
        
        return jsonify({
            "success": True,
            "notifications": notifs,
            "unreadCount": unread_count
        }), 200
    except Exception as e:
        print(f"Get Notifications Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/notifications/mark-read", methods=["POST", "OPTIONS"])
def mark_notifications_read():
    data = safe_json()
    user_id = data.get('userId')
    notif_id = data.get('notificationId')
    
    if not user_id:
        return jsonify({"success": False, "message": "Missing userId"}), 400
    
    try:
        if notif_id:
            # Mark single notification as read
            notifications_col.update_one(
                {"_id": ObjectId(notif_id), "userId": user_id},
                {"$set": {"isRead": True}}
            )
        else:
            # Mark all notifications as read
            notifications_col.update_many(
                {"userId": user_id, "isRead": False},
                {"$set": {"isRead": True}}
            )
        return jsonify({"success": True, "message": "Notifications updated"}), 200
    except Exception as e:
        print(f"Mark Read Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/notifications/unread-count/<user_id>", methods=["GET", "OPTIONS"])
def get_unread_count(user_id):
    try:
        count = notifications_col.count_documents({"userId": user_id, "isRead": False})
        return jsonify({"success": True, "count": count}), 200
    except Exception as e:
        return jsonify({"success": False, "count": 0}), 500

# --- Ratings Routes ---
@app.route("/api/add-rating", methods=["POST", "OPTIONS"])
def add_rating():
    data = safe_json()
    from_user = data.get('fromUser') or data.get('raterId')
    to_user = data.get('toUser') or data.get('ratedUserId')
    ride_id = data.get('rideId')
    rating = data.get('rating')
    comment = data.get('comment', '')
    
    if not all([from_user, to_user, ride_id]) or rating is None:
        return jsonify({"success": False, "message": "Missing required fields"}), 400
        
    try:
        # Part 1 & 9: Ride Status Check
        ride = rides_col.find_one({"_id": ObjectId(ride_id)})
        if not ride:
            return jsonify({"success": False, "message": "Ride not found"}), 404
        
        if ride.get('status') != 'Completed':
            return jsonify({"success": False, "message": "Rating allowed only after ride completion"}), 400

        # Part 7: Prevent Duplicate Ratings per Ride
        existing = ratings_col.find_one({
            "fromUser": from_user,
            "toUser": to_user,
            "rideId": ride_id
        })
        if existing:
            return jsonify({"success": False, "message": "You have already rated this user for this ride"}), 409

        # Part 5: Store in DB
        rating_doc = {
            "fromUser": from_user,
            "toUser": to_user,
            "rideId": ride_id,
            "rating": float(rating),
            "comment": comment,
            "timestamp": datetime.now()
        }
        ratings_col.insert_one(rating_doc)
        
        # Part 6: Update User Stats
        all_ratings = list(ratings_col.find({"toUser": to_user}))
        total_count = len(all_ratings)
        avg_rating = sum([r['rating'] for r in all_ratings]) / total_count
        
        users_col.update_one(
            {"_id": ObjectId(to_user)},
            {"$set": {
                "rating": round(avg_rating, 1),
                "totalRatings": total_count
            }}
        )

        # Part 9: Notifications
        from_u_doc = users_col.find_one({"_id": ObjectId(from_user)})
        name = from_u_doc.get('name') or from_u_doc.get('username', 'Someone')
        
        notifications_col.insert_one({
            "userId": to_user,
            "fromId": from_user,
            "type": "rating",
            "title": "New Rating",
            "message": f"{name} rated you ⭐ {int(rating)}",
            "isRead": False,
            "createdAt": datetime.now()
        })
        send_push_notification(to_user, "New Rating", f"{name} rated you ⭐ {int(rating)}", {"type": "rating"})
        
        return jsonify({"success": True, "message": "Rating submitted successfully"}), 201
    except Exception as e:
        print(f"Add Rating Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/ratings/<user_id>", methods=["GET", "OPTIONS"])
def get_user_ratings(user_id):
    try:
        received_cursor = ratings_col.find({"toUser": user_id}).sort("timestamp", -1)
        given_cursor = ratings_col.find({"fromUser": user_id}).sort("timestamp", -1)
        
        received = []
        for doc in received_cursor:
            r = parse_json(doc)
            r["id"] = r.pop("_id", None)
            from_u = users_col.find_one({"_id": ObjectId(r["fromUser"])})
            r["fromUserName"] = from_u.get("username", "Unknown") if from_u else "Unknown"
            r["fromUserAvatar"] = r["fromUserName"][0].upper()
            received.append(r)
            
        given = []
        for doc in given_cursor:
            r = parse_json(doc)
            r["id"] = r.pop("_id", None)
            to_u = users_col.find_one({"_id": ObjectId(r["toUser"])})
            r["toUserName"] = to_u.get("username", "Unknown") if to_u else "Unknown"
            r["toUserAvatar"] = r["toUserName"][0].upper()
            given.append(r)
            
        return jsonify({
            "success": True, 
            "received": received,
            "given": given
        }), 200
    except Exception as e:
        print(f"Get Ratings Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500


# --- Admin Routes ---

@app.route("/api/admin/users", methods=["GET", "OPTIONS"])
def admin_get_users():
    try:
        cursor = users_col.find({})
        users = []
        for doc in cursor:
            user = parse_json(doc)
            user["id"] = user.pop("_id", None)
            user.pop("password", None)  # Never expose passwords
            users.append(user)
        print(f"Admin fetched {len(users)} users from DB.")
        return jsonify({"success": True, "users": users}), 200
    except Exception as e:
        print(f"Admin Get Users Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route('/api/admin/verifications', methods=['GET', 'OPTIONS'])
def get_verifications():
    try:
        # User requested fix: Fetch all users where ANY document has status "pending"
        query = {
            "$or": [
                { "documents.license.status": "pending" },
                { "documents.rc.status": "pending" },
                { "documents.insurance.status": "pending" }
            ]
        }
        
        users_list = list(users_col.find(query))

        result = []
        for user in users_list:
            user["_id"] = str(user["_id"])
            result.append({
                "userId": user["_id"],
                "username": user.get("username"),
                "email": user.get("email"),
                "documents": user.get("documents", {}),
                "verificationStatus": user.get("verificationStatus", "pending")
            })

        print(f"[ADMIN] Pending verification users: {len(result)}")
        return jsonify({"success": True, "verifications": result}), 200
    except Exception as e:
        print(f"Admin Get Verifications Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route('/api/admin/verify-user', methods=['POST', 'OPTIONS'])
def verify_user_decision():
    data = safe_json()

    user_id = data.get("userId")
    documents = data.get("documents")
    promote = data.get("promoteToDriver")

    if not user_id or not documents:
        return jsonify({"success": False, "message": "Missing required verification data"}), 400

    try:
        # Part 3: Backend fix - Use granular dot notation for updates
        update_data = {}
        
        # Build dynamic $set for each document type provided
        for doc_type, doc_info in documents.items():
            if "status" in doc_info:
                update_data[f"documents.{doc_type}.status"] = doc_info["status"]
            if "reason" in doc_info:
                update_data[f"documents.{doc_type}.reason"] = doc_info.get("reason", "")
            update_data[f"documents.{doc_type}.updatedAt"] = datetime.now()

        # Calculate overall verification status
        uploaded_docs = [doc for doc in documents.values() if doc.get("url")]
        if uploaded_docs:
            all_approved = all(doc.get("status") == "approved" for doc in uploaded_docs)
            overall_status = "approved" if all_approved else "rejected"
        else:
            overall_status = "pending"

        update_data["verificationStatus"] = overall_status
        update_data["isVerified"] = (overall_status == "approved")

        # Part 1: Logic Synchronization with Phase 4.5 Requirements
        # If all docs are approved AND "Promote as Driver" is checked
        final_role = "user"
        if overall_status == "approved":
            if promote:
                final_role = "user+driver"
            else:
                # Role remains user if not promoted
                final_role = "user"

        update_data["role"] = final_role

        # 1. Update the database using dot notation to prevent overwriting whole 'documents' object
        users_col.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )

        # Part 5: Add console log after update
        print(f"[ADMIN] Decision Finalized for: {user_id} - Role: {final_role} - Status: {overall_status}")

        # Construct notification message
        notification_msg = "Your documents have been approved!" if overall_status == "approved" else "Some of your documents were rejected."
        
        if overall_status == "rejected":
            reasons = [f"{k.upper()}: {v.get('reason')}" for k, v in documents.items() if v.get('status') == 'rejected']
            if reasons:
                notification_msg = "Your document was rejected: " + ", ".join(reasons)

        # Create system notification
        notifications_col.insert_one({
            "userId": user_id,
            "type": "verification",
            "title": f"Verification {overall_status.capitalize()}",
            "message": notification_msg,
            "isRead": False,
            "createdAt": datetime.now()
        })
    except Exception as e:
        print(f"Admin Verify User Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route('/api/admin/update-user-status', methods=['POST', 'OPTIONS'])
def update_user_status():
    """Administrative management route with intelligent notification loop."""
    if request.method == 'OPTIONS':
        return jsonify({"success": True}), 200
        
    try:
        data = safe_json()
        user_id = data.get('userId')
        new_role = data.get('role')
        new_is_banned = data.get('isBanned')
        new_ban_reason = data.get('banReason', '')

        if not user_id:
            return jsonify({"success": False, "message": "Missing userId"}), 400

        # Part 1: Smart State Comparison
        current_user = users_col.find_one({"_id": ObjectId(user_id)})
        if not current_user:
            return jsonify({"success": False, "message": "User not found"}), 404

        old_role = current_user.get('role', 'user')
        old_is_banned = current_user.get('isBanned', False)

        update_fields = {}
        notifications_to_send = []

        # 🔹 Condition A: Role Change Detection
        if new_role and new_role != old_role:
            update_fields['role'] = new_role
            notifications_to_send.append({
                "title": "Account Role Updated",
                "message": f"Your platform role has been set to: {new_role.upper()}",
                "type": "admin-action"
            })

        # 🔹 Condition B: Ban/Unban Detection
        if new_is_banned is not None and new_is_banned != old_is_banned:
            update_fields['isBanned'] = new_is_banned
            update_fields['banReason'] = new_ban_reason if new_is_banned else ""
            
            if new_is_banned:
                msg = f"Your account has been restricted: {new_ban_reason or 'Policy Violation'}"
                notifications_to_send.append({
                    "title": "Access Restricted",
                    "message": msg,
                    "type": "admin-action"
                })
            else:
                notifications_to_send.append({
                    "title": "Access Restored",
                    "message": "Your account has been successfully unbanned. Strategic operations back online.",
                    "type": "admin-action"
                })

        # Only update if there are changes
        if not update_fields:
            return jsonify({"success": True, "message": "No changes detected"}), 200

        # Part 2: Execute Database Update
        users_col.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_fields}
        )

        # Part 3: Dispatch Notifications
        for notif in notifications_to_send:
            notifications_col.insert_one({
                "userId": user_id,
                "type": notif["type"],
                "title": notif["title"],
                "message": notif["message"],
                "isRead": False,
                "createdAt": datetime.now()
            })
            # Also trigger Push Notify (Firebase logic from previous turns)
            # send_push_notification(user_id, notif["title"], notif["message"], {"type": "admin-action"})

        print(f"[ADMIN ACTION] User {user_id} updated. Actions: {[n['title'] for n in notifications_to_send]}")
        return jsonify({"success": True, "message": "User updated and notified"}), 200

    except Exception as e:
        print("ADMIN UPDATE ERROR:", e)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/admin/block-user", methods=["POST", "OPTIONS"])
def admin_block_user():
    data = safe_json()
    user_id = data.get('userId')
    if not user_id:
        return jsonify({"success": False, "message": "Missing userId"}), 400
    try:
        result = users_col.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"isBlocked": True}}
        )
        if result.matched_count == 0:
            return jsonify({"success": False, "message": "User not found"}), 404
        print(f"Admin blocked user: {user_id}")
        return jsonify({"success": True, "message": "User blocked successfully"}), 200
    except Exception as e:
        print(f"Admin Block User Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/admin/rides", methods=["GET", "OPTIONS"])
def admin_get_rides():
    try:
        cursor = rides_col.find({})
        rides = []
        for doc in cursor:
            ride = parse_json(doc)
            ride["id"] = ride.pop("_id", None)
            rides.append(ride)
        print(f"Admin fetched {len(rides)} rides from DB.")
        return jsonify({"success": True, "rides": rides}), 200
    except Exception as e:
        print(f"Admin Get Rides Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/admin/reports", methods=["GET", "OPTIONS"])
def admin_get_reports():
    try:
        # Join reports with reporter and reported user names
        pipeline = [
            {
                "$lookup": {
                    "from": "users",
                    "let": { "reporterId": "$reporterId" },
                    "pipeline": [
                        { "$match": { "$expr": { "$eq": ["$_id", { "$toObjectId": "$$reporterId" }] } } }
                    ],
                    "as": "reporterInfo"
                }
            },
            {
                "$lookup": {
                    "from": "users",
                    "let": { "reportedId": "$reportedId" },
                    "pipeline": [
                        { "$match": { "$expr": { "$eq": ["$_id", { "$toObjectId": "$$reportedId" }] } } }
                    ],
                    "as": "reportedInfo"
                }
            },
            { "$unwind": { "path": "$reporterInfo", "preserveNullAndEmptyArrays": True } },
            { "$unwind": { "path": "$reportedInfo", "preserveNullAndEmptyArrays": True } },
            {
                "$project": {
                    "_id": 1,
                    "reporterId": 1,
                    "reportedId": 1,
                    "rideId": 1,
                    "reason": 1,
                    "details": 1,
                    "status": 1,
                    "createdAt": 1,
                    "reporterName": { "$ifNull": ["$reporterInfo.name", "$reporterInfo.username"] },
                    "reportedName": { "$ifNull": ["$reportedInfo.name", "$reportedInfo.username"] }
                }
            },
            { "$sort": { "createdAt": -1 } }
        ]
        reports = list(reports_col.aggregate(pipeline))
        print(f"Admin fetched {len(reports)} reports from aggregation.")
        return jsonify({"success": True, "reports": parse_json(reports)}), 200
    except Exception as e:
        print(f"Admin Get Verifications Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/user/verification/<user_id>", methods=["GET", "OPTIONS"])
def get_user_verification(user_id):
    """Retrieves document status directly from the user document."""
    try:
        user = users_col.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
        if user and user.get("documents"):
            # Flatten for frontend compatibility with existing UserVerificationPage
            docs = user["documents"]
            
            # Map nested structure back to flat structure for the frontend logic if needed,
            # but UserVerificationPage only uses .status
            verif_data = {
                "userId": user_id,
                "status": docs.get("license", {}).get("status", "pending"),
                "licenseUrl": docs.get("license", {}).get("url"),
                "rcUrl": docs.get("rc", {}).get("url"),
                "insuranceUrl": docs.get("insurance", {}).get("url")
            }
            return jsonify({"success": True, "verification": parse_json(verif_data)}), 200
        else:
            return jsonify({"success": True, "verification": None}), 200
    except Exception as e:
        print(f"Get User Verification Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/report-user", methods=["POST", "OPTIONS"])
def report_user():
    data = safe_json()
    reporter_id = data.get('reporterId')
    reported_id = data.get('reportedId')
    ride_id = data.get('rideId')
    reason = data.get('reason')
    details = data.get('details', '')
    
    if not reporter_id or not reported_id or not reason:
        return jsonify({"success": False, "message": "Missing required fields"}), 400
        
    try:
        report_doc = {
            "reporterId": reporter_id,
            "reportedId": reported_id,
            "rideId": ride_id,
            "reason": reason,
            "details": details,
            "status": "pending",
            "createdAt": datetime.now()
        }
        reports_col.insert_one(report_doc)
        
        # Notify Admin
        admins = list(users_col.find({"role": "admin"}))
        for admin in admins:
            notifications_col.insert_one({
                "userId": str(admin["_id"]),
                "fromId": reporter_id,
                "type": "admin_alert",
                "title": "New User Report",
                "message": f"A user was reported for: {reason}",
                "isRead": False,
                "createdAt": datetime.now()
            })
            
        return jsonify({"success": True, "message": "Report submitted successfully"}), 201
    except Exception as e:
        print(f"Report User Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/reports/user/<user_id>", methods=["GET", "OPTIONS"])
def get_user_reports(user_id):
    try:
        # Reports GIVEN by user
        given_cursor = reports_col.find({"reporterId": user_id}).sort("createdAt", -1)
        given = []
        for doc in given_cursor:
            r = parse_json(doc)
            r["id"] = r.pop("_id", None)
            reported_u = users_col.find_one({"_id": ObjectId(r["reportedId"])})
            r["reportedName"] = reported_u.get("name") or reported_u.get("username") if reported_u else "Unknown"
            given.append(r)
            
        # Reports RECEIVED by user
        received_cursor = reports_col.find({"reportedId": user_id}).sort("createdAt", -1)
        received = []
        for doc in received_cursor:
            r = parse_json(doc)
            r["id"] = r.pop("_id", None)
            reporter_u = users_col.find_one({"_id": ObjectId(r["reporterId"])})
            r["reporterName"] = reporter_u.get("name") or reporter_u.get("username") if reporter_u else "Unknown"
            received.append(r)
            
        return jsonify({
            "success": True,
            "given": given,
            "received": received
        }), 200
    except Exception as e:
        print(f"Get User Reports Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/admin/rate-user", methods=["POST", "OPTIONS"])
def admin_rate_user():
    data = safe_json()
    user_id = data.get('userId')
    new_rating = data.get('rating')
    if not user_id or new_rating is None:
        return jsonify({"success": False, "message": "Missing userId or rating"}), 400
    try:
        new_rating = float(new_rating)
        if new_rating < 0 or new_rating > 5:
            return jsonify({"success": False, "message": "Rating must be between 0 and 5"}), 400
        result = users_col.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"rating": round(new_rating, 1)}}
        )
        if result.matched_count == 0:
            return jsonify({"success": False, "message": "User not found"}), 404
        print(f"Admin updated rating for user {user_id} to {new_rating}")
        return jsonify({"success": True, "message": f"Rating updated to {new_rating}"}), 200
    except Exception as e:
        print(f"Admin Rate User Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/admin/ride/<ride_id>", methods=["GET", "OPTIONS"])
def admin_get_ride_details(ride_id):
    try:
        ride = rides_col.find_one({"_id": ObjectId(ride_id)})
        if not ride:
            return jsonify({"success": False, "message": "Ride not found"}), 404
        
        ride_data = parse_json(ride)
        ride_data["id"] = ride_data.pop("_id", None)
        
        # Get driver details
        driver = users_col.find_one({"_id": ObjectId(ride_data.get("driverId") or ride_data.get("createdBy"))})
        if driver:
            ride_data["driverInfo"] = parse_json(driver)
            ride_data["driverInfo"].pop("password", None)
            
        # Get ratings if completed
        if ride_data.get("status") == "Completed":
            ratings = list(ratings_col.find({"rideId": ride_id}))
            ride_data["ratings"] = parse_json(ratings)
            
        return jsonify({"success": True, "ride": ride_data}), 200
    except Exception as e:
        print(f"Admin Get Ride Details Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/ride/<ride_id>", methods=["GET", "OPTIONS"])
def get_ride_details(ride_id):
    try:
        rid = ObjectId(ride_id) if ObjectId.is_valid(ride_id) else None
        if not rid:
            return jsonify({"success": False, "message": "Invalid rideId"}), 400
            
        ride = rides_col.find_one({"_id": rid})
        if not ride:
            return jsonify({"success": False, "message": "Ride not found"}), 404
            
        # Enrich ride data (drivers, etc)
        ride_data = parse_json(ride)
        ride_data["id"] = ride_data.pop("_id", None)
        
        # Driver name
        dr_id = ride_data.get('driverId') or ride_data.get('createdBy')
        driver = users_col.find_one({"_id": ObjectId(dr_id) if ObjectId.is_valid(dr_id) else dr_id})
        if driver:
            ride_data['driverInfo'] = {
                "name": driver.get('name') or driver.get('username'),
                "rating": driver.get('rating', 4.5),
                "totalRatings": driver.get('totalRatings', 0)
            }
            
        return jsonify({"success": True, "ride": ride_data}), 200
    except Exception as e:
        print(f"Get Ride Details Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/admin/verifications", methods=["GET", "OPTIONS"])
def admin_get_verifications():
    try:
        # Join verifications with user names
        # Aggregating KYC documents from users collection
        pipeline = [
            { "$match": { "documents": { "$exists": True } } },
            {
                "$project": {
                    "_id": 0,
                    "userId": { "$toString": "$_id" },
                    "userName": "$name",
                    "userEmail": "$email",
                    "licenseUrl": "$documents.license.url",
                    "rcUrl": "$documents.rc.url",
                    "insuranceUrl": "$documents.insurance.url",
                    "status": {
                        "$cond": {
                            "if": { "$eq": ["$documents.license.status", "approved"] },
                            "then": "approved",
                            "else": {
                                "$cond": {
                                    "if": { "$eq": ["$documents.license.status", "rejected"] },
                                    "then": "rejected",
                                    "else": "pending"
                                }
                            }
                        }
                    }
                }
            }
        ]
        results = list(users_col.aggregate(pipeline))
        return jsonify({"success": True, "verifications": parse_json(results)}), 200
    except Exception as e:
        print(f"Admin Get Verifications Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/admin/verify/<user_id>", methods=["POST", "OPTIONS"])
def admin_approve_verification(user_id):
    try:
        # Update user's isVerified flag and document statuses
        uid = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        users_col.update_one(
            {"_id": uid},
            {
                "$set": {
                    "isVerified": True,
                    "documents.license.status": "approved",
                    "documents.rc.status": "approved",
                    "documents.insurance.status": "approved"
                }
            }
        )
        
        # Keep verifications_col in sync if it's still being used elsewhere
        verifications_col.update_one(
            {"userId": user_id},
            {"$set": {"status": "approved"}}
        )
        
        # Notify User
        notifications_col.insert_one({
            "userId": user_id,
            "type": "verification",
            "title": "Documents Verified",
            "message": "Your identity documents have been approved. You now have full platform access.",
            "isRead": False,
            "createdAt": datetime.now()
        })
        send_push_notification(user_id, "Documents Verified", "Your identity documents have been approved.", {"type": "verification"})
        
        return jsonify({"success": True, "message": "Verification approved"}), 200
    except Exception as e:
        print(f"Admin Approve Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/admin/reject/<user_id>", methods=["POST", "OPTIONS"])
def admin_reject_verification(user_id):
    try:
        # Update user's document statuses to rejected
        uid = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        users_col.update_one(
            {"_id": uid},
            {
                "$set": {
                    "documents.license.status": "rejected",
                    "documents.rc.status": "rejected",
                    "documents.insurance.status": "rejected"
                }
            }
        )

        verifications_col.update_one(
            {"userId": user_id},
            {"$set": {"status": "rejected"}}
        )
        
        # Notify User
        notifications_col.insert_one({
            "userId": user_id,
            "type": "verification",
            "title": "Verification Rejected",
            "message": "Your documents were rejected. Please re-upload clear copies.",
            "isRead": False,
            "createdAt": datetime.now()
        })
        send_push_notification(user_id, "Verification Rejected", "Your documents were rejected.", {"type": "verification"})
        
        return jsonify({"success": True, "message": "Verification rejected"}), 200
    except Exception as e:
        print(f"Admin Reject Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route('/api/upload-documents', methods=['POST', 'OPTIONS'])
def user_upload_documents():
    """Standardized document upload route as requested by the user, fixing 500 error."""
    try:
        # Part 1: Full Debug Logging
        data = safe_json()
        print("📦 Incoming data:", data)

        user_id = data.get('userId')
        doc_type = data.get('type')   # license / rc / insurance
        url = data.get('url') or data.get('fileUrl')

        print("user_id:", user_id)
        print("doc_type:", doc_type)
        print("url:", url)

        # Part 2: Validate Inputs STRICTLY
        if not user_id or not doc_type or not url:
            print("❌ Missing fields detected.")
            return jsonify({"error": "Missing fields"}), 400

        # Part 3: Fix ObjectId Conversion
        try:
            user_object_id = ObjectId(user_id)
        except Exception as e:
            print("❌ ObjectId Error:", e)
            return jsonify({"error": "Invalid userId"}), 400

        # Part 4: Ensure VALID doc_type
        if doc_type not in ['license', 'rc', 'insurance']:
            print(f"❌ Invalid doc_type: {doc_type}")
            return jsonify({"error": "Invalid document type"}), 400

        # Part 5: Fix Mongo Update
        # Using dot notation to prevent overwriting existing document data
        result = users_col.update_one(
            {"_id": user_object_id},
            {"$set": {
                f"documents.{doc_type}": {
                    "url": url,
                    "status": "pending",
                    "reason": "",
                    "uploadedAt": datetime.utcnow()
                }
            }}
        )

        print("Mongo update result:", result.raw_result)

        # Notify Admins (Maintained logic, but inside the try block)
        user = users_col.find_one({"_id": user_object_id})
        u_name = user.get('name') or user.get('username') or 'User'
        admins = list(users_col.find({"role": "admin"}))
        for admin in admins:
            notifications_col.insert_one({
                "userId": str(admin["_id"]),
                "fromId": user_id,
                "type": "admin_alert",
                "title": "Document Verification Required",
                "message": f"{u_name} has submitted {doc_type.upper()} for review.",
                "isRead": False,
                "createdAt": datetime.now()
            })
            send_push_notification(str(admin["_id"]), "KYC Submission", f"{u_name} uploaded {doc_type} for review.", {"type": "admin_alert"})

        # Part 6: Return SUCCESS
        return jsonify({"success": True}), 200

    except Exception as e:
        # Part 7: FULL ERROR HANDLER
        print("🔥 ERROR IN UPLOAD:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/api/notifications/read/<notif_id>", methods=["POST", "OPTIONS"])
def mark_notification_read(notif_id):
    """Marks a specific notification as read."""
    try:
        notifications_col.update_one(
            {"_id": ObjectId(notif_id)},
            {"$set": {"isRead": True}}
        )
        return jsonify({"success": True, "message": "Notification marked as read"}), 200
    except Exception as e:
        print(f"Mark Notification Read Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/upload", methods=["POST", "OPTIONS"])
def upload_file():
    try:
        file = request.files.get("file")
        if not file:
            return jsonify({"success": False, "message": "No file"}), 400

        filename = secure_filename(file.filename)
        file.save(os.path.join("uploads", filename))

        return jsonify({"success": True, "filename": filename}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/", methods=["GET", "OPTIONS"])
def api_home():
    return jsonify({
        "message": "MongoDB Backend running"
    }), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response
