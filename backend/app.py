"""
Smart Recipee - Flask API
Main application file for recipe recommendation system.
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
import time
import shutil # NEW: Needed for copying images to training folders
from werkzeug.utils import secure_filename

# Added from your friend's module for the Chatbot
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

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

# ============================================================
# NEW: ACTIVE LEARNING PIPELINE SETUP
# ============================================================
TRAINING_DIR = os.path.join(os.path.dirname(__file__), 'training_data')
for model_name in ['rt-detr', 'yolov8']:
    os.makedirs(os.path.join(TRAINING_DIR, model_name, 'images'), exist_ok=True)
    os.makedirs(os.path.join(TRAINING_DIR, model_name, 'labels'), exist_ok=True)

CLASSES_FILE = os.path.join(TRAINING_DIR, 'classes.txt')

# Hardcoded from your Roboflow data.yaml to ensure exact ID matching
YAML_CLASSES = [
    "anchovies", "apple", "bean_sprouts", "brocolli", "cabbage", "carrot",
    "chicken", "chili", "coconut_milk", "corn", "cucumber", "curry_leaves",
    "egg", "eggplant", "fish", "garlic", "ginger", "grape", "leafy_greens",
    "lemongrass", "lime", "onion", "orange", "pakchoy", "pandan_leaves",
    "potato", "spring_onion", "tempeh", "tofu", "tomato", "turmeric"
]

def get_class_id(class_name):
    """Retrieves the YOLO class ID, matching the data.yaml indices exactly."""
    class_name = class_name.lower().strip()
    
    # Strip "fresh " or "rotten " so Stage 1 bounding boxes only learn the base ingredient
    class_name = class_name.replace("fresh ", "").replace("rotten ", "").strip()

    classes = []
    # 1. If classes.txt doesn't exist, create it using your exact YAML list
    if not os.path.exists(CLASSES_FILE):
        classes = YAML_CLASSES.copy()
        with open(CLASSES_FILE, 'w') as f:
            f.write('\n'.join(classes))
    else:
        # Load existing classes
        with open(CLASSES_FILE, 'r') as f:
            classes = [line.strip() for line in f.readlines() if line.strip()]

    # 2. If the user annotates something entirely new, append it safely to the end
    if class_name not in classes:
        classes.append(class_name)
        with open(CLASSES_FILE, 'a') as f:
            f.write(f"\n{class_name}")
            
    return classes.index(class_name)

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

        # --- Safely extract names whether it's an object or string ---
        safe_ingredients = []
        for item in user_ingredients:
            if isinstance(item, dict) and 'name' in item:
                safe_ingredients.append(item['name'])
            elif isinstance(item, str):
                safe_ingredients.append(item)
                
        # Overwrite the original list with our safe strings
        user_ingredients = safe_ingredients
        # ------------------------------------------------------------------

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
    """Detect ingredients from an uploaded image."""
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'Missing file field: image'}), 400

        file = request.files['image']
        
        # NEW: Grab the model choice from the frontend (defaults to rt-detr)
        model_type = request.form.get('model_type', 'rt-detr')

        if not file or file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400

        if not _allowed_image(file.filename):
            return jsonify({'success': False, 'error': 'Unsupported image type (jpg/jpeg/png/webp only)'}), 400

        filename = secure_filename(file.filename)
        save_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(save_path)

        # Run detection (passing the model type to detector.py)
        result = detect_ingredients_from_image(save_path, model_type)

        if result.get('annotated_image'):
            result['annotated_image_url'] = f'http://127.0.0.1:5000/uploads/{result["annotated_image"]}'

        # Construct URLs for every cropped ingredient
        for ing in result.get('ingredients', []):
            if ing.get('crop_image'):
                ing['crop_image_url'] = f'http://127.0.0.1:5000/uploads/{ing["crop_image"]}'

        result['original_image_url'] = f'http://127.0.0.1:5000/uploads/{filename}'
        
        # NEW: Send the raw filename back so the frontend can reference it for annotation
        result['raw_filename'] = filename 

        return jsonify({'success': True, 'data': result}), 200

    except FileNotFoundError as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': f'Server error: {str(e)}'}), 500


# ============================================================
# NEW: ANNOTATE ENDPOINT
# ============================================================
@app.route('/api/annotate', methods=['POST'])
def save_annotation():
    """
    Receives user-corrected bounding boxes and saves them in YOLO format 
    to the designated training directory for future model fine-tuning.
    """
    try:
        data = request.get_json()
        filename = data.get('image')
        model_type = data.get('model_type', 'rt-detr')
        annotations = data.get('annotations', [])

        if not filename or not annotations:
            return jsonify({'success': False, 'error': 'Missing image or annotation data'}), 400

        source_img = os.path.join(UPLOAD_FOLDER, filename)
        if not os.path.exists(source_img):
            return jsonify({'success': False, 'error': 'Original uploaded image not found'}), 404

        # 1. Copy the original image to the training folder
        target_img = os.path.join(TRAINING_DIR, model_type, 'images', filename)
        shutil.copy(source_img, target_img)

        # 2. Write the YOLO format .txt label file
        txt_filename = os.path.splitext(filename)[0] + '.txt'
        target_txt = os.path.join(TRAINING_DIR, model_type, 'labels', txt_filename)

        with open(target_txt, 'w') as f:
            for ann in annotations:
                cid = get_class_id(ann['class_name'])
                # YOLO Format: class_id x_center y_center width height
                f.write(f"{cid} {ann['x_center']} {ann['y_center']} {ann['width']} {ann['height']}\n")

        return jsonify({'success': True, 'message': 'Correction saved successfully to training dataset!'}), 200

    except Exception as e:
        print(f"Annotation save error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/recipes', methods=['GET'])
def get_all_recipes():
    """
    Get all recipes (without matching).
    Optional query parameters for filtering.
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
# CHAT ENDPOINT (NEW MODULE)
# ============================================================

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        body = request.get_json()
        user_message = body.get('message', '').strip()
        ingredients = body.get('ingredients', [])
        recipes_context = body.get('recipes', [])
        
        # --- Safely extract names whether it's an object or string ---
        safe_ingredients = []
        for item in ingredients:
            if isinstance(item, dict) and 'name' in item:
                safe_ingredients.append(item['name'])
            elif isinstance(item, str):
                safe_ingredients.append(item)
        # ------------------------------------------------------------------
        
        history = body.get('history', [])

        if not user_message:
            return jsonify({'success': False, 'error': 'Message is required'}), 400

        recipe_context = ''
        if recipes_context:
            top_recipes = recipes_context[:5]
            recipe_context = 'Here are the top matched recipes for the user:\n\n'
            for r in top_recipes:
                recipe_context += f"- {r['name']} ({r['cuisine']}, {r['match_percentage']}% match)\n"
                recipe_context += f"  Ingredients: {', '.join(i['name'] for i in r.get('ingredients', []))}\n"
                recipe_context += f"  Instructions: {' | '.join(r.get('instructions', []))}\n\n"

        ingredient_context = ''
        if safe_ingredients:
            ingredient_context = f"The user currently has these ingredients: {', '.join(safe_ingredients)}.\n"

        system_prompt = f"""You are a friendly and knowledgeable Malaysian culinary assistant for Smart Recipee, a food waste reduction app.

Your role is to help users cook delicious Malaysian, Chinese and Indian recipes using the ingredients they already have in their fridge.

{ingredient_context}
{recipe_context}

Guidelines:
- Always base your recipe suggestions and cooking advice on the provided recipe database context above
- Be friendly, encouraging and conversational
- Keep responses concise and practical
- If asked about a recipe not in the context, you can still provide general cooking guidance
- Focus on reducing food waste — encourage users to use what they have
- If the user asks for step-by-step instructions, guide them through clearly
- You can suggest ingredient substitutions if they are missing something
- Respond in the same language the user writes in (English or Malay)

Remember: You are a sous-chef assistant, not a general chatbot. Keep conversations focused on cooking and food."""

        client = Groq(api_key=os.environ.get('GROQ_API_KEY'))

        # Build conversation history
        groq_history = [
            {'role': 'system', 'content': system_prompt}
        ]

        for msg in history:
            groq_history.append({
                'role': msg['role'] if msg['role'] == 'user' else 'assistant',
                'content': msg['content']
            })

        groq_history.append({
            'role': 'user',
            'content': user_message
        })

        response = client.chat.completions.create(
            model='llama-3.3-70b-versatile',
            messages=groq_history,
            temperature=0.7,
            max_tokens=1000
        )

        return jsonify({
            'success': True,
            'data': {
                'reply': response.choices[0].message.content
            }
        }), 200

    except Exception as e:
        print(f'Chat error: {e}')
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
    print("  GET  /api/health         - Health check")
    print("  GET  /api/filters        - Get filter options")
    print("  GET  /api/recipes        - Get all recipes")
    print("  GET  /api/recipe/<id>    - Get recipe by ID")
    print("  POST /api/recommend      - Get recommendations")
    print("  POST /api/detect         - Upload image for detection")
    print("  POST /api/annotate       - Active Learning feedback") # NEW
    print("  POST /api/chat           - Chat with AI assistant")
    print("=" * 60)
    
    # Run the Flask app
    app.run(
        debug=True,
        host='127.0.0.1',
        port=5000
    )
