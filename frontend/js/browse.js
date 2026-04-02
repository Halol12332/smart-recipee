/**
 * Smart Recipee - Browse Page JavaScript
 * FR8: Confirm detected ingredients before recommendation
 * FR9: Edit ingredient list (remove wrong + add missing)
 */

const API_BASE_URL = 'http://127.0.0.1:5000/api';

// ============================================
// GLOBAL STATE
// ============================================

let USER_INGREDIENTS = [];
let CONFIRMED_INGREDIENTS = [];
let DETECTION_DATA = null;
let ALL_RECIPES = [];
let SHOPPING_LIST = [];

// NEW: Zoom state
let currentZoom = 1;
const ZOOM_STEP = 0.2;
const MAX_ZOOM = 3.0;
const MIN_ZOOM = 0.5;

// ============================================
// DOM ELEMENTS
// ============================================

const imageUpload = document.getElementById('imageUpload');
const detectBtn = document.getElementById('detectBtn');
const uploadStatus = document.getElementById('uploadStatus');

const ingredientsSection = document.getElementById('ingredientsSection');

const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomResetBtn = document.getElementById('zoomResetBtn');

const ingredientsList = document.getElementById('ingredientsList');
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
const addShoppingItemBtn = document.getElementById('addShoppingItemBtn');
const printShoppingListBtn = document.getElementById('printShoppingListBtn');
const downloadShoppingListBtn = document.getElementById('downloadShoppingListBtn');
const clearShoppingListBtn = document.getElementById('clearShoppingListBtn');

const dietaryFilter = document.getElementById('dietaryFilter');
const timeFilter = document.getElementById('timeFilter');
const cuisineFilter = document.getElementById('cuisineFilter');
const difficultyFilter = document.getElementById('difficultyFilter');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const recipeSearch = document.getElementById('recipeSearch');

const reviewSection = document.getElementById('reviewSection');
const reviewStatus = document.getElementById('reviewStatus');
const confirmBtn = document.getElementById('confirmBtn');
const editBtn = document.getElementById('editBtn');
const clearBtn = document.getElementById('clearBtn');

const editPanel = document.getElementById('editPanel');
const editableIngredientsList = document.getElementById('editableIngredientsList');
const manualIngredientInput = document.getElementById('manualIngredientInput');
const addIngredientBtn = document.getElementById('addIngredientBtn');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

const detectionPreview = document.getElementById('detectionPreview');
const annotatedPreviewImage = document.getElementById('annotatedPreviewImage');
const detectionSummary = document.getElementById('detectionSummary');

// Add this line with your other DOM element definitions near the top
const testIngredientsBtn = document.getElementById('testIngredientsBtn');

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    console.log('Browse page loaded');

    if (detectBtn) {
        detectBtn.addEventListener('click', detectFromUpload);
    }

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => applyZoom(ZOOM_STEP));
    }
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => applyZoom(-ZOOM_STEP));
    }
    if (zoomResetBtn) {
        zoomResetBtn.addEventListener('click', resetZoom);
    }
   
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmIngredients);
    }

    if (editBtn) {
        editBtn.addEventListener('click', openEditPanel);
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllDetectionState);
    }

    if (addIngredientBtn) {
        addIngredientBtn.addEventListener('click', addManualIngredient);
    }

    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', saveEdits);
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', closeEditPanel);
    }

    if (recipeSearch) {
        recipeSearch.addEventListener('input', searchRecipes);
    }

    if (addShoppingItemBtn) {
        addShoppingItemBtn.addEventListener('click', addShoppingItem);
    }

    if (shoppingListInput) {
        shoppingListInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addShoppingItem();
            }
        });
    }

    if (printShoppingListBtn) {
        printShoppingListBtn.addEventListener('click', printShoppingList);
    }

    if (downloadShoppingListBtn) {
        downloadShoppingListBtn.addEventListener('click', downloadShoppingList);
    }

    if (clearShoppingListBtn) {
        clearShoppingListBtn.addEventListener('click', clearShoppingList);
    }

    if (manualIngredientInput) {
        manualIngredientInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addManualIngredient();
            }
        });
    }
    
    // ============================================
    // MANUAL ENTRY FALLBACK (Use Test Ingredients Button)
    // ============================================
    const testIngredientsBtn = document.getElementById('testIngredientsBtn');
    
    if (testIngredientsBtn) {
        testIngredientsBtn.addEventListener('click', function() {
            console.log("Entering manual entry mode...");

            // 1. Clear old data completely
            USER_INGREDIENTS = [];
            CONFIRMED_INGREDIENTS = [];
            DETECTION_DATA = null;
            
            if (typeof persistDetectionState === 'function') {
                persistDetectionState();
            }

            // 2. Clear upload status and hide the preview image
            const uploadStatus = document.getElementById('uploadStatus');
            const detectionPreview = document.getElementById('detectionPreview');
            if (uploadStatus) uploadStatus.textContent = '';
            if (detectionPreview) detectionPreview.style.display = 'none';

            // 3. Unhide the ingredients section!
            const ingredientsSection = document.getElementById('ingredientsSection');
            const reviewStatus = document.getElementById('reviewStatus');
            
            if (ingredientsSection) ingredientsSection.style.display = 'block';
            if (reviewStatus) {
                reviewStatus.textContent = 'Adding ingredients manually. Type missing items below and click Add Item.';
                reviewStatus.style.color = '#333';
            }

            // 4. THE FIX: Call the correct function we built earlier!
            if (typeof displayIngredients === 'function') {
                displayIngredients(USER_INGREDIENTS);
            }

            // 5. Automatically focus the typing cursor for the user
            const manualIngredientInput = document.getElementById('manualIngredientInput');
            if (manualIngredientInput) {
                manualIngredientInput.scrollIntoView({ behavior: 'smooth' });
                manualIngredientInput.focus();
            }
        });
    }
    resetRecipeArea();
    restoreSavedState();
});

// ============================================
// DETECTION
// ============================================

async function detectFromUpload() {
    try {
        if (!imageUpload || !imageUpload.files || imageUpload.files.length === 0) {
            if (uploadStatus) uploadStatus.textContent = 'Pick an image first 😭';
            return;
        }

        resetDetectionFlow(false);

        const file = imageUpload.files[0];
        if (uploadStatus) uploadStatus.textContent = 'Detecting ingredients... 🔍';

        const form = new FormData();
        form.append('image', file);

        const response = await fetch(`${API_BASE_URL}/detect`, {
            method: 'POST',
            body: form
        });

        if (!response.ok) {
            throw new Error(`Detect API error: ${response.status}`);
        }

        const payload = await response.json();

        if (!payload.success) {
            throw new Error(payload.error || 'Detection failed');
        }

        DETECTION_DATA = payload.data;
        
        // NEW: Turn the detected list into OBJECTS for stable editing
        USER_INGREDIENTS = DETECTION_DATA.ingredients.map(ing => ({
            name: normalizeIngredient(ing.name),
            original_name: normalizeIngredient(ing.name),
            detection_id: ing.detection_id,
            count: ing.count || 1
        }));
        
        CONFIRMED_INGREDIENTS = [];
        persistDetectionState();

        if (uploadStatus) {
            uploadStatus.textContent = `Detected ${USER_INGREDIENTS.length} ingredient(s) ✅ Review before continuing.`;
        }

        if (DETECTION_DATA.flags && DETECTION_DATA.flags.length > 0) {
            displayDetectionWarnings(DETECTION_DATA.flags);
        } else {
            clearDetectionWarnings();
        }

        displayIngredients(USER_INGREDIENTS);
        showReviewSection();
        displayDetectionPreview(DETECTION_DATA);

    } catch (error) {
        console.error('Detection error:', error);
        if (uploadStatus) uploadStatus.textContent = `Detection failed: ${error.message}`;
        showError(error.message);
    }
}

function displayDetectionPreview(data) {
    if (!detectionPreview || !annotatedPreviewImage || !detectionSummary) return;

    if (!data || !data.annotated_image_url) {
        detectionPreview.style.display = 'none';
        return;
    }

    annotatedPreviewImage.src = data.annotated_image_url;
    annotatedPreviewImage.alt = 'Detected ingredients with bounding boxes';

    // 1. Completely empty the old list
    detectionSummary.innerHTML = ''; 
    
    // 2. NEW: Explicitly hide the container so it doesn't take up space on the screen
    detectionSummary.style.display = 'none';

    detectionPreview.style.display = 'block';
}

function extractIngredients(detectionData) {
    if (!detectionData || !Array.isArray(detectionData.ingredients)) {
        return [];
    }

    const ingredients = [];
    const threshold = detectionData.meta?.confidence_threshold || 0.5;

    detectionData.ingredients.forEach(item => {
        if (typeof item?.name !== 'string') return;

        if ((item.confidence ?? 0) >= threshold) {
            ingredients.push(normalizeIngredient(item.name));
        } else {
            console.log(`Skipped "${item.name}" - low confidence (${item.confidence})`);
        }
    });

    return dedupeIngredients(ingredients);
}

// ============================================
// STATE RESTORE / PERSIST
// ============================================

function persistDetectionState() {
    sessionStorage.setItem('userIngredients', JSON.stringify(USER_INGREDIENTS));
    sessionStorage.setItem('confirmedIngredients', JSON.stringify(CONFIRMED_INGREDIENTS));

    if (DETECTION_DATA) {
        sessionStorage.setItem('detectionData', JSON.stringify(DETECTION_DATA));
    } else {
        sessionStorage.removeItem('detectionData');
    }
}

function restoreSavedState() {
    try {
        const savedUser = sessionStorage.getItem('userIngredients');
        const savedConfirmed = sessionStorage.getItem('confirmedIngredients');
        const savedDetection = sessionStorage.getItem('detectionData');

        if (savedUser) {
            USER_INGREDIENTS = JSON.parse(savedUser) || [];
        }

        if (savedConfirmed) {
            CONFIRMED_INGREDIENTS = JSON.parse(savedConfirmed) || [];
        }

        if (savedDetection) {
            DETECTION_DATA = JSON.parse(savedDetection);
        }

        const ingredientsToShow = CONFIRMED_INGREDIENTS.length > 0
            ? CONFIRMED_INGREDIENTS
            : USER_INGREDIENTS;

        if (ingredientsToShow.length > 0) {
            displayIngredients(ingredientsToShow);

            // UPDATED: Unhide the new unified section instead of the old one
            if (typeof ingredientsSection !== 'undefined' && ingredientsSection) {
                ingredientsSection.style.display = 'block';
            }

            if (reviewStatus) {
                reviewStatus.textContent = CONFIRMED_INGREDIENTS.length > 0
                    ? `Restored ${CONFIRMED_INGREDIENTS.length} confirmed ingredient(s).`
                    : `Restored ${USER_INGREDIENTS.length} detected ingredient(s).`;
            }

            if (uploadStatus) {
                uploadStatus.textContent = 'Previous detection restored.';
            }
        }

        if (DETECTION_DATA) {
            displayDetectionPreview(DETECTION_DATA);

            if (DETECTION_DATA.flags && DETECTION_DATA.flags.length > 0) {
                displayDetectionWarnings(DETECTION_DATA.flags);
            }
        }

        // NEW: If you already confirmed ingredients before leaving the page, 
        // auto-fetch the recipes so you don't have to click "Confirm" again!
        if (CONFIRMED_INGREDIENTS.length > 0) {
            fetchRecipes();
        }

    } catch (error) {
        console.error('Failed to restore saved state:', error);
    }
}

// ============================================
// FR8 - CONFIRM INGREDIENTS
// ============================================

function showReviewSection() {
    if (ingredientsSection) {
        ingredientsSection.style.display = 'block';
    }

    if (reviewStatus) {
        reviewStatus.textContent = 'Review your detected ingredients. Change or remove items, then confirm to get recipes.';
    }

    resetRecipeArea();
}
function confirmIngredients() {
    if (!USER_INGREDIENTS || USER_INGREDIENTS.length === 0) {
        if (reviewStatus) reviewStatus.textContent = 'No ingredients to confirm yet.';
        return;
    }

    CONFIRMED_INGREDIENTS = [...USER_INGREDIENTS];
    persistDetectionState();

    if (reviewStatus) {
        // NEW: Add a clear, green success message!
        reviewStatus.innerHTML = `✅ <strong>Success! Confirmed ${CONFIRMED_INGREDIENTS.length} ingredient(s).</strong> Finding recipes...`;
        reviewStatus.style.color = '#2e7d32'; 
    }

    fetchRecipes();
}

// ============================================
// FR9 - EDIT INGREDIENT LIST
// ============================================

function openEditPanel() {
    if (!USER_INGREDIENTS || USER_INGREDIENTS.length === 0) {
        if (reviewStatus) {
            reviewStatus.textContent = 'Nothing to edit yet. Detect ingredients first.';
        }
        return;
    }

    renderEditableIngredients();

    if (editPanel) {
        editPanel.style.display = 'block';
    }

    if (reviewStatus) {
        reviewStatus.textContent = 'Edit the list: remove wrong detections or add missing ingredients.';
    }
}

function closeEditPanel() {
    if (editPanel) {
        editPanel.style.display = 'none';
    }

    if (manualIngredientInput) {
        manualIngredientInput.value = '';
    }
}

function renderEditableIngredients() {
    if (!editableIngredientsList) return;

    editableIngredientsList.innerHTML = '';

    if (!USER_INGREDIENTS.length) {
        editableIngredientsList.innerHTML = '<p class="empty-edit-note">No ingredients available.</p>';
        return;
    }

    USER_INGREDIENTS.forEach((ingredient, index) => {
        const item = document.createElement('div');
        item.className = 'editable-ingredient-item';

        // NEW: Add warning text and color in the edit panel
        const lowerIng = ingredient.toLowerCase();
        const displayName = lowerIng.includes('rotten') 
            ? `⚠️ ${escapeHtml(ingredient)} <span style="font-size:0.85em; color:#999;">(Will be skipped)</span>`
            : escapeHtml(ingredient);

        const textColor = lowerIng.includes('rotten') ? 'color: #c62828; font-weight: 500;' : '';

        item.innerHTML = `
            <span class="editable-ingredient-name" style="${textColor}">${displayName}</span>
            <button type="button" class="btn-remove-ingredient" data-index="${index}">
                Remove
            </button>
        `;

        editableIngredientsList.appendChild(item);
    });

    const removeButtons = editableIngredientsList.querySelectorAll('.btn-remove-ingredient');
    removeButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const index = Number(this.dataset.index);
            removeIngredient(index);
        });
    });
}

function removeIngredient(index) {
    if (index < 0 || index >= USER_INGREDIENTS.length) return;

    USER_INGREDIENTS.splice(index, 1);
    USER_INGREDIENTS = dedupeIngredients(USER_INGREDIENTS);

    persistDetectionState();
    displayIngredients(USER_INGREDIENTS);
    renderEditableIngredients();

    if (reviewStatus) {
        reviewStatus.textContent = 'Ingredient removed. Save edits when done.';
    }
}

function addManualIngredient() {
    if (!manualIngredientInput) return;

    const value = normalizeIngredient(manualIngredientInput.value);

    if (!value) {
        manualIngredientInput.focus();
        return;
    }

    // Deduplication check: Check names
    if (USER_INGREDIENTS.some(i => normalizeIngredient(i.name) === value)) {
        if (reviewStatus) {
            reviewStatus.textContent = `"${value}" is already in the ingredient list.`;
        }
        manualIngredientInput.value = '';
        return;
    }

    // NEW: Create a manual OBJECT. No det_id, so it will show a placeholder.
    USER_INGREDIENTS.push({
        name: value,
        original_name: value,
        detection_id: null, // No stable AI link for manual additions
        count: 1
    });

    // ... continue as normal ...
    manualIngredientInput.value = '';
    persistDetectionState();
    displayIngredients(USER_INGREDIENTS);

    if (reviewStatus) {
        reviewStatus.textContent = `"${value}" added. Save edits when done.`;
    }
}
function saveEdits() {
    USER_INGREDIENTS = dedupeIngredients(USER_INGREDIENTS);
    persistDetectionState();
    displayIngredients(USER_INGREDIENTS);
    closeEditPanel();

    if (reviewStatus) {
        reviewStatus.textContent = `Edits saved. Current ingredient count: ${USER_INGREDIENTS.length}. Confirm to continue.`;
    }
}

// ============================================
// DISPLAY INGREDIENTS (GRID VIEW WITH STABLE IDS)
// ============================================

function displayIngredients(ingredientObjects = []) {
    if (!ingredientsList) return;
    ingredientsList.innerHTML = '';

    if (ingredientObjects.length === 0) {
        ingredientsList.innerHTML = '<p style="color: #999;">No ingredients detected</p>';
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'ingredient-grid';

    ingredientObjects.forEach((ingObj, index) => {
        
        // NEW & CRITICAL: Search for the detection data BY ITS STABLE ID, NOT ITS NAME!
        const detItem = ingObj.detection_id 
            ? DETECTION_DATA?.ingredients?.find(d => d.detection_id === ingObj.detection_id)
            : null;
        
        const isRotten = ingObj.name.toLowerCase().includes('rotten');
        const imgHtml = detItem?.crop_image_url 
            ? `<img src="${detItem.crop_image_url}" class="ing-crop" alt="${ingObj.name}">` 
            : `<div class="ing-placeholder">🍽️</div>`;
            
        const isManual = !detItem; // If there's no det_id, it must be a manual add
        const confText = isManual ? 'Manually Added' : `${Math.round(detItem.confidence * 100)}% Confidence`;

        // Grab the count from the MUTABLE object (or use 1)
        const countText = (ingObj.count && ingObj.count > 1) ? ` <span style="color:#888; font-size:0.85em;">(x${ingObj.count})</span>` : '';

        const card = document.createElement('div');
        card.className = `ing-card ${isRotten ? 'rotten' : ''}`;

        card.innerHTML = `
            ${imgHtml}
            <div class="ing-name" style="${isRotten ? 'color: #c62828;' : ''}">
                ${isRotten ? '⚠️ ' : ''}${escapeHtml(ingObj.name)}${countText}
            </div>
            <div class="ing-conf">${confText}</div>
            <div class="ing-actions">
                <button class="ing-btn btn-change" onclick="changeIngredientGrid(${index})">Change</button>
                <button class="ing-btn btn-remove" onclick="removeIngredientGrid(${index})">Remove</button>
            </div>
        `;
        grid.appendChild(card);
    });

    ingredientsList.appendChild(grid);
}

// ============================================
// DETECTION WARNINGS
// ============================================

function displayDetectionWarnings(flags) {
    let warningContainer = document.getElementById('detectionWarnings');

    if (!warningContainer) {
        warningContainer = document.createElement('div');
        warningContainer.id = 'detectionWarnings';
        warningContainer.className = 'detection-warnings';

        const ingredientsSection = document.querySelector('.ingredients-section');
        if (ingredientsSection && ingredientsSection.parentNode) {
            ingredientsSection.parentNode.insertBefore(warningContainer, ingredientsSection);
        }
    }

    warningContainer.innerHTML = '';

    flags.forEach(flag => {
        const warning = document.createElement('div');
        warning.className = 'warning-item';
        warning.innerHTML = `
            <span class="warning-icon">⚠️</span>
            <div class="warning-content">
                <strong>${escapeHtml((flag.type || 'warning').replace('_', ' ').toUpperCase())}</strong>
                <p>${escapeHtml(flag.message || 'Detection warning')}</p>
                ${flag.count ? `<small>Count: ${flag.count} (${Math.round((flag.confidence || 0) * 100)}% confidence)</small>` : ''}
            </div>
        `;
        warningContainer.appendChild(warning);
    });
}

function clearDetectionWarnings() {
    const warningContainer = document.getElementById('detectionWarnings');
    if (warningContainer) {
        warningContainer.innerHTML = '';
    }
}

// ============================================
// FETCH RECIPES
// ============================================

async function fetchRecipes(filters = {}) {
    showLoading();

    try {
        const activeIngredients = CONFIRMED_INGREDIENTS.length > 0
            ? CONFIRMED_INGREDIENTS
            : USER_INGREDIENTS;

        // NEW: Handle objects correctly by extracting the '.name' property first
        const safeIngredients = activeIngredients
            .map(item => typeof item === 'string' ? item : item.name) // Failsafe extraction
            .filter(name => !name.toLowerCase().includes('rotten'))
            .map(name => name.toLowerCase().replace('fresh ', '').trim());

        const payload = {
            ingredients: dedupeIngredients(safeIngredients), 
            method: 'normalized',
            min_match: 0,
            filters: filters
        };

        console.log('Fetching recipes with clean payload:', payload);

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
            throw new Error(data.error || 'Unknown error');
        }

        ALL_RECIPES = data.data.recommendations;
        displayAlmostThere(ALL_RECIPES);
        buildShoppingList(ALL_RECIPES);
        applySearchAndDisplay(ALL_RECIPES);
        loadCardRatings(ALL_RECIPES);
        hideLoading();

    } catch (error) {
        console.error('Error fetching recipes:', error);
        showError(error.message);
    }
}

// ============================================
// FILTERS
// ============================================

function applyFilters() {
    if (!CONFIRMED_INGREDIENTS.length) {
        if (reviewStatus) {
            reviewStatus.textContent = 'Confirm your ingredients first before applying recipe filters.';
        }
        return;
    }

    const filters = {};

    const dietary = dietaryFilter?.value;
    if (dietary) {
        filters.dietary = [dietary];
    }

    const time = timeFilter?.value;
    if (time) {
        filters.time_category = time;
    }

    const cuisine = cuisineFilter?.value;
    if (cuisine) {
        filters.cuisines = [cuisine];
    }

    const difficulty = difficultyFilter?.value;
    if (difficulty) {
        filters.difficulty = difficulty;
    }

    console.log('Applying filters:', filters);
    fetchRecipes(filters);
}

// ============================================
// SEARCH
// ============================================

function searchRecipes() {
    applySearchAndDisplay(ALL_RECIPES);
}

function applySearchAndDisplay(recipes) {
    if (!recipeSearch || !recipeSearch.value.trim()) {
        displayRecipes(recipes);
        return;
    }

    const query = recipeSearch.value.trim().toLowerCase();

    const filtered = recipes.filter(recipe => {
        const nameMatch = recipe.name?.toLowerCase().includes(query);
        const cuisineMatch = recipe.cuisine?.toLowerCase().includes(query);

        const allIngredients = [
            ...(recipe.matched_ingredients || []),
            ...(recipe.missing_ingredients || [])
        ];
        const ingredientMatch = allIngredients.some(ing =>
            ing.toLowerCase().includes(query)
        );

        return nameMatch || cuisineMatch || ingredientMatch;
    });

    displayAlmostThere(filtered);
    displayRecipes(filtered);
}

// ============================================
// DISPLAY RECIPES
// ============================================

function displayRecipes(recipes) {
    if (!recipeGrid) return;

    recipeGrid.innerHTML = '';

    let filteredRecipes = recipes || [];

    const activeIngredients = CONFIRMED_INGREDIENTS.length > 0
        ? CONFIRMED_INGREDIENTS
        : USER_INGREDIENTS;

    if (activeIngredients.length > 0) {
        filteredRecipes = filteredRecipes.filter(recipe => recipe.match_percentage > 0);
    }

    if (filteredRecipes.length === 0) {
        recipeGrid.innerHTML = '<p class="no-recipes">No recipes found matching your criteria.</p>';
        if (recipeCount) recipeCount.textContent = '0 recipes found';
        return;
    }

    filteredRecipes.forEach(recipe => {
        const card = createRecipeCard(recipe);
        recipeGrid.appendChild(card);
    });

    if (recipeCount) {
        recipeCount.textContent = `${filteredRecipes.length} recipe${filteredRecipes.length !== 1 ? 's' : ''} found`;
    }
}

// ============================================
// ALMOST THERE
// ============================================

function displayAlmostThere(recipes) {
    if (!almostThereSection || !almostThereGrid) return;

    const almostThereRecipes = recipes.filter(recipe => {
        const missing = recipe.missing_ingredients?.length || 0;
        return missing === 1 || missing === 2;
    });

    if (almostThereRecipes.length === 0) {
        almostThereSection.style.display = 'none';
        return;
    }

    almostThereGrid.innerHTML = '';

    almostThereRecipes.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'almost-there-card';

        card.innerHTML = `
            ${recipe.image ? `<img src="${recipe.image}" alt="${escapeHtml(recipe.name)}" class="almost-there-image">` : ''}
            <div class="almost-there-card-body">
                <h3 class="almost-there-recipe-name">${escapeHtml(recipe.name)}</h3>
                <p class="almost-there-cuisine">🍽️ ${escapeHtml(recipe.cuisine)}</p>
                <div class="almost-there-missing">
                    <p class="almost-there-missing-label">
                        🛒 Buy ${recipe.missing_ingredients.length} more item${recipe.missing_ingredients.length > 1 ? 's' : ''}:
                    </p>
                    <ul>
                        ${recipe.missing_ingredients.map(ing => `<li>${escapeHtml(ing)}</li>`).join('')}
                    </ul>
                </div>
                <button class="btn-view-recipe" onclick="viewRecipe('${recipe.id}')">
                    View Recipe →
                </button>
            </div>
        `;

        almostThereGrid.appendChild(card);
    });

    almostThereSection.style.display = 'block';
}

// ============================================
// CARD RATINGS
// ============================================

async function loadCardRatings(recipes) {
    for (const recipe of recipes) {
        try {
            const response = await fetch(`${API_BASE_URL}/ratings/${recipe.id}`);
            const data = await response.json();
            if (!data.success) continue;

            const { average, total } = data.data;
            const container = document.getElementById(`card-rating-${recipe.id}`);
            if (!container) continue;

            const starsEl = container.querySelector('.card-rating-stars');
            const countEl = container.querySelector('.card-rating-count');

            if (total > 0) {
                const filled = Math.round(average);
                starsEl.textContent = '★'.repeat(filled) + '☆'.repeat(5 - filled);
                starsEl.style.color = '#f59e0b';
                countEl.textContent = `${average.toFixed(1)} (${total})`;
            }
        } catch (e) {
            console.warn(`Failed to load rating for recipe ${recipe.id}`);
        }
    }
}

// ============================================
// SHOPPING LIST
// ============================================

function buildShoppingList(recipes) {
    const almostThereRecipes = recipes.filter(recipe => {
        const missing = recipe.missing_ingredients?.length || 0;
        return missing === 1 || missing === 2;
    });

    const allMissing = [];
    almostThereRecipes.forEach(recipe => {
        (recipe.missing_ingredients || []).forEach(ing => {
            const normalized = normalizeIngredient(ing);
            if (normalized && !allMissing.includes(normalized)) {
                allMissing.push(normalized);
            }
        });
    });

    SHOPPING_LIST = allMissing;
    renderShoppingList();

    if (shoppingListSection) {
        shoppingListSection.style.display = SHOPPING_LIST.length > 0 ? 'block' : 'none';
    }
}

function renderShoppingList() {
    if (!shoppingListItems) return;

    shoppingListItems.innerHTML = '';

    if (SHOPPING_LIST.length === 0) {
        shoppingListItems.innerHTML = '<p style="color: #999;">No items in your shopping list.</p>';
        return;
    }

    SHOPPING_LIST.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'shopping-list-row';

        row.innerHTML = `
            <span class="shopping-list-item">${escapeHtml(item)}</span>
            <button class="btn-remove-ingredient" data-index="${index}" type="button">Remove</button>
        `;

        shoppingListItems.appendChild(row);
    });

    const removeButtons = shoppingListItems.querySelectorAll('.btn-remove-ingredient');
    removeButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const index = Number(this.dataset.index);
            SHOPPING_LIST.splice(index, 1);
            renderShoppingList();
        });
    });
}

function addShoppingItem() {
    if (!shoppingListInput) return;

    const value = normalizeIngredient(shoppingListInput.value);
    if (!value) return;

    if (SHOPPING_LIST.includes(value)) {
        shoppingListInput.value = '';
        return;
    }

    SHOPPING_LIST.push(value);
    shoppingListInput.value = '';
    renderShoppingList();
}

function printShoppingList() {
    if (SHOPPING_LIST.length === 0) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Shopping List - Smart Recipee</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 2rem; }
                h1 { color: #333; margin-bottom: 0.5rem; }
                p { color: #666; margin-bottom: 1.5rem; }
                ul { list-style: none; padding: 0; }
                li { padding: 0.5rem 0; border-bottom: 1px solid #eee; font-size: 1.1rem; }
                li::before { content: "☐ "; font-size: 1.2rem; }
            </style>
        </head>
        <body>
            <h1>🛍️ Shopping List</h1>
            <p>Generated by Smart Recipee</p>
            <ul>
                ${SHOPPING_LIST.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function downloadShoppingList() {
    if (SHOPPING_LIST.length === 0) return;

    const content = `Smart Recipee - Shopping List\n${'='.repeat(30)}\n\n` +
        SHOPPING_LIST.map(item => `[ ] ${item}`).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'shopping-list.txt';
    a.click();

    URL.revokeObjectURL(url);
}

function clearShoppingList() {
    SHOPPING_LIST = [];
    renderShoppingList();
    if (shoppingListSection) shoppingListSection.style.display = 'none';
}

function createRecipeCard(recipe) {
    const card = document.createElement('div');
    card.className = 'recipe-card';

    let matchClass = 'match-low';
    if (recipe.match_percentage >= 70) {
        matchClass = 'match-high';
    } else if (recipe.match_percentage >= 40) {
        matchClass = 'match-medium';
    }

    card.innerHTML = `
        ${recipe.image ? `<img src="${recipe.image}" alt="${escapeHtml(recipe.name)}" class="recipe-card-image">` : ''}
        <div class="recipe-card-header">
            <h3 class="recipe-card-title">${escapeHtml(recipe.name)}</h3>
            <div class="recipe-card-meta">
                <span>🍽️ ${escapeHtml(recipe.cuisine)}</span>
                <span>⏱️ ${escapeHtml(String(recipe.prepTime))} min</span>
                <span>👥 ${escapeHtml(String(recipe.servings))} servings</span>
                <span>💪 ${escapeHtml(recipe.difficulty || 'N/A')}</span>
            </div>
        </div>

        <div class="recipe-card-body">
            <div class="match-badge ${matchClass}">
                ⭐ ${recipe.match_percentage}% Match
            </div>
            <div class="card-rating" id="card-rating-${recipe.id}">
                <span class="card-rating-stars">☆☆☆☆☆</span>
                <span class="card-rating-count">No ratings</span>
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
                        ${recipe.matched_ingredients.slice(0, 3).map(ing => `<li>${escapeHtml(ing)}</li>`).join('')}
                        ${recipe.matched_ingredients.length > 3 ? `<li>+ ${recipe.matched_ingredients.length - 3} more...</li>` : ''}
                    </ul>
                </div>
            ` : ''}

            ${recipe.missing_ingredients && recipe.missing_ingredients.length > 0 ? `
                <div class="missing-ingredients">
                    <h4>Missing Ingredients:</h4>
                    <ul>
                        ${recipe.missing_ingredients.slice(0, 3).map(ing => `<li>${escapeHtml(ing)}</li>`).join('')}
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
            <button class="btn-view-recipe" onclick="viewRecipe('${recipe.id}')">
                View Recipe →
            </button>
        </div>
    `;

    return card;
}

// ============================================
// VIEW RECIPE
// ============================================

function viewRecipe(recipeId) {
    const ingredientsToStore = CONFIRMED_INGREDIENTS.length > 0
        ? CONFIRMED_INGREDIENTS
        : USER_INGREDIENTS;

    sessionStorage.setItem('userIngredients', JSON.stringify(ingredientsToStore));
    sessionStorage.setItem('confirmedIngredients', JSON.stringify(CONFIRMED_INGREDIENTS));

    if (DETECTION_DATA) {
        sessionStorage.setItem('detectionData', JSON.stringify(DETECTION_DATA));
    }

    window.location.href = `detail.html?id=${recipeId}`;
}

// ============================================
// UI STATE
// ============================================

function resetDetectionFlow(clearUploadStatus = true) {
    USER_INGREDIENTS = [];
    CONFIRMED_INGREDIENTS = [];
    DETECTION_DATA = null;

    displayIngredients([]);

    // Hide the unified section when resetting
    if (ingredientsSection) ingredientsSection.style.display = 'none'; 
    
    if (manualIngredientInput) manualIngredientInput.value = '';
    if (reviewStatus) reviewStatus.textContent = '';
    if (detectionPreview) detectionPreview.style.display = 'none';
    if (annotatedPreviewImage) annotatedPreviewImage.src = '';

    if (clearUploadStatus && uploadStatus) {
        uploadStatus.textContent = '';
    }

    clearDetectionWarnings();
    resetRecipeArea();
}

function clearAllDetectionState() {
    resetDetectionFlow(true);
    sessionStorage.removeItem('userIngredients');
    sessionStorage.removeItem('confirmedIngredients');
    sessionStorage.removeItem('detectionData');
}

function resetRecipeArea() {
    ALL_RECIPES = [];
    if (recipeSearch) recipeSearch.value = '';
    if (almostThereSection) almostThereSection.style.display = 'none';
    if (shoppingListSection) shoppingListSection.style.display = 'none';
    SHOPPING_LIST = [];
    if (recipeGrid) recipeGrid.innerHTML = '';
    if (recipeGrid) recipeGrid.style.display = 'none';
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (errorMessage) errorMessage.style.display = 'none';
    if (noResults) noResults.style.display = 'none';
    if (recipeCount) recipeCount.textContent = 'Waiting for ingredient confirmation...';
}

function showLoading() {
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (recipeGrid) recipeGrid.style.display = 'none';
    if (errorMessage) errorMessage.style.display = 'none';
    if (noResults) noResults.style.display = 'none';
    if (recipeCount) recipeCount.textContent = 'Loading...';
}

function hideLoading() {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (recipeGrid) recipeGrid.style.display = 'grid';
}

function showError(message) {
    hideLoading();
    if (errorMessage) errorMessage.style.display = 'block';
    if (errorText) errorText.textContent = message || 'Failed to load recipes. Please try again.';
    if (recipeGrid) recipeGrid.style.display = 'none';
    if (noResults) noResults.style.display = 'none';
    if (recipeCount) recipeCount.textContent = 'Error';
}

// ============================================
// HELPERS
// ============================================

function normalizeIngredient(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function dedupeIngredients(items) {
    const cleaned = items
        .map(normalizeIngredient)
        .filter(Boolean);

    return [...new Set(cleaned)];
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================
// IMAGE ZOOM HELPERS
// ============================================

function applyZoom(step) {
    currentZoom += step;
    
    // Enforce limits so the user doesn't zoom into infinity or shrink it to nothing
    if (currentZoom > MAX_ZOOM) currentZoom = MAX_ZOOM;
    if (currentZoom < MIN_ZOOM) currentZoom = MIN_ZOOM;
    
    updateZoomStyle();
}

function resetZoom() {
    currentZoom = 1;
    updateZoomStyle();
}

function updateZoomStyle() {
    if (annotatedPreviewImage) {
        annotatedPreviewImage.style.transform = `scale(${currentZoom})`;
    }
}

// ============================================
// DISPLAY INGREDIENTS (GRID VIEW WITH STABLE IDS)
// ============================================

function displayIngredients(ingredientObjects = []) {
    if (!ingredientsList) return;
    ingredientsList.innerHTML = '';

    if (ingredientObjects.length === 0) {
        ingredientsList.innerHTML = '<p style="color: #999;">No ingredients detected</p>';
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'ingredient-grid';

    ingredientObjects.forEach((ingObj, index) => {
        // Failsafe: if it's an old string from cache, convert it to an object temporarily
        if (typeof ingObj === 'string') {
            ingObj = { name: ingObj, detection_id: null, count: 1 };
        }

        const detItem = ingObj.detection_id 
            ? DETECTION_DATA?.ingredients?.find(d => d.detection_id === ingObj.detection_id)
            : null;
        
        const isRotten = ingObj.name.toLowerCase().includes('rotten');
        const imgHtml = detItem?.crop_image_url 
            ? `<img src="${detItem.crop_image_url}" class="ing-crop" alt="${ingObj.name}">` 
            : `<div class="ing-placeholder">🍽️</div>`;
            
        const isManual = !detItem; 
        const confText = isManual ? 'Manually Added' : `${Math.round(detItem.confidence * 100)}% Confidence`;

        const countText = (ingObj.count && ingObj.count > 1) ? ` <span style="color:#888; font-size:0.85em;">(x${ingObj.count})</span>` : '';

        const card = document.createElement('div');
        card.className = `ing-card ${isRotten ? 'rotten' : ''}`;

        card.innerHTML = `
            ${imgHtml}
            <div class="ing-name" style="${isRotten ? 'color: #c62828;' : ''}">
                ${isRotten ? '⚠️ ' : ''}${escapeHtml(ingObj.name)}${countText}
            </div>
            <div class="ing-conf">${confText}</div>
            <div class="ing-actions">
                <button class="ing-btn btn-change" onclick="changeIngredientGrid(${index})">Change</button>
                <button class="ing-btn btn-remove" onclick="removeIngredientGrid(${index})">Remove</button>
            </div>
        `;
        grid.appendChild(card);
    });

    ingredientsList.appendChild(grid);
}

// Helper function to handle inline changes
window.changeIngredientGrid = function(index) {
    const ingObj = USER_INGREDIENTS[index];
    const oldName = ingObj.name;
    const newName = prompt(`Change "${oldName}" to:`, oldName);
    
    if (newName && newName.trim() !== "" && newName.trim() !== oldName) {
        const normalized = normalizeIngredient(newName);
        
        // Deduplication check: Check names, not IDs
        if (USER_INGREDIENTS.some(i => normalizeIngredient(i.name) === normalized)) {
            alert(`"${normalized}" is already in the list!`);
        } else {
            // NEW: Update ONLY THE NAME on that specific object.
            // Crucially, ingObj.detection_id stays the SAME.
            ingObj.name = normalized; 
            
            persistDetectionState();
            displayIngredients(USER_INGREDIENTS);
            
            if (reviewStatus) reviewStatus.textContent = `Changed "${oldName}" to "${normalized}". Image link preserved.`;
        }
    }
};

// Helper function to handle direct removal from the grid
window.removeIngredientGrid = function(index) {
    const ingObj = USER_INGREDIENTS[index];
    USER_INGREDIENTS.splice(index, 1);
    persistDetectionState();
    displayIngredients(USER_INGREDIENTS);
    
    if (reviewStatus) reviewStatus.textContent = `"${ingObj.name}" removed.`;
};
