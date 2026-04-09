/**
 * Smart Recipee - Add Custom Recipe
 */

const API_BASE_URL = 'http://127.0.0.1:5000/api';

let ingredientCount = 0;
let instructionCount = 0;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async function () {
    document.getElementById('addIngredientBtn')
        ?.addEventListener('click', addIngredientRow);
    document.getElementById('addInstructionBtn')
        ?.addEventListener('click', addInstructionRow);
    document.getElementById('submitRecipeBtn')
        ?.addEventListener('click', submitRecipe);

    // Check if editing an existing recipe
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    const fromChat = urlParams.get('from_chat');
    const prefillName = urlParams.get('name');

    if (editId) {
        await loadRecipeForEdit(editId);
    } else {
        addIngredientRow();
        addIngredientRow();
        addInstructionRow();
        addInstructionRow();

        // Pre-fill from chat if available
        if (fromChat) {
            const draft = sessionStorage.getItem('chatRecipeDraft');
            if (draft) {
                const parsed = JSON.parse(draft);
                sessionStorage.removeItem('chatRecipeDraft');

                // Pre-fill name
                if (parsed.name) {
                    const nameInput = document.getElementById('recipeName');
                    if (nameInput) nameInput.value = parsed.name;
                }

                // Pre-fill ingredients
                if (parsed.ingredients?.length) {
                    const ingList = document.getElementById('ingredientsList');
                    if (ingList) {
                        ingList.innerHTML = '';
                        ingredientCount = 0;
                        parsed.ingredients.forEach(() => addIngredientRow());
                        const rows = ingList.querySelectorAll('.ingredient-form-row');
                        parsed.ingredients.forEach((ing, i) => {
                            if (rows[i]) {
                                rows[i].querySelector('.ing-name').value = ing.name || '';
                                rows[i].querySelector('.ing-quantity').value = ing.quantity || '1';
                                const unitSelect = rows[i].querySelector('.ing-unit');
                                if (unitSelect) unitSelect.value = ing.unit || 'pieces';
                            }
                        });
                    }
                }

                // Pre-fill instructions
                if (parsed.instructions?.length) {
                    const insList = document.getElementById('instructionsList');
                    if (insList) {
                        insList.innerHTML = '';
                        instructionCount = 0;
                        parsed.instructions.forEach(() => addInstructionRow());
                        const rows = insList.querySelectorAll('.instruction-form-row');
                        parsed.instructions.forEach((ins, i) => {
                            if (rows[i]) {
                                rows[i].querySelector('.instruction-text').value = ins || '';
                            }
                        });
                    }
                }
            }

            // Show helpful banner
            const subtitle = document.querySelector('.add-recipe-subtitle');
            if (subtitle) {
                subtitle.textContent = 'Recipe pre-filled from your chat. Review the details and save.';
                subtitle.style.color = '#667eea';
                subtitle.style.fontWeight = '600';
            }
        }
    }
});

async function loadRecipeForEdit(recipeId) {
    try {
        const response = await fetch(`${API_BASE_URL}/recipe/${recipeId}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        const recipe = data.data;

        // Update page title
        const title = document.querySelector('.add-recipe-title');
        if (title) title.textContent = '✏️ Edit Recipe';
        const subtitle = document.querySelector('.add-recipe-subtitle');
        if (subtitle) subtitle.textContent = `Editing: ${recipe.name}`;

        // Update submit button
        const btn = document.getElementById('submitRecipeBtn');
        if (btn) btn.textContent = '💾 Save Changes';

        // Populate fields
        document.getElementById('recipeName').value = recipe.name || '';
        document.getElementById('recipeCuisine').value = recipe.cuisine || '';
        document.getElementById('recipeDifficulty').value = recipe.difficulty || '';
        document.getElementById('recipePrepTime').value = recipe.prepTime || '';
        document.getElementById('recipeServings').value = recipe.servings || '';

        // Dietary checkboxes
        document.querySelectorAll('.dietary-checkboxes input').forEach(cb => {
            cb.checked = (recipe.dietary || []).includes(cb.value);
        });

        // Nutrition
        if (recipe.nutrition) {
            document.getElementById('nutritionCalories').value = recipe.nutrition.calories || '';
            document.getElementById('nutritionProtein').value = recipe.nutrition.protein || '';
            document.getElementById('nutritionCarbs').value = recipe.nutrition.carbohydrates || '';
            document.getElementById('nutritionFat').value = recipe.nutrition.fat || '';
            document.getElementById('nutritionFibre').value = recipe.nutrition.fibre || '';
        }

        // Ingredients
        const ingList = document.getElementById('ingredientsList');
        if (ingList) {
            ingList.innerHTML = '';
            (recipe.ingredients || []).forEach(() => addIngredientRow());
            const rows = ingList.querySelectorAll('.ingredient-form-row');
            (recipe.ingredients || []).forEach((ing, i) => {
                if (rows[i]) {
                    rows[i].querySelector('.ing-name').value = ing.name || '';
                    rows[i].querySelector('.ing-quantity').value = ing.quantity || '';
                    rows[i].querySelector('.ing-unit').value = ing.unit || 'g';
                }
            });
        }

        // Instructions
        const insList = document.getElementById('instructionsList');
        if (insList) {
            insList.innerHTML = '';
            (recipe.instructions || []).forEach(() => addInstructionRow());
            const rows = insList.querySelectorAll('.instruction-form-row');
            (recipe.instructions || []).forEach((ins, i) => {
                if (rows[i]) {
                    rows[i].querySelector('.instruction-text').value = ins || '';
                }
            });
        }

        // Store edit ID for submit
        window._editRecipeId = recipeId;

    } catch (error) {
        alert(`Failed to load recipe for editing: ${error.message}`);
    }
}

// ============================================
// INGREDIENT ROWS
// ============================================

function addIngredientRow() {
    const list = document.getElementById('ingredientsList');
    if (!list) return;

    ingredientCount++;
    const row = document.createElement('div');
    row.className = 'ingredient-form-row';
    row.dataset.id = ingredientCount;

    row.innerHTML = `
        <input type="text" class="ing-name" placeholder="Ingredient name (e.g. chicken)" autocomplete="off">
        <input type="text" class="ing-quantity" placeholder="Qty (e.g. 500)">
        <select class="ing-unit">
            <option value="g">g</option>
            <option value="kg">kg</option>
            <option value="ml">ml</option>
            <option value="l">l</option>
            <option value="cups">cups</option>
            <option value="cup">cup</option>
            <option value="tbsp">tbsp</option>
            <option value="tsp">tsp</option>
            <option value="pieces">pieces</option>
            <option value="cloves">cloves</option>
            <option value="stalks">stalks</option>
            <option value="leaves">leaves</option>
        </select>
        <button type="button" class="btn-remove-row" onclick="removeRow(this)">✕</button>
    `;

    list.appendChild(row);
}

// ============================================
// INSTRUCTION ROWS
// ============================================

function addInstructionRow() {
    const list = document.getElementById('instructionsList');
    if (!list) return;

    instructionCount++;
    const row = document.createElement('div');
    row.className = 'instruction-form-row';
    row.dataset.id = instructionCount;

    const stepNum = list.children.length + 1;

    row.innerHTML = `
        <span class="step-num">${stepNum}</span>
        <textarea class="instruction-text" placeholder="Describe this cooking step..." rows="2"></textarea>
        <button type="button" class="btn-remove-row" onclick="removeRow(this, true)">✕</button>
    `;

    list.appendChild(row);
}

function removeRow(btn, reNumber = false) {
    const row = btn.closest('.ingredient-form-row, .instruction-form-row');
    if (!row) return;
    row.remove();

    if (reNumber) {
        const list = document.getElementById('instructionsList');
        list?.querySelectorAll('.step-num').forEach((span, i) => {
            span.textContent = i + 1;
        });
    }
}

// ============================================
// COLLECT FORM DATA
// ============================================

function collectIngredients() {
    const rows = document.querySelectorAll('.ingredient-form-row');
    const ingredients = [];

    rows.forEach(row => {
        const name = row.querySelector('.ing-name')?.value.trim();
        const quantity = row.querySelector('.ing-quantity')?.value.trim();
        const unit = row.querySelector('.ing-unit')?.value;

        if (name) {
            ingredients.push({ name, quantity: quantity || '1', unit: unit || 'g' });
        }
    });

    return ingredients;
}

function collectInstructions() {
    const rows = document.querySelectorAll('.instruction-form-row');
    const instructions = [];

    rows.forEach(row => {
        const text = row.querySelector('.instruction-text')?.value.trim();
        if (text) instructions.push(text);
    });

    return instructions;
}

function collectDietary() {
    const checked = document.querySelectorAll('.dietary-checkboxes input:checked');
    return Array.from(checked).map(cb => cb.value);
}

function collectNutrition() {
    const calories = document.getElementById('nutritionCalories')?.value;
    const protein = document.getElementById('nutritionProtein')?.value;
    const carbs = document.getElementById('nutritionCarbs')?.value;
    const fat = document.getElementById('nutritionFat')?.value;
    const fibre = document.getElementById('nutritionFibre')?.value;

    if (!calories && !protein && !carbs && !fat && !fibre) return null;

    return {
        calories: Number(calories) || 0,
        protein: Number(protein) || 0,
        carbohydrates: Number(carbs) || 0,
        fat: Number(fat) || 0,
        fibre: Number(fibre) || 0
    };
}

// ============================================
// VALIDATION
// ============================================

function validateForm(data) {
    if (!data.name) return 'Recipe name is required.';
    if (!data.cuisine) return 'Please select a cuisine.';
    if (!data.difficulty) return 'Please select a difficulty level.';
    if (!data.prepTime || data.prepTime < 1) return 'Prep time must be at least 1 minute.';
    if (!data.servings || data.servings < 1) return 'Servings must be at least 1.';
    if (data.dietary.length === 0) return 'Please select at least one dietary tag.';
    if (data.ingredients.length === 0) return 'Please add at least one ingredient.';
    if (data.instructions.length === 0) return 'Please add at least one cooking step.';
    return null;
}

// ============================================
// SUBMIT
// ============================================

async function submitRecipe() {
    const msg = document.getElementById('formMessage');
    const btn = document.getElementById('submitRecipeBtn');

    const recipeData = {
        name: document.getElementById('recipeName')?.value.trim(),
        cuisine: document.getElementById('recipeCuisine')?.value,
        difficulty: document.getElementById('recipeDifficulty')?.value,
        prepTime: Number(document.getElementById('recipePrepTime')?.value),
        servings: Number(document.getElementById('recipeServings')?.value),
        dietary: collectDietary(),
        nutrition: collectNutrition(),
        ingredients: collectIngredients(),
        instructions: collectInstructions()
    };

    // Validate
    const error = validateForm(recipeData);
    if (error) {
        if (msg) {
            msg.textContent = `⚠️ ${error}`;
            msg.style.color = '#c62828';
        }
        return;
    }

    if (btn) btn.disabled = true;
    if (msg) {
        msg.textContent = 'Saving recipe...';
        msg.style.color = '#667eea';
    }

    try {
        const isEdit = !!window._editRecipeId;
        const url = isEdit
            ? `${API_BASE_URL}/recipes/edit/${window._editRecipeId}`
            : `${API_BASE_URL}/recipes/add`;
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recipeData)
        });

        const data = await response.json();

        if (!data.success) throw new Error(data.error);

        // Upload image if one was selected
        const imageFile = document.getElementById('recipeImageFile')?.files?.[0];
        const recipeId = isEdit ? window._editRecipeId : data.data?.recipe?.id;
        if (imageFile && recipeId) {
            if (msg) {
                msg.textContent = 'Uploading image...';
                msg.style.color = '#667eea';
            }

            const formData = new FormData();
            formData.append('image', imageFile);

            try {
                const imgResponse = await fetch(
                    `${API_BASE_URL}/recipes/upload-image/${recipeId}`,
                    { method: 'POST', body: formData }
                );
                const imgData = await imgResponse.json();
                if (!imgData.success) throw new Error(imgData.error);
            } catch (imgError) {
                console.warn('Image upload failed:', imgError.message);
            }
        }

        if (msg) {
            msg.textContent = `✅ "${recipeData.name}" saved successfully! You can now find it in the recipe browser.`;
            msg.style.color = '#2e7d32';
        }

        // Reset form after 3 seconds
        setTimeout(() => {
            resetForm();
            if (msg) msg.textContent = '';
        }, 3000);

    } catch (error) {
        if (msg) {
            msg.textContent = `❌ Failed to save recipe: ${error.message}`;
            msg.style.color = '#c62828';
        }
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ============================================
// RESET FORM
// ============================================

function resetForm() {
    document.getElementById('recipeName').value = '';
    const imgInput = document.getElementById('recipeImageFile');
    if (imgInput) imgInput.value = '';
    document.getElementById('recipeCuisine').value = '';
    document.getElementById('recipeDifficulty').value = '';
    document.getElementById('recipePrepTime').value = '';
    document.getElementById('recipeServings').value = '';
    document.querySelectorAll('.dietary-checkboxes input').forEach(cb => cb.checked = false);
    ['nutritionCalories', 'nutritionProtein', 'nutritionCarbs',
     'nutritionFat', 'nutritionFibre'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const ingList = document.getElementById('ingredientsList');
    const insList = document.getElementById('instructionsList');
    if (ingList) ingList.innerHTML = '';
    if (insList) insList.innerHTML = '';

    ingredientCount = 0;
    instructionCount = 0;

    addIngredientRow();
    addIngredientRow();
    addInstructionRow();
    addInstructionRow();
}