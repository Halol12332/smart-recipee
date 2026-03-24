"""
Smart Recipee - Flask API
Main application file for recipe recommendation system.
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
import time
from werkzeug.utils import secure_filename

# Ingredient detection (YOLO) adapter
from utils.detector import detect_ingredients_from_image

# Import our custom modules
from utils.matcher import get_recipe_recommendations
from utils.filter import apply_all_filters, get_available_filter_options

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend integration

# Uploads (for ingredient detection)
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}


def _allowed_image(filename: str) -> bool:
    _, ext = os.path.splitext(filename.lower())
    return ext in ALLOWED_IMAGE_EXTS

# Load recipes from JSON file
RECIPES_FILE = os.path.join(os.path.dirname(__file__), 'data', 'recipes.json')

def load_recipes():
    """Load recipes from JSON file."""
    try:
        with open(RECIPES_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data['recipes']
    except FileNotFoundError:
        return []
    except json.JSONDecodeError:
        return []

# Load recipes at startup
recipes = load_recipes()

# ============================================================
# API ENDPOINTS
# ============================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint.
    Returns API status and number of recipes loaded.
    """
    return jsonify({
        'status': 'healthy',
        'message': 'Smart Recipee API is running',
        'recipes_loaded': len(recipes),
        'version': '1.0.0'
    }), 200


@app.route('/api/filters', methods=['GET'])
def get_filters():
    """
    Get available filter options from recipe database.
    
    Returns:
        JSON with available dietary options, cuisines, and time ranges
    """
    try:
        options = get_available_filter_options(recipes)
        return jsonify({
            'success': True,
            'data': options
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/recipe/<recipe_id>', methods=['GET'])
def get_recipe_by_id(recipe_id):
    """
    Get detailed information for a specific recipe.
    
    Args:
        recipe_id: Recipe ID (e.g., '001')
    
    Returns:
        JSON with complete recipe details
    """
    try:
        # Find recipe by ID
        recipe = next((r for r in recipes if r['id'] == recipe_id), None)
        
        if recipe:
            return jsonify({
                'success': True,
                'data': recipe
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': f'Recipe with ID {recipe_id} not found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/recommend', methods=['POST'])
def recommend_recipes():
    """
    Main recommendation endpoint.
    
    Request Body (JSON):
    {
        "ingredients": ["chicken", "rice", "egg"],
        "filters": {
            "dietary": ["vegetarian"],
            "time_category": "quick",
            "cuisines": ["Asian"],
            "max_prep_time": 30
        },
        "min_match": 20,
        "method": "normalized"
    }
    
    Returns:
        JSON with filtered and ranked recipe recommendations
    """
    try:
        # Parse request data
        data = request.get_json()
        
        # Validate required fields
        if not data or 'ingredients' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required field: ingredients'
            }), 400
        
        user_ingredients = data['ingredients']
        filters = data.get('filters', {})
        min_match = data.get('min_match', 0)
        method = data.get('method', 'normalized')
        
        # Validate ingredients is a list
        if not isinstance(user_ingredients, list):
            return jsonify({
                'success': False,
                'error': 'ingredients must be an array'
            }), 400
        
        # Validate min_match is a number
        if not isinstance(min_match, (int, float)):
            return jsonify({
                'success': False,
                'error': 'min_match must be a number'
            }), 400
        
        # Step 1: Get recipe recommendations using matcher
        recommendations = get_recipe_recommendations(
            user_ingredients,
            recipes,
            min_match=min_match,
            method=method
        )
        
        # Step 2: Apply filters if provided
        if filters:
            recommendations = apply_all_filters(recommendations, filters)
        
        # Step 3: Format response
        return jsonify({
            'success': True,
            'data': {
                'total_recipes': len(recommendations),
                'user_ingredients': user_ingredients,
                'filters_applied': filters,
                'matching_method': method,
                'recommendations': recommendations
            }
        }), 200
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': f'Invalid input: {str(e)}'
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500


@app.route('/api/detect', methods=['POST'])
def detect_ingredients():
    """Detect ingredients from an uploaded image.

    Expects multipart/form-data with field name: image

    Returns:
        JSON with detection output in the same structure browse.js expects.
    """
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'Missing file field: image'}), 400

        file = request.files['image']
        if not file or file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400

        if not _allowed_image(file.filename):
            return jsonify({'success': False, 'error': 'Unsupported image type (jpg/jpeg/png/webp only)'}), 400

        filename = secure_filename(file.filename)
        save_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(save_path)

        # Run detection
        result = detect_ingredients_from_image(save_path)

        if result.get('annotated_image'):
            result['annotated_image_url'] = f'http://127.0.0.1:5000/uploads/{result["annotated_image"]}'

        # NEW: Construct URLs for every cropped ingredient
        for ing in result.get('ingredients', []):
            if ing.get('crop_image'):
                ing['crop_image_url'] = f'http://127.0.0.1:5000/uploads/{ing["crop_image"]}'

        result['original_image_url'] = f'http://127.0.0.1:5000/uploads/{filename}'

        return jsonify({'success': True, 'data': result}), 200

    except FileNotFoundError as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': f'Server error: {str(e)}'}), 500


@app.route('/api/recipes', methods=['GET'])
def get_all_recipes():
    """
    Get all recipes (without matching).
    Optional query parameters for filtering.
    
    Query Parameters:
        - cuisine: Filter by cuisine type
        - dietary: Filter by dietary requirement
        - max_time: Maximum preparation time
    
    Returns:
        JSON with all recipes (optionally filtered)
    """
    try:
        result = recipes.copy()
        
        # Apply query parameter filters
        cuisine = request.args.get('cuisine')
        dietary = request.args.get('dietary')
        max_time = request.args.get('max_time', type=int)
        
        filters = {}
        if cuisine:
            filters['cuisines'] = [cuisine]
        if dietary:
            filters['dietary'] = [dietary]
        if max_time:
            filters['max_prep_time'] = max_time
        
        if filters:
            result = apply_all_filters(result, filters)
        
        return jsonify({
            'success': True,
            'data': {
                'total_recipes': len(result),
                'recipes': result
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/uploads/<path:filename>', methods=['GET'])
def serve_uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# ============================================================
# RATINGS ENDPOINTS
# ============================================================

RATINGS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'ratings.json')

def load_ratings():
    try:
        with open(RATINGS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"ratings": {}}

def save_ratings(data):
    with open(RATINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

@app.route('/api/ratings/<recipe_id>', methods=['GET'])
def get_ratings(recipe_id):
    try:
        data = load_ratings()
        recipe_ratings = data['ratings'].get(recipe_id, [])

        if not recipe_ratings:
            return jsonify({
                'success': True,
                'data': {
                    'recipe_id': recipe_id,
                    'average': 0,
                    'total': 0,
                    'ratings': []
                }
            }), 200

        average = sum(r['stars'] for r in recipe_ratings) / len(recipe_ratings)

        return jsonify({
            'success': True,
            'data': {
                'recipe_id': recipe_id,
                'average': round(average, 1),
                'total': len(recipe_ratings),
                'ratings': recipe_ratings
            }
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/ratings/<recipe_id>', methods=['POST'])
def submit_rating(recipe_id):
    try:
        body = request.get_json()

        stars = body.get('stars')
        comment = body.get('comment', '').strip()

        if not stars or not isinstance(stars, int) or stars < 1 or stars > 5:
            return jsonify({'success': False, 'error': 'stars must be an integer between 1 and 5'}), 400

        data = load_ratings()

        if recipe_id not in data['ratings']:
            data['ratings'][recipe_id] = []

        new_rating = {
            'stars': stars,
            'comment': comment,
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S')
        }

        data['ratings'][recipe_id].append(new_rating)
        save_ratings(data)

        recipe_ratings = data['ratings'][recipe_id]
        average = sum(r['stars'] for r in recipe_ratings) / len(recipe_ratings)

        return jsonify({
            'success': True,
            'data': {
                'recipe_id': recipe_id,
                'average': round(average, 1),
                'total': len(recipe_ratings),
                'new_rating': new_rating
            }
        }), 201

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================
# ERROR HANDLERS
# ============================================================

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({
        'success': False,
        'error': 'Endpoint not found'
    }), 404


@app.errorhandler(405)
def method_not_allowed(error):
    """Handle 405 errors."""
    return jsonify({
        'success': False,
        'error': 'Method not allowed'
    }), 405


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500


# ============================================================
# RUN APPLICATION
# ============================================================

if __name__ == '__main__':
    print("=" * 60)
    print("Smart Recipee API Starting...")
    print(f"Loaded {len(recipes)} recipes from database")
    print("API Documentation:")
    print("  GET  /api/health          - Health check")
    print("  GET  /api/filters         - Get filter options")
    print("  GET  /api/recipes         - Get all recipes")
    print("  GET  /api/recipe/<id>     - Get recipe by ID")
    print("  POST /api/recommend       - Get recommendations")
    print("=" * 60)
    
    # Run the Flask app
    app.run(
        debug=True,
        host='127.0.0.1',
        port=5000
    )
