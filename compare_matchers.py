import json
import time
from backend.utils.matcher import get_recipe_recommendations

# Load recipes
with open('backend/data/recipes.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    recipes = data['recipes']

# Define test cases
test_cases = [
    {
        'name': 'Perfect Match - Nasi Lemak',
        'ingredients': ["rice", "coconut milk", "pandan leaves", "egg", "cucumber", "peanuts", "ikan bilis", "sambal"],
        'expected_best': 'Nasi Lemak'
    },
    {
        'name': 'Variation Test (chicken vs chicken breast)',
        'ingredients': ["rice", "chicken", "egg", "soy sauce", "garlic"],
        'expected_best': 'Hainanese Chicken Rice or similar'
    },
    {
        'name': 'Typo Test (chicekn instead of chicken)',
        'ingredients': ["rice", "chicekn", "egg", "soy sauce", "garlic"],
        'expected_best': 'Chicken-based recipe (if fuzzy/hybrid works)'
    },
    {
        'name': 'Limited Ingredients',
        'ingredients': ["rice", "egg"],
        'expected_best': 'Any rice-based recipe'
    }
]

# Methods to compare
methods = ['exact', 'normalized', 'fuzzy', 'hybrid']

print("=" * 80)
print("MATCHER COMPARISON FRAMEWORK ")
print("=" * 80)

for test_case in test_cases:
    print(f"\n{'='*80}")
    print(f"TEST CASE: {test_case['name']}")
    print(f"User ingredients: {', '.join(test_case['ingredients'])}")
    print(f"Expected: {test_case['expected_best']}")
    print(f"{'='*80}\n")
    
    for method in methods:
        print(f"--- METHOD: {method.upper()} ---")
        
        # Measure performance
        start_time = time.time()
        results = get_recipe_recommendations(
            test_case['ingredients'], 
            recipes, 
            min_match=10,
            method=method
        )
        end_time = time.time()
        
        execution_time = (end_time - start_time) * 1000  # Convert to milliseconds
        
        # Display top 3 results
        if results:
            print(f"Found {len(results)} recipes | Execution: {execution_time:.2f}ms\n")
            for i, recipe in enumerate(results[:3], 1):
                print(f"  {i}. {recipe['name']}")
                print(f"     Match: {recipe['match_percentage']}%")
                print(f"     Matched: {recipe['total_matched']}/{recipe['total_required']}")
                print(f"     Missing: {', '.join(recipe['missing_ingredients'][:3])}")
                if len(recipe['missing_ingredients']) > 3:
                    print(f"     + {len(recipe['missing_ingredients']) - 3} more...")
                print()
        else:
            print("No matches found\n")
        
        print()
