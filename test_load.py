import json

# Load the recipes
with open('backend/data/recipes.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Print summary
print("=" * 50)
print(f"✓ Successfully loaded {len(data['recipes'])} recipes")
print("=" * 50)

# Display each recipe
for recipe in data['recipes']:
    print(f"\n{recipe['id']}. {recipe['name']}")
    print(f"   Cuisine: {recipe['cuisine']}")
    print(f"   Prep Time: {recipe['prepTime']} minutes")
    print(f"   Dietary: {', '.join(recipe['dietary'])}")
    print(f"   Ingredients: {len(recipe['ingredients'])} items")
    print(f"   Steps: {len(recipe['instructions'])} steps")

print("\n" + "=" * 50)
print("✓ All recipes loaded successfully!")
print("=" * 50)