/**
 * Smart Recipee - Recommendation & Shopping List Module
 * Author: Friend
 */

// ============================================
// GLOBAL STATE
// ============================================
var ALL_RECIPES = [];
var SHOPPING_LIST = [];

// ============================================
// DOM ELEMENTS
// ============================================
const recipeGrid = document.getElementById('recipeGrid');
const recipeCount = document.getElementById('recipeCount');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const noResults = document.getElementById('noResults');

const almostThereSection = document.getElementById('almostThereSection');
const almostThereGrid = document.getElementById('almostThereGrid');
const shoppingListSection = document.getElementById('shoppingListSection');
const shoppingListItems = document.getElementById('shoppingListItems');
const shoppingListInput = document.getElementById('shoppingListInput');

const dietaryFilter = document.getElementById('dietaryFilter');
const timeFilter = document.getElementById('timeFilter');
const cuisineFilter = document.getElementById('cuisineFilter');
const difficultyFilter = document.getElementById('difficultyFilter');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const recipeSearch = document.getElementById('recipeSearch');

const addShoppingItemBtn = document.getElementById('addShoppingItemBtn');
const printShoppingListBtn = document.getElementById('printShoppingListBtn');
const downloadShoppingListBtn = document.getElementById('downloadShoppingListBtn');
const clearShoppingListBtn = document.getElementById('clearShoppingListBtn');

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function () {
    if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', applyFilters);
    if (recipeSearch) recipeSearch.addEventListener('input', searchRecipes);
    if (addShoppingItemBtn) addShoppingItemBtn.addEventListener('click', addShoppingItem);
    if (printShoppingListBtn) printShoppingListBtn.addEventListener('click', printShoppingList);
    if (downloadShoppingListBtn) downloadShoppingListBtn.addEventListener('click', downloadShoppingList);
    if (clearShoppingListBtn) clearShoppingListBtn.addEventListener('click', clearShoppingList);

    if (shoppingListInput) {
        shoppingListInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); addShoppingItem(); }
        });
    }
});

// ============================================
// FETCH RECIPES
// ============================================
window.fetchRecipes = async function(filters = {}) {
    window.showLoading();
    try {
        const activeIngredients = window.CONFIRMED_INGREDIENTS.length > 0 
            ? window.CONFIRMED_INGREDIENTS 
            : window.USER_INGREDIENTS;

        const safeIngredients = activeIngredients
            .map(item => typeof item === 'string' ? item : item.name)
            .filter(name => !name.toLowerCase().includes('rotten'))
            .map(name => name.toLowerCase().replace('fresh ', '').trim());

        // Standard deduplication helper
        const dedupeIngredients = (items) => [...new Set(items)];

        const payload = { 
            ingredients: dedupeIngredients(safeIngredients), 
            method: 'normalized', 
            min_match: 0, 
            filters: filters 
        };

        const response = await fetch(`${window.API_BASE_URL}/recommend`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Unknown error');

        ALL_RECIPES = data.data.recommendations;
        displayAlmostThere(ALL_RECIPES);
        buildShoppingList(ALL_RECIPES);
        applySearchAndDisplay(ALL_RECIPES);
        loadCardRatings(ALL_RECIPES);
        window.hideLoading();
    } catch (error) {
        console.error('Error fetching recipes:', error);
        window.showError(error.message);
    }
};

// ============================================
// FILTERS & SEARCH
// ============================================
function applyFilters() {
    if (!window.CONFIRMED_INGREDIENTS.length) {
        alert('Confirm your ingredients first before applying recipe filters.');
        return;
    }
    const filters = {};
    if (dietaryFilter?.value) filters.dietary = [dietaryFilter.value];
    if (timeFilter?.value) filters.time_category = timeFilter.value;
    if (cuisineFilter?.value) filters.cuisines = [cuisineFilter.value];
    if (difficultyFilter?.value) filters.difficulty = difficultyFilter.value;
    window.fetchRecipes(filters);
}

function searchRecipes() { applySearchAndDisplay(ALL_RECIPES); }

function applySearchAndDisplay(recipes) {
    if (!recipeSearch || !recipeSearch.value.trim()) { displayRecipes(recipes); return; }
    const query = recipeSearch.value.trim().toLowerCase();
    const filtered = recipes.filter(recipe => {
        const nameMatch = recipe.name?.toLowerCase().includes(query);
        const cuisineMatch = recipe.cuisine?.toLowerCase().includes(query);
        const allIngredients = [...(recipe.matched_ingredients || []), ...(recipe.missing_ingredients || [])];
        const ingredientMatch = allIngredients.some(ing => ing.toLowerCase().includes(query));
        return nameMatch || cuisineMatch || ingredientMatch;
    });
    displayAlmostThere(filtered);
    displayRecipes(filtered);
}

// ============================================
// DISPLAY UI COMPONENTS
// ============================================
function displayRecipes(recipes) {
    if (!recipeGrid) return;
    recipeGrid.innerHTML = '';
    let filteredRecipes = recipes || [];
    const activeIngredients = window.CONFIRMED_INGREDIENTS.length > 0 ? window.CONFIRMED_INGREDIENTS : window.USER_INGREDIENTS;

    if (activeIngredients.length > 0) filteredRecipes = filteredRecipes.filter(r => r.match_percentage > 0);

    if (filteredRecipes.length === 0) {
        recipeGrid.innerHTML = '<p class="no-recipes">No recipes found matching your criteria.</p>';
        if (recipeCount) recipeCount.textContent = '0 recipes found';
        return;
    }
    filteredRecipes.forEach(recipe => recipeGrid.appendChild(createRecipeCard(recipe)));
    if (recipeCount) recipeCount.textContent = `${filteredRecipes.length} recipe${filteredRecipes.length !== 1 ? 's' : ''} found`;
}

function displayAlmostThere(recipes) {
    if (!almostThereSection || !almostThereGrid) return;
    const almostThereRecipes = recipes.filter(r => (r.missing_ingredients?.length || 0) === 1 || (r.missing_ingredients?.length || 0) === 2);

    if (almostThereRecipes.length === 0) { almostThereSection.style.display = 'none'; return; }
    almostThereGrid.innerHTML = '';
    
    almostThereRecipes.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'almost-there-card';
        card.innerHTML = `
            ${recipe.image ? `<img src="${recipe.image}" alt="${escapeRecipeHtml(recipe.name)}" class="almost-there-image">` : ''}
            <div class="almost-there-card-body">
                <h3 class="almost-there-recipe-name">${escapeRecipeHtml(recipe.name)}</h3>
                <p class="almost-there-cuisine">🍽️ ${escapeRecipeHtml(recipe.cuisine)}</p>
                <div class="almost-there-missing">
                    <p class="almost-there-missing-label">🛒 Buy ${recipe.missing_ingredients.length} more item${recipe.missing_ingredients.length > 1 ? 's' : ''}:</p>
                    <ul>${recipe.missing_ingredients.map(ing => `<li>${escapeRecipeHtml(ing)}</li>`).join('')}</ul>
                </div>
                <button class="btn-view-recipe" onclick="viewRecipe('${recipe.id}')">View Recipe →</button>
            </div>
        `;
        almostThereGrid.appendChild(card);
    });
    almostThereSection.style.display = 'block';
}

function createRecipeCard(recipe) {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    let matchClass = 'match-low';
    if (recipe.match_percentage >= 70) matchClass = 'match-high';
    else if (recipe.match_percentage >= 40) matchClass = 'match-medium';

    card.innerHTML = `
        ${recipe.image ? `<img src="${recipe.image}" alt="${escapeRecipeHtml(recipe.name)}" class="recipe-card-image">` : ''}
        <div class="recipe-card-header">
            <h3 class="recipe-card-title">${escapeRecipeHtml(recipe.name)}</h3>
            <div class="recipe-card-meta">
                <span>🍽️ ${escapeRecipeHtml(recipe.cuisine)}</span>
                <span>⏱️ ${escapeRecipeHtml(String(recipe.prepTime))} min</span>
                <span>👥 ${escapeRecipeHtml(String(recipe.servings))} servings</span>
                <span>💪 ${escapeRecipeHtml(recipe.difficulty || 'N/A')}</span>
            </div>
        </div>
        <div class="recipe-card-body">
            <div class="match-badge ${matchClass}">⭐ ${recipe.match_percentage}% Match</div>
            <div class="card-rating" id="card-rating-${recipe.id}">
                <span class="card-rating-stars">☆☆☆☆☆</span><span class="card-rating-count">No ratings</span>
            </div>
            
            <div class="recipe-info">
                <div class="info-row">
                    <span class="info-label">Matched Ingredients:</span>
                    <span class="info-value">${recipe.total_matched}/${recipe.total_required}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Dietary:</span>
                    <span class="info-value">${Array.isArray(recipe.dietary) ? recipe.dietary.join(', ') : ''}</span>
                </div>
                ${recipe.nutrition ? `
                <div class="info-row">
                    <span class="info-label">🔥 Calories:</span>
                    <span class="info-value">${recipe.nutrition.calories} kcal</span>
                </div>
                ` : ''}
            </div>

            ${recipe.matched_ingredients && recipe.matched_ingredients.length > 0 ? `
                <div class="matched-ingredients">
                    <h4>Matched Ingredients:</h4>
                    <ul>
                        ${recipe.matched_ingredients.slice(0, 3).map(ing => `<li>${escapeRecipeHtml(ing)}</li>`).join('')}
                        ${recipe.matched_ingredients.length > 3 ? `<li>+ ${recipe.matched_ingredients.length - 3} more...</li>` : ''}
                    </ul>
                </div>
            ` : ''}

            ${recipe.missing_ingredients && recipe.missing_ingredients.length > 0 ? `
                <div class="missing-ingredients">
                    <h4>Missing Ingredients:</h4>
                    <ul>
                        ${recipe.missing_ingredients.slice(0, 3).map(ing => `<li>${escapeRecipeHtml(ing)}</li>`).join('')}
                        ${recipe.missing_ingredients.length > 3 ? `<li>+ ${recipe.missing_ingredients.length - 3} more...</li>` : ''}
                    </ul>
                </div>
            ` : `
                <div style="color: #2e7d32; font-weight: 600; margin-top: 1rem;">
                    ✓ You have all ingredients!
                </div>
            `}
        </div>
        <div class="recipe-card-footer">
            <button class="btn-view-recipe" onclick="viewRecipe('${recipe.id}')">View Recipe →</button>
        </div>
    `;
    return card;
}

// ============================================
// SHOPPING LIST
// ============================================
function buildShoppingList(recipes) {
    const almostThereRecipes = recipes.filter(r => (r.missing_ingredients?.length || 0) === 1 || (r.missing_ingredients?.length || 0) === 2);
    const allMissing = [];
    almostThereRecipes.forEach(r => {
        (r.missing_ingredients || []).forEach(ing => {
            const n = String(ing || '').trim().toLowerCase().replace(/\s+/g, ' ');
            if (n && !allMissing.includes(n)) allMissing.push(n);
        });
    });
    SHOPPING_LIST = allMissing;
    renderShoppingList();
    if (shoppingListSection) shoppingListSection.style.display = SHOPPING_LIST.length > 0 ? 'block' : 'none';
}

function renderShoppingList() {
    if (!shoppingListItems) return;
    shoppingListItems.innerHTML = '';
    if (SHOPPING_LIST.length === 0) { shoppingListItems.innerHTML = '<p style="color: #999;">No items in your shopping list.</p>'; return; }
    SHOPPING_LIST.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'shopping-list-row';
        row.innerHTML = `<span class="shopping-list-item">${escapeRecipeHtml(item)}</span><button class="btn-remove-ingredient" data-index="${index}" type="button">Remove</button>`;
        shoppingListItems.appendChild(row);
    });
    shoppingListItems.querySelectorAll('.btn-remove-ingredient').forEach(btn => {
        btn.addEventListener('click', function () { SHOPPING_LIST.splice(Number(this.dataset.index), 1); renderShoppingList(); });
    });
}

function addShoppingItem() {
    if (!shoppingListInput) return;
    const value = String(shoppingListInput.value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!value || SHOPPING_LIST.includes(value)) { shoppingListInput.value = ''; return; }
    SHOPPING_LIST.push(value); shoppingListInput.value = ''; renderShoppingList();
}

function clearShoppingList() { SHOPPING_LIST = []; renderShoppingList(); if (shoppingListSection) shoppingListSection.style.display = 'none'; }

function printShoppingList() {
    if (SHOPPING_LIST.length === 0) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>Shopping List</title><style>body{font-family:Arial;padding:2rem;}h1{color:#333;}ul{list-style:none;padding:0;}li{padding:0.5rem 0;border-bottom:1px solid #eee;}li::before{content:"☐ ";}</style></head><body><h1>🛍️ Shopping List</h1><ul>${SHOPPING_LIST.map(item => `<li>${escapeRecipeHtml(item)}</li>`).join('')}</ul></body></html>`);
    printWindow.document.close(); printWindow.print();
}

function downloadShoppingList() {
    if (SHOPPING_LIST.length === 0) return;
    const content = `Smart Recipee - Shopping List\n${'='.repeat(30)}\n\n` + SHOPPING_LIST.map(item => `[ ] ${item}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'shopping-list.txt'; a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// HELPERS
// ============================================
window.viewRecipe = function(recipeId) {
    const ingredientsToStore = window.CONFIRMED_INGREDIENTS.length > 0 ? window.CONFIRMED_INGREDIENTS : window.USER_INGREDIENTS;
    sessionStorage.setItem('userIngredients', JSON.stringify(ingredientsToStore));
    sessionStorage.setItem('confirmedIngredients', JSON.stringify(window.CONFIRMED_INGREDIENTS));
    if (window.DETECTION_DATA) sessionStorage.setItem('detectionData', JSON.stringify(window.DETECTION_DATA));
    window.location.href = `detail.html?id=${recipeId}`;
};

window.resetRecipeArea = function() {
    ALL_RECIPES = [];
    if (recipeSearch) recipeSearch.value = '';
    if (almostThereSection) almostThereSection.style.display = 'none';
    if (shoppingListSection) shoppingListSection.style.display = 'none';
    SHOPPING_LIST = [];
    if (recipeGrid) { recipeGrid.innerHTML = ''; recipeGrid.style.display = 'none'; }
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (errorMessage) errorMessage.style.display = 'none';
    if (noResults) noResults.style.display = 'none';
    if (recipeCount) recipeCount.textContent = 'Waiting for ingredient confirmation...';
};

window.showLoading = function() {
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (recipeGrid) recipeGrid.style.display = 'none';
    if (errorMessage) errorMessage.style.display = 'none';
    if (noResults) noResults.style.display = 'none';
    if (recipeCount) recipeCount.textContent = 'Loading...';
};

window.hideLoading = function() {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (recipeGrid) recipeGrid.style.display = 'grid';
};

window.showError = function(message) {
    window.hideLoading();
    if (errorMessage) errorMessage.style.display = 'block';
    if (errorText) errorText.textContent = message || 'Failed to load recipes. Please try again.';
    if (recipeGrid) recipeGrid.style.display = 'none';
    if (noResults) noResults.style.display = 'none';
    if (recipeCount) recipeCount.textContent = 'Error';
};

async function loadCardRatings(recipes) {
    for (const recipe of recipes) {
        try {
            const response = await fetch(`${window.API_BASE_URL}/ratings/${recipe.id}`);
            const data = await response.json();
            if (!data.success) continue;
            const { average, total } = data.data;
            const container = document.getElementById(`card-rating-${recipe.id}`);
            if (!container) continue;
            if (total > 0) {
                const filled = Math.round(average);
                container.querySelector('.card-rating-stars').textContent = '★'.repeat(filled) + '☆'.repeat(5 - filled);
                container.querySelector('.card-rating-stars').style.color = '#f59e0b';
                container.querySelector('.card-rating-count').textContent = `${average.toFixed(1)} (${total})`;
            }
        } catch (e) {}
    }
}

function escapeRecipeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
