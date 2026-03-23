"""
API Testing Script
Tests all Flask API endpoints with various scenarios.
"""

import requests
import json

# API base URL
BASE_URL = "http://127.0.0.1:5000/api"


def print_test_header(test_name):
    """Print formatted test header."""
    print("\n" + "=" * 70)
    print(f"TEST: {test_name}")
    print("=" * 70)


def print_response(response):
    """Print formatted API response."""
    print(f"Status Code: {response.status_code}")
    print(f"Response:")
    print(json.dumps(response.json(), indent=2))


# ============================================================
# TEST 1: Health Check
# ============================================================
print_test_header("Health Check")
response = requests.get(f"{BASE_URL}/health")
print_response(response)


# ============================================================
# TEST 2: Get Available Filters
# ============================================================
print_test_header("Get Available Filter Options")
response = requests.get(f"{BASE_URL}/filters")
print_response(response)


# ============================================================
# TEST 3: Get Recipe by ID
# ============================================================
print_test_header("Get Recipe by ID (001 - Nasi Lemak)")
response = requests.get(f"{BASE_URL}/recipe/001")
print_response(response)


# ============================================================
# TEST 4: Get Recipe by ID - Not Found
# ============================================================
print_test_header("Get Recipe by ID - Not Found (999)")
response = requests.get(f"{BASE_URL}/recipe/999")
print_response(response)


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
# TEST 6: Recommendation with Dietary Filter
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
# TEST 7: Recommendation with Time Filter
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
# TEST 9: Recommendation with Exact Time Filter
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
# TEST 10: Error Handling - Missing Ingredients
# ============================================================
print_test_header("Error Handling - Missing Ingredients Field")
payload = {
    "method": "normalized"
}
response = requests.post(f"{BASE_URL}/recommend", json=payload)
print_response(response)


# ============================================================
# TEST 11: Get All Recipes
# ============================================================
print_test_header("Get All Recipes")
response = requests.get(f"{BASE_URL}/recipes")
print_response(response)


# ============================================================
# TEST 12: Get All Recipes with Query Filter
# ============================================================
print_test_header("Get All Recipes - Filter by Cuisine (Malay)")
response = requests.get(f"{BASE_URL}/recipes?cuisine=Malay")
print_response(response)


# ============================================================
# TEST 13: Recommendation with Halal Filter (NEW)
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
# TEST 14: Recommendation with Indian Cuisine Filter (NEW)
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


print("\n" + "=" * 70)
print("API TESTING COMPLETE")
print("=" * 70)