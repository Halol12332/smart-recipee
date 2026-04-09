import json
from backend.utils.matcher import get_recipe_recommendations

# Load recipes
with open('backend/data/recipes.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    recipes = data['recipes']

print(f"Loaded {len(recipes)} recipes\n")

# ============================================================
# TEST CASE 1: User has common Malaysian cooking ingredients
# ============================================================

print("=" * 60)
print("TEST CASE 1: User has common Malaysian ingredients")
print("=" * 60)

user_ingredients_1 = ["rice", "chicken", "egg", "coconut milk", "garlic"]

results_1 = get_recipe_recommendations(user_ingredients_1, recipes)

print(f"\nUser has: {', '.join(user_ingredients_1)}")
print(f"\nFound {len(results_1)} matching recipes:\n")

for recipe in results_1:
    print(f"{recipe['name']}")
    print(f"  Match: {recipe['match_percentage']}%")
    print(f"  Matched: {recipe['total_matched']}/{recipe['total_required']} ingredients")
    print(f"  Missing: {', '.join(recipe['missing_ingredients'])}")
    if recipe.get('nutrition'):
        print(f"  Calories: {recipe['nutrition']['calories']} kcal")
    print()


# ============================================================
# TEST CASE 2: User has typical Malaysian pantry items
# ============================================================

print("=" * 60)
print("TEST CASE 2: User has Malaysian pantry staples")
print("=" * 60)

user_ingredients_2 = ["rice", "coconut milk", "pandan leaves", "egg", "peanuts"]

results_2 = get_recipe_recommendations(user_ingredients_2, recipes)

print(f"\nUser has: {', '.join(user_ingredients_2)}")
print(f"\nFound {len(results_2)} matching recipes:\n")

for recipe in results_2:
    print(f"{recipe['name']}")
    print(f"  Match: {recipe['match_percentage']}%")
    print(f"  Matched: {recipe['total_matched']}/{recipe['total_required']} ingredients")
    print(f"  Missing: {', '.join(recipe['missing_ingredients'])}")
    print()

# ============================================================
# TEST CASE 3: User has only 2 ingredients
# ============================================================

print("=" * 60)
print("TEST CASE 3: User has limited ingredients")
print("=" * 60)

user_ingredients_3 = ["rice", "egg"]

results_3 = get_recipe_recommendations(user_ingredients_3, recipes, min_match=20)

print(f"\nUser has: {', '.join(user_ingredients_3)}")
print(f"Minimum match threshold: 20%")
print(f"\nFound {len(results_3)} matching recipes:\n")

for recipe in results_3:
    print(f"{recipe['name']}")
    print(f"  Match: {recipe['match_percentage']}%")
    print(f"  Matched: {recipe['total_matched']}/{recipe['total_required']} ingredients")
    print(f"  Missing: {', '.join(recipe['missing_ingredients'])}")
    print()

# ============================================================
# TEST CASE 4: User has Indian cooking ingredients
# ============================================================

print("=" * 60)
print("TEST CASE 4: User has Indian cooking ingredients")
print("=" * 60)

user_ingredients_4 = ["all purpose flour", "egg", "ghee", "water"]

results_4 = get_recipe_recommendations(user_ingredients_4, recipes, min_match=30)

print(f"\nUser has: {', '.join(user_ingredients_4)}")
print(f"Minimum match threshold: 30%")
print(f"\nFound {len(results_4)} matching recipes:\n")

for recipe in results_4:
    print(f"{recipe['name']}")
    print(f"  Match: {recipe['match_percentage']}%")
    print(f"  Matched: {recipe['total_matched']}/{recipe['total_required']} ingredients")
    print(f"  Missing: {', '.join(recipe['missing_ingredients'])}")
    print()