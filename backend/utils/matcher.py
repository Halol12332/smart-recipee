from difflib import SequenceMatcher


# ============================================================
# INGREDIENT NORMALIZATION
# ============================================================

def normalize_ingredient(ingredient_name):
    """
    Normalize ingredient names to handle common variations.
    Maps specific ingredients to their general category.
    
    Args:
        ingredient_name: Original ingredient name
        
    Returns:
        Normalized ingredient name
    """
    ingredient = ingredient_name.lower().strip()
    
    # Ingredient normalization rules
    normalizations = {
        # Poultry variations
        'chicken breast': 'chicken',
        'chicken thigh': 'chicken',
        'chicken drumstick': 'chicken',
        'chicken wing': 'chicken',
        'chicken meat': 'chicken',
        
        # Onion variations
        'red onion': 'onion',
        'white onion': 'onion',
        'yellow onion': 'onion',
        'brown onion': 'onion',
        'spanish onion': 'onion',
        
        # Tomato variations
        'cherry tomato': 'tomato',
        'roma tomato': 'tomato',
        'plum tomato': 'tomato',
        'beef tomato': 'tomato',
        'vine tomato': 'tomato',
        
        # Rice variations
        'white rice': 'rice',
        'brown rice': 'rice',
        'jasmine rice': 'rice',
        'basmati rice': 'rice',
        'long grain rice': 'rice',
        
        # Oil variations
        'olive oil': 'oil',
        'vegetable oil': 'oil',
        'cooking oil': 'oil',
        'canola oil': 'oil',
        
        # Pepper variations
        'black pepper': 'pepper',
        'white pepper': 'pepper',
        'ground pepper': 'pepper',
        
        # Chili variations
        'dried chili': 'chili',
        'fresh chili': 'chili',
        'red chili': 'chili',
        'green chili': 'chili',
        'chili pepper': 'chili',
        'dried chili flakes': 'chili',
    }
    
    return normalizations.get(ingredient, ingredient)


# ============================================================
# FUZZY MATCHING FUNCTIONS
# ============================================================

def fuzzy_similarity(str1, str2):
    """
    Calculate similarity between two strings using SequenceMatcher.
    
    Args:
        str1: First string
        str2: Second string
        
    Returns:
        Similarity score (0.0 to 1.0)
    """
    return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()


def fuzzy_match(ingredient, recipe_ingredient, threshold=0.85):
    """
    Check if two ingredients match using fuzzy string matching.
    
    Args:
        ingredient: User ingredient
        recipe_ingredient: Recipe ingredient
        threshold: Minimum similarity score (default 0.85 = 85%)
        
    Returns:
        True if ingredients are similar enough, False otherwise
    """
    similarity = fuzzy_similarity(ingredient, recipe_ingredient)
    return similarity >= threshold


# ============================================================
# MATCHER 1: EXACT MATCHING (Baseline)
# ============================================================

def calculate_match_exact(user_ingredients, recipe_ingredients):
    """
    Basic exact string matching (case-insensitive).
    Baseline matcher for comparison.
    """
    user_set = set(ing.lower().strip() for ing in user_ingredients)
    recipe_names = [ing['name'].lower().strip() for ing in recipe_ingredients]
    recipe_set = set(recipe_names)
    
    matched = user_set.intersection(recipe_set)
    missing = recipe_set - user_set
    
    if len(recipe_set) == 0:
        match_percentage = 0
    else:
        match_percentage = (len(matched) / len(recipe_set)) * 100
    
    return {
        'match_percentage': round(match_percentage, 1),
        'matched_ingredients': list(matched),
        'missing_ingredients': list(missing),
        'total_required': len(recipe_set),
        'total_matched': len(matched)
    }


# ============================================================
# MATCHER 2: NORMALIZATION MATCHING (Your Main Approach)
# ============================================================

def calculate_match_normalized(user_ingredients, recipe_ingredients):
    """
    Ingredient matching with normalization.
    Handles common ingredient variations (e.g., 'chicken breast' → 'chicken').
    """
    # Normalize user ingredients
    user_set = set(normalize_ingredient(ing) for ing in user_ingredients)
    
    # Normalize recipe ingredients
    recipe_names = [normalize_ingredient(ing['name']) for ing in recipe_ingredients]
    recipe_set = set(recipe_names)
    
    # Find matches
    matched = user_set.intersection(recipe_set)
    missing = recipe_set - user_set
    
    # Calculate percentage
    if len(recipe_set) == 0:
        match_percentage = 0
    else:
        match_percentage = (len(matched) / len(recipe_set)) * 100
    
    return {
        'match_percentage': round(match_percentage, 1),
        'matched_ingredients': list(matched),
        'missing_ingredients': list(missing),
        'total_required': len(recipe_set),
        'total_matched': len(matched)
    }


# ============================================================
# MATCHER 3: FUZZY MATCHING
# ============================================================

def calculate_match_fuzzy(user_ingredients, recipe_ingredients, threshold=0.85):
    """
    Ingredient matching using fuzzy string similarity.
    Handles typos and slight variations.
    
    Args:
        user_ingredients: List of user ingredients
        recipe_ingredients: List of recipe ingredient dicts
        threshold: Similarity threshold (default 0.85 = 85% similar)
    """
    user_list = [ing.lower().strip() for ing in user_ingredients]
    recipe_list = [(ing['name'].lower().strip(), ing['name']) for ing in recipe_ingredients]
    
    matched = []
    missing = []
    
    for recipe_ing, original_name in recipe_list:
        found = False
        for user_ing in user_list:
            if fuzzy_match(user_ing, recipe_ing, threshold):
                matched.append(recipe_ing)
                found = True
                break
        
        if not found:
            missing.append(recipe_ing)
    
    # Calculate percentage
    total_required = len(recipe_list)
    if total_required == 0:
        match_percentage = 0
    else:
        match_percentage = (len(matched) / total_required) * 100
    
    return {
        'match_percentage': round(match_percentage, 1),
        'matched_ingredients': matched,
        'missing_ingredients': missing,
        'total_required': total_required,
        'total_matched': len(matched)
    }


# ============================================================
# MATCHER 4: HYBRID APPROACH (Normalization + Fuzzy)
# ============================================================

def calculate_match_hybrid(user_ingredients, recipe_ingredients, fuzzy_threshold=0.85):
    """
    Hybrid matching: Try normalization first, then fuzzy matching.
    Best of both worlds.
    
    Strategy:
    1. Normalize ingredients
    2. Try exact match on normalized
    3. If no match, try fuzzy matching
    """
    # Step 1: Normalize
    user_normalized = [normalize_ingredient(ing) for ing in user_ingredients]
    user_set = set(user_normalized)
    
    recipe_normalized = [(normalize_ingredient(ing['name']), ing['name']) 
                         for ing in recipe_ingredients]
    
    matched = []
    missing = []
    
    for norm_ing, original_name in recipe_normalized:
        # Try exact match on normalized
        if norm_ing in user_set:
            matched.append(norm_ing)
        else:
            # Try fuzzy match as fallback
            found = False
            for user_ing in user_normalized:
                if fuzzy_match(user_ing, norm_ing, fuzzy_threshold):
                    matched.append(norm_ing)
                    found = True
                    break
            
            if not found:
                missing.append(norm_ing)
    
    # Calculate percentage
    total_required = len(recipe_normalized)
    if total_required == 0:
        match_percentage = 0
    else:
        match_percentage = (len(matched) / total_required) * 100
    
    return {
        'match_percentage': round(match_percentage, 1),
        'matched_ingredients': matched,
        'missing_ingredients': missing,
        'total_required': total_required,
        'total_matched': len(matched)
    }


# ============================================================
# MAIN RECOMMENDATION FUNCTION
# ============================================================

def get_recipe_recommendations(user_ingredients, recipes, min_match=0, method='normalized'):
    """
    Get recipe recommendations based on ingredient matching.
    
    Args:
        user_ingredients: List of ingredients user has
        recipes: List of recipe objects
        min_match: Minimum match percentage to include (default: 0)
        method: Matching method to use
                'exact' - Basic exact matching
                'normalized' - With ingredient normalization (recommended)
                'fuzzy' - Fuzzy string matching
                'hybrid' - Combination of normalized + fuzzy
        
    Returns:
        List of recipes with match information, sorted by match percentage
    """
    # Select matching function based on method
    matchers = {
        'exact': calculate_match_exact,
        'normalized': calculate_match_normalized,
        'fuzzy': calculate_match_fuzzy,
        'hybrid': calculate_match_hybrid
    }
    
    if method not in matchers:
        raise ValueError(f"Invalid method '{method}'. Choose from: {list(matchers.keys())}")
    
    matcher_func = matchers[method]
    recommendations = []
    
    for recipe in recipes:
        match_info = matcher_func(user_ingredients, recipe['ingredients'])
        
        # Only include if meets minimum match threshold
        if match_info['match_percentage'] >= min_match:
            recommendation = {
                'id': recipe['id'],
                'name': recipe['name'],
                'cuisine': recipe['cuisine'],
                'dietary': recipe['dietary'],
                'difficulty': recipe.get('difficulty', 'medium'),
                'image': recipe.get('image', ''),
                'prepTime': recipe['prepTime'],
                'servings': recipe['servings'],
                'match_percentage': match_info['match_percentage'],
                'matched_ingredients': match_info['matched_ingredients'],
                'missing_ingredients': match_info['missing_ingredients'],
                'total_required': match_info['total_required'],
                'total_matched': match_info['total_matched'],
                'ingredients': recipe['ingredients'],
                'instructions': recipe['instructions'],
                'nutrition': recipe.get('nutrition')
            }
            recommendations.append(recommendation)
    
    # Sort by match percentage (highest first)
    recommendations.sort(key=lambda x: x['match_percentage'], reverse=True)
    
    return recommendations