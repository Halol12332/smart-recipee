"""
Recipe Filtering Module
Filters recipe recommendations based on user preferences.
"""

def filter_by_dietary(recipes, dietary_preferences):
    """
    Filter recipes by dietary requirements.
    
    Args:
        recipes: List of recipe objects
        dietary_preferences: List of dietary requirements (e.g., ['vegetarian', 'halal'])
        
    Returns:
        List of recipes matching ALL dietary requirements
    """
    if not dietary_preferences:
        return recipes
    
    filtered = []
    for recipe in recipes:
        # Check if recipe meets ALL dietary requirements
        recipe_dietary = set(tag.lower() for tag in recipe.get('dietary', []))
        required_dietary = set(pref.lower() for pref in dietary_preferences)
        
        # Recipe must have all required dietary tags
        if required_dietary.issubset(recipe_dietary):
            filtered.append(recipe)
    
    return filtered


def filter_by_prep_time(recipes, max_prep_time=None, time_category=None):
    """
    Filter recipes by preparation time.
    
    Args:
        recipes: List of recipe objects
        max_prep_time: Maximum prep time in minutes (exact number)
        time_category: Time category ('quick', 'medium', 'long')
                      - 'quick': ≤20 minutes
                      - 'medium': 21-40 minutes
                      - 'long': >40 minutes
        
    Returns:
        List of recipes within time constraints
    """
    if not max_prep_time and not time_category:
        return recipes
    
    # Define time category ranges
    time_ranges = {
        'quick': (0, 30),
        'medium': (31, 60),
        'long': (60, float('inf'))
    }
    
    filtered = []
    for recipe in recipes:
        prep_time = recipe.get('prepTime', 0)
        
        # Filter by exact max time
        if max_prep_time is not None:
            if prep_time <= max_prep_time:
                filtered.append(recipe)
        
        # Filter by time category
        elif time_category:
            category = time_category.lower()
            if category in time_ranges:
                min_time, max_time = time_ranges[category]
                if min_time <= prep_time <= max_time:
                    filtered.append(recipe)
    
    return filtered


def filter_by_cuisine(recipes, cuisines):
    """
    Filter recipes by cuisine type.
    
    Args:
        recipes: List of recipe objects
        cuisines: List of cuisine types (e.g., ['Asian', 'Italian'])
        
    Returns:
        List of recipes matching ANY of the specified cuisines
    """
    if not cuisines:
        return recipes
    
    cuisines_lower = set(c.lower() for c in cuisines)
    
    filtered = []
    for recipe in recipes:
        recipe_cuisine = recipe.get('cuisine', '').lower()
        if recipe_cuisine in cuisines_lower:
            filtered.append(recipe)
    
    return filtered


def filter_by_difficulty(recipes, difficulty):
    """
    Filter recipes by difficulty level.
    
    Args:
        recipes: List of recipe objects
        difficulty: Difficulty level ('easy', 'medium', 'hard')
        
    Returns:
        List of recipes matching the difficulty level
    """
    if not difficulty:
        return recipes
    
    difficulty_lower = difficulty.lower()
    
    filtered = []
    for recipe in recipes:
        recipe_difficulty = recipe.get('difficulty', '').lower()
        if recipe_difficulty == difficulty_lower:
            filtered.append(recipe)
    
    return filtered


def apply_all_filters(recipes, filters):
    """
    Apply multiple filters to recipe list.
    
    Args:
        recipes: List of recipe objects
        filters: Dictionary containing filter criteria:
                {
                    'dietary': ['vegetarian', 'halal'],
                    'max_prep_time': 30,  # or use 'time_category'
                    'time_category': 'quick',  # 'quick', 'medium', 'long'
                    'cuisines': ['Asian', 'Western'],
                    'difficulty': 'easy'  # 'easy', 'medium', 'hard'
                }
    
    Returns:
        Filtered list of recipes
    """
    result = recipes
    
    # Apply dietary filter
    if 'dietary' in filters and filters['dietary']:
        result = filter_by_dietary(result, filters['dietary'])
    
    # Apply prep time filter
    if 'max_prep_time' in filters and filters['max_prep_time']:
        result = filter_by_prep_time(result, max_prep_time=filters['max_prep_time'])
    elif 'time_category' in filters and filters['time_category']:
        result = filter_by_prep_time(result, time_category=filters['time_category'])
    
    # Apply cuisine filter
    if 'cuisines' in filters and filters['cuisines']:
        result = filter_by_cuisine(result, filters['cuisines'])
    
    # Apply difficulty filter
    if 'difficulty' in filters and filters['difficulty']:
        result = filter_by_difficulty(result, filters['difficulty'])
    
    return result


def get_available_filter_options(recipes):
    """
    Extract all available filter options from recipe database.
    Useful for populating UI filter dropdowns.
    
    Args:
        recipes: List of recipe objects
        
    Returns:
        Dictionary with available options for each filter type
    """
    dietary_options = set()
    cuisines = set()
    difficulties = set()
    prep_times = []
    
    for recipe in recipes:
        # Collect dietary tags
        for tag in recipe.get('dietary', []):
            dietary_options.add(tag)
        
        # Collect cuisines
        if 'cuisine' in recipe:
            cuisines.add(recipe['cuisine'])
        
        # Collect difficulties
        if 'difficulty' in recipe:
            difficulties.add(recipe['difficulty'])
        
        # Collect prep times
        if 'prepTime' in recipe:
            prep_times.append(recipe['prepTime'])
    
    return {
        'dietary_options': sorted(list(dietary_options)),
        'cuisines': sorted(list(cuisines)),
        'difficulties': sorted(list(difficulties)),
        'min_prep_time': min(prep_times) if prep_times else 0,
        'max_prep_time': max(prep_times) if prep_times else 0,
        'time_categories': ['quick', 'medium', 'long']
    }