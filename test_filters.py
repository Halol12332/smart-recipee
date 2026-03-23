import json
from backend.utils.matcher import get_recipe_recommendations
from backend.utils.filter import apply_all_filters, get_available_filter_options

# Load recipes
with open('backend/data/recipes.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    recipes = data['recipes']

print("=" * 80)
print("FILTERING SYSTEM TEST ")
print("=" * 80)

# First, show available filter options
print("\n--- AVAILABLE FILTER OPTIONS ---")
options = get_available_filter_options(recipes)
print(f"Dietary Options: {', '.join(options['dietary_options'])}")
print(f"Cuisines: {', '.join(options['cuisines'])}")
print(f"Prep Time Range: {options['min_prep_time']}-{options['max_prep_time']} minutes")
print(f"Time Categories: {', '.join(options['time_categories'])}")

# ============================================================
# TEST 1: Filter by Dietary Preference (Vegetarian)
# ============================================================
print("\n" + "=" * 80)
print("TEST 1: Dietary Filter - Vegetarian Only")
print("=" * 80)

user_ingredients = ["rice", "coconut milk", "egg", "flour", "peanuts"]
recommendations = get_recipe_recommendations(user_ingredients, recipes, method='normalized')

print(f"\nBefore filter: {len(recommendations)} recipes")
for recipe in recommendations[:5]:
    print(f"  - {recipe['name']} ({', '.join(recipe['dietary'])})")

# Apply vegetarian filter
filters = {'dietary': ['vegetarian']}
filtered = apply_all_filters(recommendations, filters)

print(f"\nAfter vegetarian filter: {len(filtered)} recipes")
for recipe in filtered:
    print(f"  ✓ {recipe['name']}")
    print(f"    Dietary: {', '.join(recipe['dietary'])}")
    print(f"    Match: {recipe['match_percentage']}%")
    print()

# ============================================================
# TEST 2: Filter by Dietary Preference (Halal)
# ============================================================
print("=" * 80)
print("TEST 2: Dietary Filter - Halal Only")
print("=" * 80)

user_ingredients = ["rice", "chicken", "egg", "coconut milk", "garlic"]
recommendations = get_recipe_recommendations(user_ingredients, recipes, method='normalized')

print(f"\nBefore filter: {len(recommendations)} recipes")
for recipe in recommendations[:5]:
    print(f"  - {recipe['name']} ({', '.join(recipe['dietary'])})")

# Apply halal filter
filters = {'dietary': ['halal']}
filtered = apply_all_filters(recommendations, filters)

print(f"\nAfter halal filter: {len(filtered)} recipes")
print(f"Showing first 5 halal recipes:")
for recipe in filtered[:5]:
    print(f"  ✓ {recipe['name']} ({recipe['cuisine']}) - {recipe['match_percentage']}%")

# ============================================================
# TEST 3: Filter by Prep Time (Quick recipes ≤30 min)
# ============================================================
print("\n" + "=" * 80)
print("TEST 3: Prep Time Filter - Quick Recipes (≤30 minutes)")
print("=" * 80)

user_ingredients = ["rice", "egg", "coconut milk", "peanuts"]
recommendations = get_recipe_recommendations(user_ingredients, recipes, method='normalized')

print(f"\nBefore filter: {len(recommendations)} recipes")
for recipe in recommendations[:5]:
    print(f"  - {recipe['name']} ({recipe['prepTime']} min)")

# Apply quick time filter
filters = {'time_category': 'quick'}
filtered = apply_all_filters(recommendations, filters)

print(f"\nAfter 'quick' filter (≤30 min): {len(filtered)} recipes")
for recipe in filtered:
    print(f"  ✓ {recipe['name']}")
    print(f"    Prep Time: {recipe['prepTime']} minutes")
    print(f"    Match: {recipe['match_percentage']}%")
    print()

# ============================================================
# TEST 4: Filter by Cuisine (Malay only)
# ============================================================
print("=" * 80)
print("TEST 4: Cuisine Filter - Malay Cuisine Only")
print("=" * 80)

user_ingredients = ["rice", "coconut milk", "egg", "pandan leaves"]
recommendations = get_recipe_recommendations(user_ingredients, recipes, method='normalized')

print(f"\nBefore filter: {len(recommendations)} recipes")
for recipe in recommendations[:5]:
    print(f"  - {recipe['name']} ({recipe['cuisine']})")

# Apply Malay cuisine filter
filters = {'cuisines': ['Malay']}
filtered = apply_all_filters(recommendations, filters)

print(f"\nAfter Malay filter: {len(filtered)} recipes")
for recipe in filtered:
    print(f"  ✓ {recipe['name']}")
    print(f"    Prep Time: {recipe['prepTime']} minutes")
    print(f"    Match: {recipe['match_percentage']}%")
    print()

# ============================================================
# TEST 5: Filter by Cuisine (Indian only)
# ============================================================
print("=" * 80)
print("TEST 5: Cuisine Filter - Indian Cuisine Only")
print("=" * 80)

user_ingredients = ["flour", "egg", "ghee", "water"]
recommendations = get_recipe_recommendations(user_ingredients, recipes, method='normalized')

print(f"\nBefore filter: {len(recommendations)} recipes")
for recipe in recommendations[:5]:
    print(f"  - {recipe['name']} ({recipe['cuisine']})")

# Apply Indian cuisine filter
filters = {'cuisines': ['Indian']}
filtered = apply_all_filters(recommendations, filters)

print(f"\nAfter Indian filter: {len(filtered)} recipes")
for recipe in filtered:
    print(f"  ✓ {recipe['name']}")
    print(f"    Prep Time: {recipe['prepTime']} minutes")
    print(f"    Match: {recipe['match_percentage']}%")
    print()

# ============================================================
# TEST 6: Multiple Filters Combined - Vegetarian + Malay
# ============================================================
print("=" * 80)
print("TEST 6: Combined Filters - Vegetarian + Malay Cuisine")
print("=" * 80)

user_ingredients = ["rice", "coconut milk", "peanuts", "egg", "flour"]
recommendations = get_recipe_recommendations(user_ingredients, recipes, method='normalized')

print(f"\nBefore filter: {len(recommendations)} recipes")
for recipe in recommendations[:5]:
    print(f"  - {recipe['name']}: {recipe['cuisine']}, "
          f"{', '.join(recipe['dietary'])}, {recipe['prepTime']} min")

# Apply multiple filters
filters = {
    'dietary': ['vegetarian'],
    'cuisines': ['Malay']
}
filtered = apply_all_filters(recommendations, filters)

print(f"\nAfter combined filters (Vegetarian + Malay): {len(filtered)} recipes")
if filtered:
    for recipe in filtered:
        print(f"  ✓ {recipe['name']}")
        print(f"    Cuisine: {recipe['cuisine']}")
        print(f"    Dietary: {', '.join(recipe['dietary'])}")
        print(f"    Prep Time: {recipe['prepTime']} minutes")
        print(f"    Match: {recipe['match_percentage']}%")
        print()
else:
    print("  No recipes match all criteria!")
    print("  Suggestion: Try relaxing some filter requirements")

# ============================================================
# TEST 7: Triple Filter - Vegetarian + Quick + Indian
# ============================================================
print("=" * 80)
print("TEST 7: Triple Filters - Vegetarian + Quick (≤30 min) + Indian")
print("=" * 80)

user_ingredients = ["flour", "egg", "ghee", "milk", "water"]
recommendations = get_recipe_recommendations(user_ingredients, recipes, method='normalized')

print(f"\nBefore filter: {len(recommendations)} recipes")
for recipe in recommendations[:5]:
    print(f"  - {recipe['name']}: {recipe['cuisine']}, "
          f"{', '.join(recipe['dietary'])}, {recipe['prepTime']} min")

# Apply multiple filters
filters = {
    'dietary': ['vegetarian'],
    'time_category': 'quick',
    'cuisines': ['Indian']
}
filtered = apply_all_filters(recommendations, filters)

print(f"\nAfter triple filters: {len(filtered)} recipes")
if filtered:
    for recipe in filtered:
        print(f"  ✓ {recipe['name']}")
        print(f"    Cuisine: {recipe['cuisine']}")
        print(f"    Dietary: {', '.join(recipe['dietary'])}")
        print(f"    Prep Time: {recipe['prepTime']} minutes")
        print(f"    Match: {recipe['match_percentage']}%")
        print()
else:
    print("  No recipes match all criteria!")
    print("  Suggestion: Try relaxing some filter requirements")

# ============================================================
# TEST 8: Exact Prep Time Filter (≤30 minutes)
# ============================================================
print("=" * 80)
print("TEST 8: Exact Prep Time - Maximum 30 Minutes")
print("=" * 80)

user_ingredients = ["rice", "chicken", "egg", "coconut milk", "garlic"]
recommendations = get_recipe_recommendations(user_ingredients, recipes, method='normalized')

print(f"\nBefore filter: {len(recommendations)} recipes")
for recipe in recommendations[:5]:
    print(f"  - {recipe['name']} ({recipe['prepTime']} min)")

# Apply exact max time filter
filters = {'max_prep_time': 30}
filtered = apply_all_filters(recommendations, filters)

print(f"\nAfter max 30 minutes filter: {len(filtered)} recipes")
for recipe in filtered:
    print(f"  ✓ {recipe['name']}")
    print(f"    Prep Time: {recipe['prepTime']} minutes")
    print(f"    Match: {recipe['match_percentage']}%")
    print()

