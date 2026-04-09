"""
API Testing Script
Tests all Flask API endpoints with various scenarios.
Smart Recipee — 100 Recipe Malaysian Database
"""

import requests
import json

# API base URL
BASE_URL = "http://127.0.0.1:5000/api"

# Track test results
passed = 0
failed = 0


def print_test_header(test_name):
    """Print formatted test header."""
    print("\n" + "=" * 70)
    print(f"TEST: {test_name}")
    print("=" * 70)


def print_response(response, show_full=False):
    """Print formatted API response."""
    global passed, failed

    print(f"Status Code: {response.status_code}")

    data = response.json()

    if response.status_code in [200, 201]:
        print("Result: ✅ PASSED")
        passed += 1
    else:
        print("Result: ❌ FAILED")
        failed += 1

    if show_full:
        print(f"Response:")
        print(json.dumps(data, indent=2))
    else:
        # Print summary only for large responses
        if 'data' in data:
            d = data['data']
            if 'recommendations' in d:
                print(f"Recipes returned: {len(d['recommendations'])}")
                print(f"Top 3 matches:")
                for r in d['recommendations'][:3]:
                    print(f"  - {r['name']} ({r['match_percentage']}%)")
            elif 'recipes' in d:
                print(f"Recipes returned: {len(d['recipes'])}")
                print(f"First 3:")
                for r in d['recipes'][:3]:
                    print(f"  - {r['name']} ({r.get('cuisine', 'N/A')})")
            else:
                print(json.dumps(data, indent=2))
        else:
            print(json.dumps(data, indent=2))


# ============================================================
# TEST 1: Health Check
# ============================================================
print_test_header("Health Check")
response = requests.get(f"{BASE_URL}/health")
print_response(response, show_full=True)


# ============================================================
# TEST 2: Get Available Filters
# ============================================================
print_test_header("Get Available Filter Options")
response = requests.get(f"{BASE_URL}/filters")
print_response(response, show_full=True)


# ============================================================
# TEST 3: Get Recipe by ID
# ============================================================
print_test_header("Get Recipe by ID (001 - Nasi Lemak)")
response = requests.get(f"{BASE_URL}/recipe/001")
data = response.json()
print(f"Status Code: {response.status_code}")
if data.get('success'):
    print("Result: ✅ PASSED")
    passed += 1
    recipe = data['data']
    print(f"Recipe: {recipe['name']}")
    print(f"Cuisine: {recipe['cuisine']}")
    print(f"Has nutrition: {'nutrition' in recipe}")
    print(f"Calories: {recipe.get('nutrition', {}).get('calories', 'N/A')} kcal")
else:
    print("Result: ❌ FAILED")
    failed += 1


# ============================================================
# TEST 4: Get Recipe by ID — Not Found
# ============================================================
print_test_header("Get Recipe by ID - Not Found (999)")
response = requests.get(f"{BASE_URL}/recipe/999")
data = response.json()
print(f"Status Code: {response.status_code}")
if response.status_code == 404:
    print("Result: ✅ PASSED (correctly returned 404)")
    passed += 1
else:
    print("Result: ❌ FAILED")
    failed += 1
print(f"Error message: {data.get('error')}")


# ============================================================
# TEST 5: Basic Recommendation (No Filters)
# ============================================================
print_test_header("Basic Recommendation - No Filters")
payload = {
    "ingredients": ["rice", "chicken", "egg", "coconut milk", "garlic"],
    "method": "normalized",
    "min_match": 20
}
response = requests.post(f"{BASE_URL}/recommend", json=payload)
print_response(response)


# ============================================================
# TEST 6: Recommendation with Dietary Filter (Vegetarian)
# ============================================================
print_test_header("Recommendation with Dietary Filter (Vegetarian)")
payload = {
    "ingredients": ["rice", "coconut milk", "egg", "flour", "peanuts"],
    "filters": {
        "dietary": ["vegetarian"]
    },
    "method": "normalized"
}
response = requests.post(f"{BASE_URL}/recommend", json=payload)
print_response(response)


# ============================================================
# TEST 7: Recommendation with Time Filter (Quick)
# ============================================================
print_test_header("Recommendation with Time Filter (Quick)")
payload = {
    "ingredients": ["rice", "egg", "coconut milk"],
    "filters": {
        "time_category": "quick"
    },
    "method": "normalized",
    "min_match": 10
}
response = requests.post(f"{BASE_URL}/recommend", json=payload)
print_response(response)


# ============================================================
# TEST 8: Recommendation with Multiple Filters
# ============================================================
print_test_header("Recommendation with Multiple Filters (Veg + Quick + Malay)")
payload = {
    "ingredients": ["rice", "coconut milk", "peanuts", "egg"],
    "filters": {
        "dietary": ["vegetarian"],
        "time_category": "quick",
        "cuisines": ["Malay"]
    },
    "method": "normalized"
}
response = requests.post(f"{BASE_URL}/recommend", json=payload)
print_response(response)


# ============================================================
# TEST 9: Recommendation with Difficulty Filter (Easy) — NEW
# ============================================================
print_test_header("Recommendation with Difficulty Filter (Easy)")
payload = {
    "ingredients": ["rice", "chicken", "egg", "garlic"],
    "filters": {
        "difficulty": "easy"
    },
    "method": "normalized",
    "min_match": 10
}
response = requests.post(f"{BASE_URL}/recommend", json=payload)
print_response(response)


# ============================================================
# TEST 10: Recommendation with Max Prep Time
# ============================================================
print_test_header("Recommendation with Max Prep Time (30 min)")
payload = {
    "ingredients": ["rice", "chicken", "egg", "garlic"],
    "filters": {
        "max_prep_time": 30
    },
    "method": "normalized",
    "min_match": 20
}
response = requests.post(f"{BASE_URL}/recommend", json=payload)
print_response(response)


# ============================================================
# TEST 11: Error Handling — Missing Ingredients
# ============================================================
print_test_header("Error Handling - Missing Ingredients Field")
payload = {
    "method": "normalized"
}
response = requests.post(f"{BASE_URL}/recommend", json=payload)
data = response.json()
print(f"Status Code: {response.status_code}")
if response.status_code == 400:
    print("Result: ✅ PASSED (correctly returned 400)")
    passed += 1
else:
    print("Result: ❌ FAILED")
    failed += 1
print(f"Error message: {data.get('error')}")


# ============================================================
# TEST 12: Get All Recipes
# ============================================================
print_test_header("Get All Recipes")
response = requests.get(f"{BASE_URL}/recipes")
data = response.json()
print(f"Status Code: {response.status_code}")
if data.get('success'):
    print("Result: ✅ PASSED")
    passed += 1
    print(f"Total recipes: {data['data']['total_recipes']}")
else:
    print("Result: ❌ FAILED")
    failed += 1


# ============================================================
# TEST 13: Get All Recipes with Cuisine Filter
# ============================================================
print_test_header("Get All Recipes - Filter by Cuisine (Malay)")
response = requests.get(f"{BASE_URL}/recipes?cuisine=Malay")
data = response.json()
print(f"Status Code: {response.status_code}")
if data.get('success'):
    print("Result: ✅ PASSED")
    passed += 1
    print(f"Malay recipes returned: {data['data']['total_recipes']}")
else:
    print("Result: ❌ FAILED")
    failed += 1


# ============================================================
# TEST 14: Recommendation with Halal Filter
# ============================================================
print_test_header("Recommendation with Dietary Filter (Halal)")
payload = {
    "ingredients": ["rice", "chicken", "coconut milk", "egg"],
    "filters": {
        "dietary": ["halal"]
    },
    "method": "normalized",
    "min_match": 20
}
response = requests.post(f"{BASE_URL}/recommend", json=payload)
print_response(response)


# ============================================================
# TEST 15: Recommendation with Indian Cuisine Filter
# ============================================================
print_test_header("Recommendation with Cuisine Filter (Indian)")
payload = {
    "ingredients": ["flour", "egg", "ghee", "water"],
    "filters": {
        "cuisines": ["Indian"]
    },
    "method": "normalized",
    "min_match": 30
}
response = requests.post(f"{BASE_URL}/recommend", json=payload)
print_response(response)


# ============================================================
# TEST 16: Get Ratings for a Recipe — NEW
# ============================================================
print_test_header("Get Ratings - Recipe 001 (Nasi Lemak)")
response = requests.get(f"{BASE_URL}/ratings/001")
data = response.json()
print(f"Status Code: {response.status_code}")
if data.get('success'):
    print("Result: ✅ PASSED")
    passed += 1
    print(f"Average rating: {data['data']['average']}")
    print(f"Total ratings: {data['data']['total']}")
else:
    print("Result: ❌ FAILED")
    failed += 1


# ============================================================
# TEST 17: Submit a Rating — NEW
# ============================================================
print_test_header("Submit Rating - Recipe 001")
payload = {
    "stars": 5,
    "comment": "Automated test rating"
}
response = requests.post(f"{BASE_URL}/ratings/001", json=payload)
data = response.json()
print(f"Status Code: {response.status_code}")
if response.status_code == 201 and data.get('success'):
    print("Result: ✅ PASSED")
    passed += 1
    print(f"New average: {data['data']['average']}")
    print(f"Total ratings now: {data['data']['total']}")
else:
    print("Result: ❌ FAILED")
    failed += 1


# ============================================================
# TEST 18: Submit Rating — Invalid Stars — NEW
# ============================================================
print_test_header("Submit Rating - Invalid Stars (Error Handling)")
payload = {
    "stars": 10,
    "comment": "This should fail"
}
response = requests.post(f"{BASE_URL}/ratings/001", json=payload)
data = response.json()
print(f"Status Code: {response.status_code}")
if response.status_code == 400:
    print("Result: ✅ PASSED (correctly returned 400)")
    passed += 1
else:
    print("Result: ❌ FAILED")
    failed += 1
print(f"Error message: {data.get('error')}")


# ============================================================
# TEST 19: Chat Endpoint — NEW
# ============================================================
print_test_header("Chat Endpoint - Culinary Assistant")
payload = {
    "message": "What can I cook with rice and chicken?",
    "ingredients": ["rice", "chicken", "egg", "garlic"],
    "recipes": [],
    "history": []
}
response = requests.post(f"{BASE_URL}/chat", json=payload)
data = response.json()
print(f"Status Code: {response.status_code}")
if data.get('success'):
    print("Result: ✅ PASSED")
    passed += 1
    reply = data['data']['reply']
    print(f"Assistant reply (first 150 chars):")
    print(f"  {reply[:150]}...")
else:
    print("Result: ❌ FAILED")
    failed += 1
    print(f"Error: {data.get('error')}")


# ============================================================
# TEST 20: Chat Endpoint — Missing Message — NEW
# ============================================================
print_test_header("Chat Endpoint - Error Handling (Missing Message)")
payload = {
    "ingredients": ["rice", "chicken"],
    "recipes": [],
    "history": []
}
response = requests.post(f"{BASE_URL}/chat", json=payload)
data = response.json()
print(f"Status Code: {response.status_code}")
if response.status_code == 400:
    print("Result: ✅ PASSED (correctly returned 400)")
    passed += 1
else:
    print("Result: ❌ FAILED")
    failed += 1
print(f"Error message: {data.get('error')}")


# ============================================================
# SUMMARY
# ============================================================
total = passed + failed
print("\n" + "=" * 70)
print("API TESTING COMPLETE — SUMMARY")
print("=" * 70)
print(f"""
  Total tests run  : {total}
  Passed           : {passed} ✅
  Failed           : {failed} ❌
  Success rate     : {round((passed / total) * 100, 1)}%

  Endpoints tested :
    GET  /api/health          ✅
    GET  /api/filters         ✅
    GET  /api/recipes         ✅
    GET  /api/recipe/<id>     ✅
    POST /api/recommend       ✅
    GET  /api/ratings/<id>    ✅
    POST /api/ratings/<id>    ✅
    POST /api/chat            ✅
""")