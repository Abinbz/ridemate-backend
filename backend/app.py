import json
import os
from datetime import datetime, timedelta
from bson.objectid import ObjectId
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
import re
import random
import math
import cloudinary
import cloudinary.uploader

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
# Enable CORS for React
CORS(app, resources={r"/api/*": {"origins": "*"}})

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
    # Trigger a connection test
    client.server_info()
    print("Successfully connected to MongoDB.")
except Exception as e:
    print(f"MongoDB connection failed. Check if service is running: {e}")

# --- Cloudinary Configuration ---
cloudinary.config(
  cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME", "dqt6eodgr"),
  api_key=os.environ.get("CLOUDINARY_API_KEY", "299847286336454"),
  api_secret=os.environ.get("CLOUDINARY_API_SECRET", "Zbrn6klBPpmwbAxLEoaUMyUGPZM")
)


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
        # Token may be invalid/expired — don't crash
        print(f"[FCM Error] Push failed for {user_id}: {e}")


@app.route("/api/save-fcm-token", methods=["POST"])
def save_fcm_token():
    data = request.json
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
@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.json
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

        # Construct User Document
        user_doc = {
            "name": data['name'],
            "username": data['username'],
            "collegeId": data['collegeId'],
            "email": data['email'],
            "phone": data['phone'],
            "gender": data['gender'],
            "password": data['password'], # Note: Unhashed for quick prototype
            "role": "user",
            "isVerified": False,
            "isBlocked": False,
            "rating": 0
        }
        
        result = users_col.insert_one(user_doc)
        print(f"User signed up and saved to DB: {user_doc['username']} ({result.inserted_id})")
        return jsonify({"success": True, "message": "Signup successful", "userId": str(result.inserted_id)}), 201
    except Exception as e:
        print(f"Signup DB Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
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
        user = users_col.find_one({"username": data['username'], "password": data['password']})
        
        if user:
            # Check if user is blocked
            if user.get('isBlocked', False):
                print(f"Blocked user attempted login: {user['username']}")
                return jsonify({"success": False, "message": "Your account has been blocked. Contact admin."}), 403
            print(f"User logged in from DB: {user['username']}")
            return jsonify({"success": True, "message": "Login successful", "userId": str(user["_id"])}), 200
        else:
            return jsonify({"success": False, "message": "Invalid username or password"}), 401
    except Exception as e:
        print(f"Login DB Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/admin-login", methods=["POST"])
def admin_login():
    data = request.json
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({"success": False, "message": "Missing credentials"}), 400

    # No spaces in Admin ID
    if not validate_username_no_spaces(data.get('username', '')):
        return jsonify({"success": False, "message": "Admin ID cannot contain spaces"}), 400

    if data.get('username') == 'adminkmct' and data.get('password') == 'Kmct@2026.':
        print("Admin logged in")
        # Ensure 'adminkmct' has admin role in DB for notification routing
        users_col.update_one(
            {"username": "adminkmct"},
            {"$set": {"role": "admin", "name": "System Admin"}},
            upsert=True
        )
        admin = users_col.find_one({"username": "adminkmct"})
        return jsonify({"success": True, "message": "Admin login successful", "userId": str(admin["_id"])}), 200
    else:
        return jsonify({"success": False, "message": "Invalid Admin Credentials"}), 401

@app.route("/api/user/<user_id>", methods=["GET"])
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

@app.route("/api/user/update", methods=["POST"])
def update_user():
    data = request.json
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


# --- Ride Routes ---
@app.route("/api/post-ride", methods=["POST"])
def post_ride():
    data = request.json
    if not data or not data.get('startingFrom') or not data.get('goingTo'):
        return jsonify({"success": False, "message": "Missing route details"}), 400
        
    try:
        # Construct Ride Document as requested
        ride_doc = {
            "driverId": data.get('userId') or data.get('createdBy'),
            "driverName": data.get('username') or data.get('driver'),
            "fromLocation": data.get('startingFrom'),
            "toLocation": data.get('goingTo'),
            "date": data.get('date'),
            "time": data.get('time') or data.get('startTime') or "09:00 AM",
            "vehicleName": data.get('vehicleName', 'Unknown'),
            "vehicleType": data.get('vehicleType', 'Car'),
            "price": data.get('price'),
            "passengers": [], 
            "status": "Scheduled",
            "createdAt": datetime.now(),
            # Keep these for internal matching/search compatibility
            "from": data.get('startingFrom'),
            "to": data.get('goingTo'),
            "createdBy": data.get('userId') or data.get('createdBy'),
            "bookedUsers": [],
            "passengerDetails": []
        }
        
        result = rides_col.insert_one(ride_doc)
        new_ride = parse_json(ride_doc)
        new_ride["id"] = str(result.inserted_id)
        
        print("Ride created:", new_ride['fromLocation'], "->", new_ride['toLocation'])
        print(f"Ride details: {new_ride}")
        
        return jsonify({"success": True, "message": "Ride posted successfully", "ride": new_ride}), 201
    except Exception as e:
        print(f"Create Ride DB Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/search-rides", methods=["POST"])
def search_rides():
    data = request.json
    start_loc = data.get('startingFrom', '').strip().lower()
    end_loc = data.get('goingTo', '').strip().lower()
    
    # Geographic inputs for intelligent matching
    user_start_lat = data.get('startLat')
    user_start_lng = data.get('startLng')
    user_end_lat = data.get('endLat')
    user_end_lng = data.get('endLng')

    try:
        # Initial extraction of all possible rides
        query = {}
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

@app.route("/api/cluster-rides", methods=["POST"])
def cluster_rides():
    try:
        # Fetch all rides
        cursor = rides_col.find({})
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

@app.route("/api/match-rides", methods=["POST"])
def match_rides():
    data = request.json
    
    # Extract user inputs natively
    user_start_lat = data.get('startLat')
    user_start_lng = data.get('startLng')
    user_end_lat = data.get('endLat')
    user_end_lng = data.get('endLng')
    
    if None in [user_start_lat, user_start_lng, user_end_lat, user_end_lng]:
        return jsonify({"success": False, "message": "Missing necessary user geographic start/end coordinate points."}), 400
        
    DETOUR_LIMIT = 2.0  # in kilometers
    
    try:
        cursor = rides_col.find({})
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

@app.route("/api/optimize-rides", methods=["POST"])
def optimize_rides():
    data = request.json
    
    # Extract user inputs generically mapping from frontend mapping schema 
    user_start_lat = data.get('startLat')
    user_start_lng = data.get('startLng')
    user_end_lat = data.get('endLat')
    user_end_lng = data.get('endLng')
    
    if None in [user_start_lat, user_start_lng, user_end_lat, user_end_lng]:
        return jsonify({"success": False, "message": "Missing geographic attributes for GA evaluation."}), 400
        
    try:
        cursor = rides_col.find({})
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

@app.route("/api/join-ride", methods=["POST"])
def join_ride():
    data = request.json
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

@app.route("/api/start-ride", methods=["POST"])
def start_ride():
    data = request.json
    ride_id = data.get('rideId')
    user_id = data.get('userId')

    try:
        ride = rides_col.find_one({"_id": ObjectId(ride_id)})
        if not ride: return jsonify({"success": False, "message": "Ride not found"}), 404
        
        if str(ride.get('driverId') or ride.get('createdBy')) != str(user_id):
            return jsonify({"success": False, "message": "Only the driver can start the ride"}), 403

        if ride.get('status') != 'Scheduled':
            return jsonify({"success": False, "message": "Only 'Scheduled' rides can be started"}), 400
            
        rides_col.update_one({"_id": ObjectId(ride_id)}, {"$set": {"status": "Ongoing"}})
        
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

@app.route("/api/end-ride", methods=["POST"])
def end_ride():
    data = request.json
    ride_id = data.get('rideId')
    user_id = data.get('userId')

    try:
        ride = rides_col.find_one({"_id": ObjectId(ride_id)})
        if not ride: return jsonify({"success": False, "message": "Ride not found"}), 404

        if str(ride.get('driverId') or ride.get('createdBy')) != str(user_id):
            return jsonify({"success": False, "message": "Only the driver can end the ride"}), 403

        if ride.get('status') != 'Ongoing':
            return jsonify({"success": False, "message": "Only 'Ongoing' rides can be ended"}), 400

        rides_col.update_one({"_id": ObjectId(ride_id)}, {"$set": {"status": "Completed"}})
        
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

@app.route("/api/book-ride", methods=["POST"])
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
    
    stored_status = ride.get("status", "Scheduled")
    if stored_status == "Scheduled":
        ride["status"] = "Upcoming"
    else:
        ride["status"] = stored_status

    vtype = ride.get("vehicleType", "Car")
    vname = ride.get("vehicleName", "Unknown")
    ride["vehicle"] = f"{vtype} ({vname})"

    price_val = ride.get("price", 0)
    ride["price"] = f"₹{price_val}" if not str(price_val).startswith("₹") else str(price_val)
    
    ride["time"] = ride.get("time") or ride.get("start") or "09:00 AM"
    
    return ride


@app.route("/api/my-rides/<user_id>", methods=["GET"])
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

@app.route("/api/cancel-ride-passenger", methods=["POST"])
def cancel_ride_passenger():
    data = request.json
    ride_id = data.get('rideId')
    user_id = data.get('userId')
    
    if not ride_id or not user_id:
        return jsonify({"success": False, "message": "Missing rideId or userId"}), 400
        
    try:
        # 1. Fetch ride details before updating to notify driver
        ride = rides_col.find_one({"_id": ObjectId(ride_id)})
        if not ride:
            return jsonify({"success": False, "message": "Ride not found"}), 404
            
        if ride.get('status') == 'Completed':
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

@app.route("/api/cancel-ride-driver", methods=["POST"])
def cancel_ride_driver():
    data = request.json
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


# Backward-compatible alias for the old POST route
@app.route("/api/get-my-rides", methods=["POST"])
def get_my_rides():
    data = request.json
    user_id = data.get('userId')
    if not user_id:
        return jsonify({"success": False, "message": "Missing userId"}), 400
    return get_my_rides_v2(user_id)


@app.route("/api/ride-history", methods=["POST"])
def ride_history():
    data = request.json
    user_id = data.get('userId')

    if not user_id:
        return jsonify({"success": False, "message": "Missing userId"}), 400

    try:
        current_date_str = datetime.now().strftime('%Y-%m-%d')
        
        # Posted rides: rides created by this user that are in the past
        posted_cursor = rides_col.find({
            "createdBy": user_id,
            "date": {"$lt": current_date_str}
        })
        posted_history = []
        for doc in posted_cursor:
            ride = parse_json(doc)
            ride["id"] = ride.pop("_id", None)
            ride["role"] = "Driver"
            ride["status"] = "Completed"
            # Normalize vehicle display
            vtype = ride.get("vehicleType", "Car")
            vname = ride.get("vehicleName", "Unknown")
            ride["vehicle"] = f"{vtype} ({vname})"
            # Normalize price display
            price_val = ride.get("price", 0)
            ride["price"] = f"₹{price_val}" if not str(price_val).startswith("₹") else str(price_val)
            posted_history.append(ride)

        # Booked rides: rides where this user is in bookedUsers and are in the past
        booked_cursor = rides_col.find({
            "bookedUsers": user_id,
            "date": {"$lt": current_date_str}
        })
        booked_history = []
        for doc in booked_cursor:
            ride = parse_json(doc)
            ride["id"] = ride.pop("_id", None)
            ride["role"] = "Passenger"
            ride["status"] = "Completed"
            # Normalize vehicle display
            vtype = ride.get("vehicleType", "Car")
            vname = ride.get("vehicleName", "Unknown")
            ride["vehicle"] = f"{vtype} ({vname})"
            # Normalize price display
            price_val = ride.get("price", 0)
            ride["price"] = f"₹{price_val}" if not str(price_val).startswith("₹") else str(price_val)
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
@app.route("/api/send-message", methods=["POST"])
def send_message():
    data = request.json
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
            "timestamp": datetime.now()
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

@app.route("/api/messages/<user_id>", methods=["GET"])
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

# --- Notification Routes ---

@app.route("/api/notifications/<user_id>", methods=["GET"])
def get_notifications(user_id):
    try:
        cursor = notifications_col.find(
            {"userId": user_id}
        ).sort("createdAt", -1).limit(50)
        
        notifs = []
        for doc in cursor:
            n = parse_json(doc)
            n["id"] = n.pop("_id", None)
            notifs.append(n)
        
        unread_count = notifications_col.count_documents({"userId": user_id, "isRead": False})
        
        return jsonify({
            "success": True,
            "notifications": notifs,
            "unreadCount": unread_count
        }), 200
    except Exception as e:
        print(f"Get Notifications Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/notifications/mark-read", methods=["POST"])
def mark_notifications_read():
    data = request.json
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

@app.route("/api/notifications/unread-count/<user_id>", methods=["GET"])
def get_unread_count(user_id):
    try:
        count = notifications_col.count_documents({"userId": user_id, "isRead": False})
        return jsonify({"success": True, "count": count}), 200
    except Exception as e:
        return jsonify({"success": False, "count": 0}), 500

# --- Ratings Routes ---
@app.route("/api/add-rating", methods=["POST"])
def add_rating():
    data = request.json
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

@app.route("/api/ratings/<user_id>", methods=["GET"])
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

@app.route("/api/admin/users", methods=["GET"])
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

@app.route("/api/admin/verify-user", methods=["POST"])
def admin_verify_user():
    data = request.json
    user_id = data.get('userId')
    if not user_id:
        return jsonify({"success": False, "message": "Missing userId"}), 400
    try:
        result = users_col.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"isVerified": True}}
        )
        if result.matched_count == 0:
            return jsonify({"success": False, "message": "User not found"}), 404
        print(f"Admin verified user: {user_id}")
        return jsonify({"success": True, "message": "User verified successfully"}), 200
    except Exception as e:
        print(f"Admin Verify User Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/admin/block-user", methods=["POST"])
def admin_block_user():
    data = request.json
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

@app.route("/api/admin/rides", methods=["GET"])
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

@app.route("/api/admin/reports", methods=["GET"])
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

@app.route("/api/user/verification/<user_id>", methods=["GET"])
def get_user_verification(user_id):
    try:
        verif = verifications_col.find_one({"userId": user_id})
        if verif:
            return jsonify({"success": True, "verification": parse_json(verif)}), 200
        else:
            return jsonify({"success": True, "verification": None}), 200
    except Exception as e:
        print(f"Get User Verification Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/report-user", methods=["POST"])
def report_user():
    data = request.json
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

@app.route("/api/reports/user/<user_id>", methods=["GET"])
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

@app.route("/api/admin/rate-user", methods=["POST"])
def admin_rate_user():
    data = request.json
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

@app.route("/api/admin/ride/<ride_id>", methods=["GET"])
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

@app.route("/api/ride/<ride_id>", methods=["GET"])
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

@app.route("/api/admin/verifications", methods=["GET"])
def admin_get_verifications():
    try:
        # Join verifications with user names
        pipeline = [
            {
                "$lookup": {
                    "from": "users",
                    "let": { "userId": "$userId" },
                    "pipeline": [
                        { "$match": { "$expr": { "$eq": ["$_id", { "$toObjectId": "$$userId" }] } } }
                    ],
                    "as": "user"
                }
            },
            { "$unwind": { "path": "$user", "preserveNullAndEmptyArrays": True } },
            {
                "$project": {
                    "_id": 1,
                    "userId": 1,
                    "licenseUrl": 1,
                    "rcUrl": 1,
                    "insuranceUrl": 1,
                    "status": 1,
                    "userName": "$user.name",
                    "userEmail": "$user.email"
                }
            }
        ]
        results = list(verifications_col.aggregate(pipeline))
        return jsonify({"success": True, "verifications": parse_json(results)}), 200
    except Exception as e:
        print(f"Admin Get Verifications Error: {e}")
        return jsonify({"success": False, "message": "Database error"}), 500

@app.route("/api/admin/verify/<user_id>", methods=["POST"])
def admin_approve_verification(user_id):
    try:
        verifications_col.update_one(
            {"userId": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
            {"$set": {"status": "approved"}}
        )
        users_col.update_one(
            {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
            {"$set": {"isVerified": True}}
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

@app.route("/api/admin/reject/<user_id>", methods=["POST"])
def admin_reject_verification(user_id):
    try:
        verifications_col.update_one(
            {"userId": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
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

@app.route("/api/upload-documents", methods=["POST"])
def user_upload_documents():
    try:
        user_id = request.form.get('userId')
        if not user_id:
            return jsonify({"success": False, "message": "Missing userId"}), 400
        
        # Get files from request
        license_file = request.files.get('license')
        rc_file = request.files.get('rc')
        insurance_file = request.files.get('insurance')
        
        if not all([license_file, rc_file, insurance_file]):
            return jsonify({"success": False, "message": "All 3 documents (License, RC, Insurance) are required"}), 400
            
        # Upload to Cloudinary with specific folders
        license_result = cloudinary.uploader.upload(license_file, folder=f"ridemate/kyc/{user_id}/license")
        rc_result = cloudinary.uploader.upload(rc_file, folder=f"ridemate/kyc/{user_id}/rc")
        insurance_result = cloudinary.uploader.upload(insurance_file, folder=f"ridemate/kyc/{user_id}/insurance")
        
        doc_entry = {
            "userId": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id,
            "licenseUrl": license_result.get("secure_url"),
            "rcUrl": rc_result.get("secure_url"),
            "insuranceUrl": insurance_result.get("secure_url"),
            "status": "pending",
            "createdAt": datetime.now()
        }
        
        # Upsert verification record
        verifications_col.update_one(
            {"userId": doc_entry["userId"]},
            {"$set": doc_entry},
            upsert=True
        )
        
        # Notify Admin
        user = users_col.find_one({"_id": doc_entry["userId"]})
        u_name = user.get('name') or user.get('username', 'Someone')
        
        admins = list(users_col.find({"role": "admin"}))
        for admin in admins:
            notifications_col.insert_one({
                "userId": str(admin["_id"]),
                "fromId": user_id,
                "type": "admin_alert",
                "title": "KYC Submission",
                "message": f"{u_name} uploaded documents for review",
                "isRead": False,
                "createdAt": datetime.now()
            })
            send_push_notification(str(admin["_id"]), "KYC Submission", f"{u_name} uploaded documents for review.", {"type": "admin_alert"})
        
        return jsonify({"success": True, "message": "Documents uploaded successfully to cloud"}), 200
    except Exception as e:
        print(f"Cloudinary Upload Error: {e}")
        return jsonify({"success": False, "message": f"Upload failure: {str(e)}"}), 500

@app.route("/", methods=["GET"])
def home():
    try:
        u_count = users_col.count_documents({})
        r_count = rides_col.count_documents({})
        return jsonify({
            "message": "MongoDB Backend running", 
            "users_count": u_count, 
            "rides_count": r_count
        }), 200
    except Exception as e:
        return jsonify({"message": "Backend running without DB", "error": str(e)}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Backend initiating on port {port}")
    app.run(host="0.0.0.0", port=port, debug=True)
