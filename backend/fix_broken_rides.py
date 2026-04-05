from pymongo import MongoClient
import os

def migrate():
    # Use environment variables or default to localhost
    mongo_uri = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/ridemate')
    client = MongoClient(mongo_uri)
    db = client.get_database()
    
    print("--- Starting Ride Lifecycle Migration ---")
    
    # Target: Rides that are "cancelled" but have passengers
    # These should be "upcoming" according to the new logic
    query = {
        "status": "cancelled",
        "passengers": {"$exists": True, "$ne": []}
    }
    
    rides_to_fix = list(db.rides.find(query))
    print(f"Found {len(rides_to_fix)} broken rides to restore.")
    
    if len(rides_to_fix) > 0:
        result = db.rides.update_many(
            query,
            {"$set": {"status": "upcoming"}}
        )
        print(f"Successfully restored {result.modified_count} rides to 'upcoming'.")
    else:
        print("No broken rides found.")
    
    print("--- Migration Complete ---")

if __name__ == "__main__":
    migrate()
