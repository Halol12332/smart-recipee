/**
 * Smart Recipee - Recipe Detail Page JavaScript
 * Handles fetching and displaying individual recipe details
 */

// ============================================
// CONFIGURATION
// ============================================

const API_BASE_URL = 'http://127.0.0.1:5000/api';

// ============================================
// LOAD USER INGREDIENTS FROM SESSION
// ============================================

let USER_INGREDIENTS = [];

// Load from sessionStorage (set by browse.js)
function loadUserIngredients() {
    const stored = sessionStorage.getItem('userIngredients');
    if (stored) {
        USER_INGREDIENTS = JSON.parse(stored);
        console.log('Loaded user ingredients from session:', USER_INGREDIENTS);
    } else {
        // Fallback: try loading from detection file
        loadDetectedIngredients();
    }
}

// Fallback: Load from detection file
async function loadDetectedIngredients() {
    try {
        const response = await fetch('./detected_ingredients.json');
        if (!response.ok) throw new Error('No ingredients file');
        
        const data = await response.json();
        USER_INGREDIENTS = data.ingredients
            .filter(item => item.confidence >= 0.5)
            .map(item => item.name.toLowerCase().trim());
        
        console.log('Loaded ingredients from file:', USER_INGREDIENTS);
    } catch (error) {
        console.warn('Could not load ingredients:', error);
        USER_INGREDIENTS = [];
    }
}

// ============================================
// DOM ELEMENTS
// ============================================

const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const recipeDetail = document.getElementById('recipeDetail');

const recipeName = document.getElementById('recipeName');
const recipeCuisine = document.getElementById('recipeCuisine');
const recipePrepTime = document.getElementById('recipePrepTime');
const recipeServings = document.getElementById('recipeServings');
const recipeDietary = document.getElementById('recipeDietary');
const matchBadge = document.getElementById('matchBadge');
const ingredientsList = document.getElementById('ingredientsList');
const instructionsList = document.getElementById('instructionsList');

const recipeImage = document.getElementById('recipeImage');
// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Detail page loaded');
    
    // Load user ingredients first
    loadUserIngredients();
    
    // Wait a bit if loading from file
    if (USER_INGREDIENTS.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Get recipe ID from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const recipeId = urlParams.get('id');
    
    if (!recipeId) {
        showError('No recipe ID provided');
        return;
    }
    
    console.log('Fetching recipe with ID:', recipeId);
    
    // Fetch recipe details
    fetchRecipeDetails(recipeId);

    // Rating submit button
    const submitRatingBtn = document.getElementById('submitRatingBtn');
    if (submitRatingBtn) {
        submitRatingBtn.addEventListener('click', submitRating);
    }

    // Star input
    setupStarInput();
});

// ============================================
// FETCH RECIPE DETAILS (UPDATED TO USE RECOMMEND API)
// ============================================

async function fetchRecipeDetails(recipeId) {
    showLoading();
    
    try {
        // Use RECOMMEND endpoint to get matching data
        const payload = {
            // NEW: Extract the name before sending it to the server
            ingredients: USER_INGREDIENTS.map(item => item.name || item), 
            method: 'normalized',
            min_match: 0,
            filters: {}
        };
        
        console.log('Fetching with payload:', payload);
        
        const response = await fetch(`${API_BASE_URL}/recommend`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API response:', data);
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to load recipe');
        }
        
        // Find the specific recipe by ID
        const recipe = data.data.recommendations.find(r => r.id === recipeId);
        
        if (!recipe) {
            throw new Error('Recipe not found in recommendations');
        }
        
        console.log('Found recipe:', recipe);
        
        // Display recipe details with CORRECT matching data
        displayRecipeDetails(recipe);
        
    } catch (error) {
        console.error('Error fetching recipe:', error);
        showError(error.message);
    }
}

// ============================================
// DISPLAY RECIPE DETAILS
// ============================================

function displayRecipeDetails(recipe) {
    hideLoading();
    
    // Display recipe name
    recipeName.textContent = recipe.name;
    
    // Display recipe image
    if (recipe.image && recipeImage) {
        recipeImage.src = recipe.image;
        recipeImage.alt = recipe.name;
        recipeImage.style.display = 'block';
    }

    // Display metadata
    recipeCuisine.textContent = `🍽️ ${recipe.cuisine}`;
    recipePrepTime.textContent = `⏱️ ${recipe.prepTime} minutes`;
    recipeServings.textContent = `👥 ${recipe.servings} servings`;
    
    const recipeDifficulty = document.getElementById('recipeDifficulty');
    if (recipeDifficulty) {
        recipeDifficulty.textContent = `💪 ${recipe.difficulty || 'N/A'}`;
    }

    // Display dietary tags
    recipeDietary.innerHTML = '';
    recipe.dietary.forEach(tag => {
        const dietaryTag = document.createElement('span');
        dietaryTag.className = 'dietary-tag';
        dietaryTag.textContent = tag;
        recipeDietary.appendChild(dietaryTag);
    });
    
    // Display match badge (from backend calculation)
    displayMatchBadge(recipe.match_percentage, recipe.total_matched, recipe.total_required);
    
    // Display ingredients with status (from backend matching)
    displayIngredients(recipe.ingredients, recipe.matched_ingredients);
    
    // Display cooking instructions
    displayInstructions(recipe.instructions);

    // Display nutritional info
    displayNutrition(recipe.nutrition);

    // Load ratings
    loadRatings(recipe.id);

    // Setup favourites and cooked buttons
    setupFavouriteAndCooked(recipe);
    
    // Show recipe detail section
    recipeDetail.style.display = 'block';
}

// ============================================
// DISPLAY MATCH BADGE
// ============================================

function displayMatchBadge(percentage, matched, total) {
    let badgeClass = 'match-low';
    if (percentage >= 70) {
        badgeClass = 'match-high';
    } else if (percentage >= 40) {
        badgeClass = 'match-medium';
    }
    
    matchBadge.className = `match-badge-large ${badgeClass}`;
    matchBadge.textContent = `⭐ ${percentage}% Match`;
    
    // Add matched count info
    const matchInfo = document.createElement('div');
    matchInfo.style.fontSize = '0.9rem';
    matchInfo.style.marginTop = '0.5rem';
    matchInfo.textContent = `${matched}/${total} ingredients`;
    
    // Clear and update
    const parent = matchBadge.parentElement;
    const existingInfo = parent.querySelector('.match-info');
    if (existingInfo) existingInfo.remove();
    
    matchInfo.className = 'match-info';
    parent.appendChild(matchInfo);
}

// ============================================
// DISPLAY INGREDIENTS
// ============================================

function displayIngredients(ingredients, matchedIngredients) {
    ingredientsList.innerHTML = '';
    
    ingredients.forEach((ingredient) => {
        // Check if this ingredient is in the matched list
        const hasIngredient = matchedIngredients.some(matched => 
            matched.toLowerCase() === ingredient.name.toLowerCase()
        );
        
        const item = document.createElement('div');
        item.className = `ingredient-item ${hasIngredient ? 'has-ingredient' : 'missing-ingredient'}`;
        
        item.innerHTML = `
            <span class="ingredient-icon">${hasIngredient ? '✓' : '✗'}</span>
            <div class="ingredient-content">
                <span class="ingredient-name">${ingredient.name}</span>
                <span class="ingredient-quantity">
                    ${ingredient.quantity} ${ingredient.unit}
                </span>
            </div>
        `;
        
        ingredientsList.appendChild(item);
    });
}

// ============================================
// DISPLAY INSTRUCTIONS
// ============================================

function displayInstructions(instructions) {
    instructionsList.innerHTML = '';
    
    instructions.forEach((instruction, index) => {
        const li = document.createElement('li');
        li.textContent = instruction;
        instructionsList.appendChild(li);
    });
}

// ============================================
// DISPLAY NUTRITION
// ============================================

function displayNutrition(nutrition) {
    const nutritionSection = document.getElementById('nutritionSection');
    if (!nutritionSection) return;

    if (!nutrition) {
        nutritionSection.style.display = 'none';
        return;
    }

    document.getElementById('nutritionCalories').textContent = nutrition.calories ?? '—';
    document.getElementById('nutritionProtein').textContent = nutrition.protein ?? '—';
    document.getElementById('nutritionCarbs').textContent = nutrition.carbohydrates ?? '—';
    document.getElementById('nutritionFat').textContent = nutrition.fat ?? '—';
    document.getElementById('nutritionFibre').textContent = nutrition.fibre ?? '—';

    nutritionSection.style.display = 'block';
}

// ============================================
// NAVIGATION
// ============================================

function goBack() {
    window.location.href = 'browse.html';
}

// ============================================
// UI STATE MANAGEMENT
// ============================================

function showLoading() {
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (recipeDetail) recipeDetail.style.display = 'none';
    if (errorMessage) errorMessage.style.display = 'none';
}

function hideLoading() {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
}

function showError(message) {
    hideLoading();
    if (errorMessage) errorMessage.style.display = 'block';
    if (errorText) errorText.textContent = message || 'Failed to load recipe details';
    if (recipeDetail) recipeDetail.style.display = 'none';
}

// ============================================
// RATINGS
// ============================================

let selectedStars = 0;
let currentRecipeId = null;

function setupStarInput() {
    const stars = document.querySelectorAll('.star-input .star');
    stars.forEach(star => {
        star.addEventListener('mouseover', function () {
            highlightStars(Number(this.dataset.value));
        });
        star.addEventListener('mouseout', function () {
            highlightStars(selectedStars);
        });
        star.addEventListener('click', function () {
            selectedStars = Number(this.dataset.value);
            highlightStars(selectedStars);
            const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
            const text = document.getElementById('ratingSelectedText');
            if (text) text.textContent = `${selectedStars} star${selectedStars > 1 ? 's' : ''} — ${labels[selectedStars]}`;

            const stored = localStorage.getItem(`rating_${currentRecipeId}`);
            if (stored) {
                const msg = document.getElementById('ratingMessage');
                if (msg) msg.textContent = "You've already rated this recipe. Submitting will add another rating.";
            }
        });
    });
}

function highlightStars(count) {
    const stars = document.querySelectorAll('.star-input .star');
    stars.forEach(star => {
        const val = Number(star.dataset.value);
        star.classList.toggle('active', val <= count);
    });
}

function renderStarsDisplay(average, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.className = 'star-display';
        star.textContent = i <= Math.round(average) ? '★' : '☆';
        container.appendChild(star);
    }
}

async function loadRatings(recipeId) {
    currentRecipeId = recipeId;

    const stored = localStorage.getItem(`rating_${recipeId}`);
    if (stored) {
        const personal = JSON.parse(stored);
        selectedStars = personal.stars;
        highlightStars(selectedStars);
        const text = document.getElementById('ratingSelectedText');
        if (text) text.textContent = `Your previous rating: ${personal.stars} star${personal.stars > 1 ? 's' : ''}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/ratings/${recipeId}`);
        const data = await response.json();

        if (!data.success) return;

        const { average, total, ratings } = data.data;

        const avgEl = document.getElementById('ratingAverage');
        const totalEl = document.getElementById('ratingTotal');

        if (avgEl) avgEl.textContent = total > 0 ? average.toFixed(1) : '—';
        if (totalEl) totalEl.textContent = total > 0 ? `${total} rating${total > 1 ? 's' : ''}` : 'No ratings yet';

        renderStarsDisplay(average, 'ratingStarsDisplay');
        renderComments(ratings);

    } catch (error) {
        console.error('Failed to load ratings:', error);
    }
}

function renderComments(ratings) {
    const container = document.getElementById('ratingComments');
    const toggleBtn = document.getElementById('toggleReviewsBtn');
    if (!container) return;

    const withComments = ratings.filter(r => r.comment && r.comment.trim() !== '');

    if (withComments.length === 0) {
        container.innerHTML = '<p class="no-comments">No comments yet. Be the first to review!</p>';
        container.style.display = 'block';
        if (toggleBtn) toggleBtn.style.display = 'none';
        return;
    }

    container.innerHTML = '';
    withComments.slice().reverse().forEach(r => {
        const div = document.createElement('div');
        div.className = 'comment-item';

        const stars = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
        const date = r.timestamp ? new Date(r.timestamp).toLocaleDateString() : '';

        div.innerHTML = `
            <div class="comment-header">
                <span class="comment-stars">${stars}</span>
                <span class="comment-date">${date}</span>
            </div>
            ${r.comment ? `<p class="comment-text">${escapeHtml(r.comment)}</p>` : ''}
        `;
        container.appendChild(div);
    });

    if (toggleBtn) {
        toggleBtn.style.display = 'block';
        toggleBtn.textContent = `▼ Show Reviews (${withComments.length})`;
        toggleBtn.onclick = function () {
            const isVisible = container.style.display === 'block';
            container.style.display = isVisible ? 'none' : 'block';
            toggleBtn.textContent = isVisible
                ? `▼ Show Reviews (${withComments.length})`
                : `▲ Hide Reviews (${withComments.length})`;
        };
    }
}

async function submitRating() {
    if (selectedStars === 0) {
        const msg = document.getElementById('ratingMessage');
        if (msg) {
            msg.textContent = 'Please select a star rating first.';
            msg.style.color = '#c62828';
        }
        return;
    }

    const comment = document.getElementById('ratingComment')?.value.trim() || '';
    const submitBtn = document.getElementById('submitRatingBtn');
    const msg = document.getElementById('ratingMessage');

    if (submitBtn) submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/ratings/${currentRecipeId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stars: selectedStars, comment })
        });

        const data = await response.json();

        if (!data.success) throw new Error(data.error);

        localStorage.setItem(`rating_${currentRecipeId}`, JSON.stringify({
            stars: selectedStars,
            comment
        }));

        const { average, total } = data.data;
        const avgEl = document.getElementById('ratingAverage');
        const totalEl = document.getElementById('ratingTotal');
        if (avgEl) avgEl.textContent = average.toFixed(1);
        if (totalEl) totalEl.textContent = `${total} rating${total > 1 ? 's' : ''}`;
        renderStarsDisplay(average, 'ratingStarsDisplay');

        const commentEl = document.getElementById('ratingComment');
        if (commentEl) commentEl.value = '';

        await loadRatings(currentRecipeId);

        if (msg) {
            msg.textContent = '✅ Rating submitted! Thank you for your feedback.';
            msg.style.color = '#2e7d32';
        }

    } catch (error) {
        console.error('Failed to submit rating:', error);
        if (msg) {
            msg.textContent = 'Failed to submit rating. Please try again.';
            msg.style.color = '#c62828';
        }
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

// ============================================
// HELPERS
// ============================================

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================
// FAVOURITES & HISTORY
// ============================================

function setupFavouriteAndCooked(recipe) {
    const favBtn = document.getElementById('favouriteBtn');
    const cookedBtn = document.getElementById('cookedBtn');

    if (!favBtn || !cookedBtn) return;

    // Check if already favourited
    const favs = JSON.parse(localStorage.getItem('favourites') || '[]');
    const isFav = favs.some(f => f.id === recipe.id);
    favBtn.textContent = isFav ? '🤍 Favourited' : '♡ Add to Favourites';
    favBtn.classList.toggle('btn-favourite-active', isFav);

    // Check if already cooked
    const history = JSON.parse(localStorage.getItem('cookedHistory') || '[]');
    const isCooked = history.some(h => h.id === recipe.id);
    cookedBtn.textContent = isCooked ? '✅ Marked as Cooked' : '🍳 Mark as Cooked';

    favBtn.addEventListener('click', () => {
        const current = JSON.parse(localStorage.getItem('favourites') || '[]');
        const exists = current.some(f => f.id === recipe.id);

        if (exists) {
            const updated = current.filter(f => f.id !== recipe.id);
            localStorage.setItem('favourites', JSON.stringify(updated));
            favBtn.textContent = '♡ Add to Favourites';
            favBtn.classList.remove('btn-favourite-active');
        } else {
            current.push({ id: recipe.id, timestamp: new Date().toISOString() });
            localStorage.setItem('favourites', JSON.stringify(current));
            favBtn.textContent = '🤍 Favourited';
            favBtn.classList.add('btn-favourite-active');
        }
    });

    cookedBtn.addEventListener('click', () => {
        const current = JSON.parse(localStorage.getItem('cookedHistory') || '[]');
        const exists = current.some(h => h.id === recipe.id);

        if (exists) {
        const updated = current.filter(h => h.id !== recipe.id);
        localStorage.setItem('cookedHistory', JSON.stringify(updated));
        cookedBtn.textContent = '🍳 Mark as Cooked';
        } else {
        current.push({ id: recipe.id, timestamp: new Date().toISOString() });
        localStorage.setItem('cookedHistory', JSON.stringify(current));
        cookedBtn.textContent = '✅ Marked as Cooked';
        }
    });
}
