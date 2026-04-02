import json
from datetime import datetime, timedelta
from bson.objectid import ObjectId
from pymongo import MongoClient
import random

# --- Database Setup ---
client = MongoClient("mongodb://localhost:27017/")
db = client["ridemate"]
users_col = db["users"]
rides_col = db["rides"]
reports_col = db["reports"]
messages_col = db["messages"]
ratings_col = db["ratings"]
notifications_col = db["notifications"]
verifications_col = db["verifications"]

# Clear existing data
print("Wiping existing data for clean demo seed...")
users_col.delete_many({})
rides_col.delete_many({})
reports_col.delete_many({})
messages_col.delete_many({})
ratings_col.delete_many({})
notifications_col.delete_many({})
verifications_col.delete_many({})

# Constants
PASSWORD = "Demo@123"
LOCATIONS = ["Kochi", "Trivandrum", "Kozhikode", "Thrissur", "Kottayam", "Kannur", "Palakkad"]
today = datetime.now()
tomorrow = today + timedelta(days=1)
completed_date = today - timedelta(days=2)

user_data = [
    ("abhijith", "KMCT001", "9876543210"),
    ("arjun", "KMCT002", "9876543211"),
    ("ashwin", "KMCT003", "9876543212"),
    ("favas", "KMCT004", "9876543213"),
    ("nikhil", "KMCT005", "9876543214"),
    ("faisal", "KMCT006", "9876543215"),
    ("akhil", "KMCT007", "9876543216"),
    ("rohit", "KMCT008", "9876543217"),
    ("anjali", "KMCT009", "9876543218"),
    ("varsha", "KMCT010", "9876543219"),
]

# 1. Create Admin
admin_id = users_col.insert_one({
    "name": "System Admin",
    "username": "adminkmct",
    "password": "Kmct@2026",
    "role": "admin",
    "email": "admin@ridemate.com"
}).inserted_id

# 2. Create Users
user_map = {} # username -> _id
for name, cid, phone in user_data:
    u_id = users_col.insert_one({
        "name": name.capitalize(),
        "username": name,
        "email": f"{name}@gmail.com",
        "phone": phone,
        "collegeId": cid,
        "password": PASSWORD,
        "role": "user",
        "avgRating": round(random.uniform(4.0, 5.0), 1),
        "isVerified": False,
        "isBlocked": False,
        "createdAt": today
    }).inserted_id
    user_map[name] = u_id

# 3. Assign Vehicles
vehicles = {
    "abhijith": "Maruti Swift",
    "arjun": "Hyundai i20",
    "ashwin": "Toyota Innova",
    "nikhil": "Hyundai Creta",
    "faisal": "Maruti WagonR",
    "akhil": "Honda Activa",
    "rohit": "Maruti Alto",
    "varsha": "Maruti Baleno",
    "favas": "Renault Kwid"
}

# 4. Document Verifications
print("Creating verifications...")
verif_list = [
    ("arjun", "approved"),
    ("abhijith", "approved"),
    ("nikhil", "approved"),
    ("favas", "pending"),
    ("akhil", "pending"),
    ("varsha", "pending"),
]

for uname, status in verif_list:
    verifications_col.insert_one({
        "userId": str(user_map[uname]),
        "licenseUrl": "https://res.cloudinary.com/demo/image/upload/v1625470535/sample.jpg", # Placeholder
        "rcUrl": "https://res.cloudinary.com/demo/image/upload/v1625470535/sample.jpg",
        "insuranceUrl": "https://res.cloudinary.com/demo/image/upload/v1625470535/sample.jpg",
        "status": status,
        "createdAt": today
    })
    if status == "approved":
        users_col.update_one({"_id": user_map[uname]}, {"$set": {"isVerified": True}})

# 5. Rides
print("Creating rides...")
rides_to_create = [
    # Upcoming (tomorrow)
    {"driver": "arjun", "from": "Kochi", "to": "Trivandrum", "status": "Scheduled", "date": tomorrow, "passengers": ["anjali", "rohit"]},
    {"driver": "ashwin", "from": "Thrissur", "to": "Kozhikode", "status": "Scheduled", "date": tomorrow, "passengers": ["akhil"]},
    # Ongoing (today)
    {"driver": "abhijith", "from": "Kochi", "to": "Kottayam", "status": "Ongoing", "date": today, "passengers": ["faisal", "varsha"]},
    {"driver": "nikhil", "from": "Kozhikode", "to": "Kannur", "status": "Ongoing", "date": today, "passengers": ["favas"]},
    # Completed (past)
    {"driver": "rohit", "from": "Trivandrum", "to": "Kochi", "status": "Completed", "date": completed_date, "passengers": ["anjali"]},
    {"driver": "varsha", "from": "Palakkad", "to": "Thrissur", "status": "Completed", "date": completed_date, "passengers": ["abhijith"]},
    {"driver": "favas", "from": "Kozhikode", "to": "Kochi", "status": "Completed", "date": completed_date, "passengers": ["nikhil"]}
]

ride_map = {} # Ride index -> _id
for i, r in enumerate(rides_to_create):
    passengers = []
    for p_uname in r["passengers"]:
        passengers.append({
            "userId": str(user_map[p_uname]),
            "name": p_uname.capitalize(),
            "status": "booked"
        })
    
    ride_id = rides_col.insert_one({
        "driverId": str(user_map[r["driver"]]),
        "driverName": r["driver"].capitalize(),
        "startingFrom": r["from"],
        "goingTo": r["to"],
        "date": r["date"].strftime("%Y-%m-%d"),
        "time": "10:30 AM",
        "seats": 4,
        "price": random.randint(150, 450),
        "vehicle": vehicles.get(r["driver"], "Unknown Vehicle"),
        "status": r["status"],
        "passengers": passengers,
        "createdAt": r["date"]
    }).inserted_id
    ride_map[i+1] = ride_id

# 6. Chat Messages
print("Adding messages...")
chat_scenarios = [
    (3, "abhijith", "faisal"), # Ride 3: Driver abhijith chats with Faisal
    (4, "nikhil", "favas"),   # Ride 4: Driver nikhil chats with Favas
]

for ride_no, driver, passenger in chat_scenarios:
    ride_id = ride_map[ride_no]
    d_id = user_map[driver]
    p_id = user_map[passenger]
    
    messages = [
        (p_id, d_id, "Hi, where are you?"),
        (d_id, p_id, "I am near pickup"),
        (p_id, d_id, "Okay, coming")
    ]
    
    for sender, receiver, text in messages:
        messages_col.insert_one({
            "rideId": str(ride_id),
            "senderId": str(sender),
            "receiverId": str(receiver),
            "text": text,
            "timestamp": today - timedelta(minutes=random.randint(1, 60))
        })

# 7. Ratings
print("Adding ratings...")
ratings_list = [
    ("anjali", "rohit", 5, "Great drive!"),
    ("rohit", "anjali", 4, "Polite passenger."),
    ("abhijith", "varsha", 5, "Very smooth experience.")
]

for reporter, reported, score, comment in ratings_list:
    ratings_col.insert_one({
        "fromId": str(user_map[reporter]),
        "toId": str(user_map[reported]),
        "score": score,
        "comment": comment,
        "rideId": str(ride_map[5] if reporter=="anjali" else ride_map[6]),
        "createdAt": today
    })

# 8. Reports
print("Creating reports...")
reports_data = [
    ("anjali", "akhil", "Late pickup", "Driver was late"),
    ("rohit", "favas", "Inappropriate Behavior", "Rude behavior"),
    ("varsha", "nikhil", "Safety Concern", "Did not show up")
]

for reporter, reported, reason, details in reports_data:
    reports_col.insert_one({
        "reporterId": str(user_map[reporter]),
        "reportedId": str(user_map[reported]),
        "rideId": str(ride_map[1]), # Mock ride link
        "reason": reason,
        "details": details,
        "status": "pending",
        "createdAt": today,
        # Display fields for frontend
        "reporterName": reporter.capitalize(),
        "reportedName": reported.capitalize()
    })

# 9. Notifications
print("Adding notifications...")
notif_data = [
    ("anjali", "New Message", "Arjun sent you a message", "message"),
    ("rohit", "Ride Booked", "Your booking for Kochi is confirmed", "ride"),
    ("nikhil", "Rating Received", "Varsha gave you 5 stars", "rating"),
    ("favas", "Verification Pending", "Your documents are under review", "document")
]

for uname, title, msg, type in notif_data:
    notifications_col.insert_one({
        "userId": str(user_map[uname]),
        "title": title,
        "message": msg,
        "type": type,
        "read": False,
        "createdAt": today
    })

# 10. Cancellation Scenario
# Arjun's ride was cancelled (scheduled)
print("Marking Ride 1 as Cancelled...")
rides_col.update_one({"_id": ride_map[1]}, {"$set": {"status": "Cancelled"}})

# Anjali leaves Ride 3
print("Processing Anjali leaving Ride 3 (mock)...")
# Anjali wasn't in Ride 3's initial list according to PART 7, but let's assume we want to show a notification
notifications_col.insert_one({
    "userId": str(user_map["abhijith"]),
    "title": "Booking Cancelled",
    "message": "Anjali has left your ride to Kottayam.",
    "type": "ride",
    "read": False,
    "createdAt": today
})

print("\n" + "="*40)
print("DEMO SEED DATA LOG")
print("="*40)
print(f"Users created: {users_col.count_documents({})}")
print(f"Admin: adminkmct / Kmct@2026")
print(f"Default User Password: {PASSWORD}")
print("\nRide List:")
for r in rides_col.find():
    print(f"- {r['driverName']} | {r['startingFrom']} -> {r['goingTo']} | Status: {r['status']}")

print(f"\nPending Verifications: {verifications_col.count_documents({'status': 'pending'})}")
print(f"Reports Filed: {reports_col.count_documents({})}")
print(f"Chat Messages: {messages_col.count_documents({})}")
print("="*40)
print("SEEDING COMPLETE. RideMate is ready for Demo.")
