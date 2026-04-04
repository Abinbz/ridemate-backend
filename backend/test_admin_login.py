import requests
import json

BASE = "http://localhost:5000"

# Test 1: Admin Login
print("=" * 40)
print("TEST 1: Admin Login")
r = requests.post(f"{BASE}/api/admin/login", json={"username": "adminkmct", "password": "Kmct@2026"})
print(f"  Status: {r.status_code}")
print(f"  Body:   {r.json()}")
assert r.status_code == 200 and r.json()["success"] == True, "FAILED"
print("  PASSED")

# Test 2: Admin Login - Wrong Password
print("\nTEST 2: Admin Login - Wrong Password")
r = requests.post(f"{BASE}/api/admin/login", json={"username": "adminkmct", "password": "wrong"})
print(f"  Status: {r.status_code}")
print(f"  Body:   {r.json()}")
assert r.status_code == 401 and r.json()["success"] == False, "FAILED"
print("  PASSED")

# Test 3: User Login
print("\nTEST 3: User Login (arjun / Demo@123)")
r = requests.post(f"{BASE}/api/login", json={"username": "arjun", "password": "Demo@123"})
print(f"  Status: {r.status_code}")
print(f"  Body:   {r.json()}")
assert r.status_code == 200 and r.json()["success"] == True, "FAILED"
print("  PASSED")

# Test 4: User Login - Wrong Password
print("\nTEST 4: User Login - Wrong Password")
r = requests.post(f"{BASE}/api/login", json={"username": "arjun", "password": "wrong"})
print(f"  Status: {r.status_code}")
print(f"  Body:   {r.json()}")
assert r.status_code == 401 and r.json()["success"] == False, "FAILED"
print("  PASSED")

print("\n" + "=" * 40)
print("ALL TESTS PASSED")
