import os
from pymongo import MongoClient
from bson.objectid import ObjectId

def migrate():
    try:
        mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        db = client["ridemate"]
        rides_col = db["rides"]
        
        print("Connected to MongoDB for lifecycle transition.")
        
        # 1. Update status: 'upcoming' -> 'accepted'
        result_upcoming = rides_col.update_many(
            {"status": "upcoming"},
            {"$set": {"status": "accepted"}}
        )
        print(f"Updated {result_upcoming.modified_count} rides from 'upcoming' to 'accepted'.")
        
        # 2. Ensure ALL rides have a 'passengers' array
        result_init = rides_col.update_many(
            {"passengers": {"$exists": False}},
            {"$set": {"passengers": []}}
        )
        print(f"Initialized 'passengers' array for {result_init.modified_count} rides.")
        
        print("Lifecycle migration complete.")
        
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
