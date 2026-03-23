/**
 * Smart Recipee - Weekly Meal Planner
 *
 * Algorithm: Weighted Scoring Function + Greedy Assignment
 * Supports: Lunch and Dinner slots per day
 *
 * final_score = (ingredient_score × 0.6)
 *             + (preference_score × 0.3)
 *             + (variety_score × 0.1)
 *
 * Lunch preference: lower calories (≤ limit), quicker prep time
 * Dinner preference: higher match percentage, richer dishes
 *
 * References:
 * - Cormen et al. (2009) Introduction to Algorithms - Greedy Algorithms
 * - Lops et al. (2011) Content-based Recommender Systems
 * - Hwang & Yoon (1981) Multiple Attribute Decision Making
 */

const API_BASE_URL = 'http://127.0.0.1:5000/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

let CURRENT_PLAN = {};
let ALL_SCORED_RECIPES = [];

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('generatePlanBtn')?.addEventListener('click', generatePlan);
    document.getElementById('clearPlanBtn')?.addEventListener('click', clearPlan);
    document.getElementById('printWeeklyListBtn')?.addEventListener('click', printWeeklyList);
    document.getElementById('downloadWeeklyListBtn')?.addEventListener('click', downloadWeeklyList);

    const saved = localStorage.getItem('weeklyMealPlan');
    if (saved) {
        CURRENT_PLAN = JSON.parse(saved);
        renderPlan(CURRENT_PLAN);
        renderWeeklyShoppingList(CURRENT_PLAN);
        document.getElementById('clearPlanBtn').style.display = 'inline-block';
    }
});

// ============================================
// FETCH RECIPES
// ============================================

async function fetchAllRecipes() {
    const storedIngredients = sessionStorage.getItem('confirmedIngredients')
        || sessionStorage.getItem('userIngredients');
    const ingredients = storedIngredients ? JSON.parse(storedIngredients) : [];

    const response = await fetch(`${API_BASE_URL}/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ingredients,
            method: 'normalized',
            min_match: 0,
            filters: {}
        })
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data.recommendations;
}

// ============================================
// WEIGHTED SCORING FUNCTION
// ============================================

function calculateScore(recipe) {
    const ingredient_score = recipe.match_percentage || 0;

    let preference_score = 0;
    const favourites = JSON.parse(localStorage.getItem('favourites') || '[]');
    const history = JSON.parse(localStorage.getItem('cookedHistory') || '[]');
    const personalRating = localStorage.getItem(`rating_${recipe.id}`);

    if (favourites.some(f => f.id === recipe.id)) preference_score += 100;
    if (history.some(h => h.id === recipe.id)) preference_score += 50;
    if (personalRating) {
        const parsed = JSON.parse(personalRating);
        preference_score += (parsed.stars / 5) * 50;
    }
    preference_score = Math.min(preference_score, 100);

    const variety_score = 50;

    const final_score = (ingredient_score * 0.6)
        + (preference_score * 0.3)
        + (variety_score * 0.1);

    return {
        ...recipe,
        ingredient_score: Math.round(ingredient_score),
        preference_score: Math.round(preference_score),
        final_score: Math.round(final_score * 10) / 10
    };
}

// ============================================
// GREEDY ASSIGNMENT — LUNCH + DINNER
// ============================================

function greedyAssign(scoredRecipes, lunchCalorieLimit, dinnerCalorieLimit) {
    // Lunch candidates — lighter, quicker
    let lunchCandidates = [...scoredRecipes]
        .filter(r => !lunchCalorieLimit || !r.nutrition || r.nutrition.calories <= lunchCalorieLimit)
        .sort((a, b) => {
            // For lunch: weight towards quicker prep and lower calories
            const aScore = a.final_score - (a.prepTime > 30 ? 5 : 0);
            const bScore = b.final_score - (b.prepTime > 30 ? 5 : 0);
            return bScore - aScore;
        });

    // Dinner candidates — richer, higher match
    let dinnerCandidates = [...scoredRecipes]
        .filter(r => !dinnerCalorieLimit || !r.nutrition || r.nutrition.calories <= dinnerCalorieLimit)
        .sort((a, b) => b.final_score - a.final_score);

    const plan = {};
    const usedLunchIds = new Set();
    const usedDinnerIds = new Set();

    for (const day of DAYS) {
        const prevDay = DAYS[DAYS.indexOf(day) - 1];
        const prevLunchCuisine = plan[prevDay]?.lunch?.cuisine || null;
        const prevDinnerCuisine = plan[prevDay]?.dinner?.cuisine || null;

        // Pick lunch — prefer different cuisine from previous lunch
        let lunch = lunchCandidates.find(r =>
            !usedLunchIds.has(r.id) &&
            !usedDinnerIds.has(r.id) &&
            r.cuisine !== prevLunchCuisine
        ) || lunchCandidates.find(r =>
            !usedLunchIds.has(r.id) &&
            !usedDinnerIds.has(r.id)
        ) || null;

        if (lunch) usedLunchIds.add(lunch.id);

        // Pick dinner — prefer different cuisine from lunch and previous dinner
        let dinner = dinnerCandidates.find(r =>
            !usedDinnerIds.has(r.id) &&
            !usedLunchIds.has(r.id) &&
            r.cuisine !== prevDinnerCuisine &&
            r.id !== lunch?.id
        ) || dinnerCandidates.find(r =>
            !usedDinnerIds.has(r.id) &&
            !usedLunchIds.has(r.id) &&
            r.id !== lunch?.id
        ) || null;

        if (dinner) usedDinnerIds.add(dinner.id);

        plan[day] = { lunch, dinner };
    }

    return plan;
}

// ============================================
// GENERATE PLAN
// ============================================

async function generatePlan() {
    const loading = document.getElementById('plannerLoading');
    const grid = document.getElementById('plannerGrid');
    const algoInfo = document.getElementById('algoInfo');

    const lunchLimit = document.getElementById('lunchCalorieFilter')?.value
        ? Number(document.getElementById('lunchCalorieFilter').value) : null;
    const dinnerLimit = document.getElementById('dinnerCalorieFilter')?.value
        ? Number(document.getElementById('dinnerCalorieFilter').value) : null;

    loading.style.display = 'block';
    grid.style.display = 'none';
    if (algoInfo) algoInfo.style.display = 'none';
    document.getElementById('weeklyShoppingSection').style.display = 'none';

    try {
        const recipes = await fetchAllRecipes();
        ALL_SCORED_RECIPES = recipes.map(calculateScore);
        CURRENT_PLAN = greedyAssign(ALL_SCORED_RECIPES, lunchLimit, dinnerLimit);

        localStorage.setItem('weeklyMealPlan', JSON.stringify(CURRENT_PLAN));

        renderPlan(CURRENT_PLAN);
        renderWeeklyShoppingList(CURRENT_PLAN);
        showAlgoInfo(ALL_SCORED_RECIPES, lunchLimit, dinnerLimit);

        document.getElementById('clearPlanBtn').style.display = 'inline-block';

    } catch (error) {
        console.error('Failed to generate plan:', error);
        alert('Failed to generate meal plan. Make sure the Flask server is running.');
    } finally {
        loading.style.display = 'none';
    }
}

// ============================================
// RENDER PLAN
// ============================================

function renderPlan(plan) {
    const grid = document.getElementById('plannerGrid');
    if (!grid) return;

    grid.innerHTML = '';
    grid.style.display = 'grid';

    for (const day of DAYS) {
        const { lunch, dinner } = plan[day] || {};
        const card = document.createElement('div');
        card.className = 'planner-day-card';

        card.innerHTML = `
            <div class="planner-day-label">${day}</div>
            <div class="planner-meal-slot">
                <div class="planner-meal-type lunch">🌤️ Lunch</div>
                ${renderMealSlot(lunch, day, 'lunch')}
            </div>
            <div class="planner-meal-slot">
                <div class="planner-meal-type dinner">🌙 Dinner</div>
                ${renderMealSlot(dinner, day, 'dinner')}
            </div>
        `;

        card.querySelectorAll('.btn-swap').forEach(btn => {
            btn.addEventListener('click', function () {
                openSwapModal(this.dataset.day, this.dataset.slot);
            });
        });

        grid.appendChild(card);
    }
}

function renderMealSlot(recipe, day, slot) {
    if (!recipe) {
        return `<div class="planner-slot-empty">No recipe available</div>`;
    }

    const matchClass = recipe.match_percentage >= 70 ? 'match-high'
        : recipe.match_percentage >= 40 ? 'match-medium' : 'match-low';

    return `
        <div class="planner-slot-content">
            ${recipe.image ? `<img src="${recipe.image}" alt="${escapeHtml(recipe.name)}" class="planner-slot-image">` : ''}
            <div class="planner-slot-body">
                <h4 class="planner-slot-name">${escapeHtml(recipe.name)}</h4>
                <p class="planner-slot-meta">🍽️ ${escapeHtml(recipe.cuisine)} | ⏱️ ${recipe.prepTime} min</p>
                <div class="planner-score-row">
                    <span class="match-badge ${matchClass}" style="font-size:0.75rem; padding:0.25rem 0.6rem;">
                        ⭐ ${recipe.match_percentage}%
                    </span>
                    ${recipe.nutrition ? `<span class="planner-calories">🔥 ${recipe.nutrition.calories} kcal</span>` : ''}
                </div>
                <div class="planner-score-breakdown">
                    <span title="Ingredient Score">🥗 ${recipe.ingredient_score}</span>
                    <span title="Preference Score">❤️ ${recipe.preference_score}</span>
                    <span title="Final Score">📊 ${recipe.final_score}</span>
                </div>
                <div class="planner-card-actions">
                    <a href="detail.html?id=${recipe.id}" class="btn-view-recipe" style="font-size:0.78rem; padding:0.4rem 0.8rem;">
                        View →
                    </a>
                    <button class="btn-swap" data-day="${day}" data-slot="${slot}" type="button">🔄 Swap</button>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// SWAP MODAL
// ============================================

function openSwapModal(day, slot) {
    document.getElementById('swapModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'swapModal';
    modal.className = 'swap-modal-overlay';

    const currentRecipe = CURRENT_PLAN[day]?.[slot];
    const usedIds = new Set();
    for (const d of DAYS) {
        if (CURRENT_PLAN[d]?.lunch) usedIds.add(CURRENT_PLAN[d].lunch.id);
        if (CURRENT_PLAN[d]?.dinner) usedIds.add(CURRENT_PLAN[d].dinner.id);
    }

    const alternatives = ALL_SCORED_RECIPES
        .filter(r => !usedIds.has(r.id) || currentRecipe?.id === r.id)
        .slice(0, 10);

    const slotLabel = slot === 'lunch' ? '🌤️ Lunch' : '🌙 Dinner';

    modal.innerHTML = `
        <div class="swap-modal">
            <div class="swap-modal-header">
                <h3>Swap ${day} ${slotLabel}</h3>
                <button class="swap-modal-close" type="button">✕</button>
            </div>
            <div class="swap-modal-list">
                ${alternatives.map(r => `
                    <div class="swap-option ${currentRecipe?.id === r.id ? 'swap-option-current' : ''}"
                         data-id="${r.id}" data-day="${day}" data-slot="${slot}">
                        <div class="swap-option-info">
                            <span class="swap-option-name">${escapeHtml(r.name)}</span>
                            <span class="swap-option-meta">
                                🍽️ ${escapeHtml(r.cuisine)} | ⭐ ${r.match_percentage}% | 📊 ${r.final_score}
                                ${r.nutrition ? ` | 🔥 ${r.nutrition.calories} kcal` : ''}
                            </span>
                        </div>
                        ${currentRecipe?.id === r.id
                            ? '<span class="swap-current-label">Current</span>'
                            : `<button class="btn-select-swap btn-primary" style="font-size:0.8rem; padding:0.4rem 0.8rem; white-space:nowrap;">Select</button>`
                        }
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    modal.querySelector('.swap-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    modal.querySelectorAll('.btn-select-swap').forEach(btn => {
        btn.addEventListener('click', function () {
            const option = this.closest('.swap-option');
            const recipeId = option.dataset.id;
            const targetDay = option.dataset.day;
            const targetSlot = option.dataset.slot;
            const newRecipe = ALL_SCORED_RECIPES.find(r => r.id === recipeId);

            if (newRecipe) {
                CURRENT_PLAN[targetDay][targetSlot] = newRecipe;
                localStorage.setItem('weeklyMealPlan', JSON.stringify(CURRENT_PLAN));
                renderPlan(CURRENT_PLAN);
                renderWeeklyShoppingList(CURRENT_PLAN);
            }
            modal.remove();
        });
    });

    document.body.appendChild(modal);
}

// ============================================
// WEEKLY SHOPPING LIST
// ============================================

function renderWeeklyShoppingList(plan) {
    const section = document.getElementById('weeklyShoppingSection');
    const container = document.getElementById('weeklyShoppingItems');
    if (!section || !container) return;

    const allMissing = new Set();
    for (const day of DAYS) {
        const { lunch, dinner } = plan[day] || {};
        [lunch, dinner].forEach(recipe => {
            if (!recipe) return;
            (recipe.missing_ingredients || []).forEach(ing => {
                allMissing.add(ing.toLowerCase().trim());
            });
        });
    }

    if (allMissing.size === 0) {
        container.innerHTML = '<p style="color:#2e7d32; font-weight:600;">✅ You have all ingredients for this week\'s meals!</p>';
    } else {
        container.innerHTML = '';
        allMissing.forEach(item => {
            const row = document.createElement('div');
            row.className = 'shopping-list-row';
            row.innerHTML = `<span class="shopping-list-item">${escapeHtml(item)}</span>`;
            container.appendChild(row);
        });
    }

    section.style.display = 'block';
}

function printWeeklyList() {
    const items = collectShoppingItems();
    if (!items.length) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Weekly Shopping List - Smart Recipee</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 2rem; }
                h1 { color: #333; margin-bottom: 0.5rem; }
                p { color: #666; margin-bottom: 1.5rem; }
                ul { list-style: none; padding: 0; }
                li { padding: 0.5rem 0; border-bottom: 1px solid #eee; font-size: 1.1rem; }
                li::before { content: "☐ "; }
            </style>
        </head>
        <body>
            <h1>🛒 Weekly Shopping List</h1>
            <p>Generated by Smart Recipee — Weekly Meal Planner</p>
            <ul>${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function downloadWeeklyList() {
    const items = collectShoppingItems();
    if (!items.length) return;

    const content = `Smart Recipee - Weekly Shopping List\n${'='.repeat(35)}\n\n`
        + items.map(i => `[ ] ${i}`).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'weekly-shopping-list.txt';
    a.click();
    URL.revokeObjectURL(url);
}

function collectShoppingItems() {
    const items = [];
    document.querySelectorAll('#weeklyShoppingItems .shopping-list-item').forEach(el => {
        items.push(el.textContent.trim());
    });
    return items;
}

// ============================================
// ALGO INFO
// ============================================

function showAlgoInfo(recipes, lunchLimit, dinnerLimit) {
    const algoInfo = document.getElementById('algoInfo');
    const algoText = document.getElementById('algoInfoText');
    if (!algoInfo || !algoText) return;

    const favCount = recipes.filter(r => r.preference_score >= 70).length;
    const lunchText = lunchLimit ? `Lunch capped at ${lunchLimit} kcal` : '';
    const dinnerText = dinnerLimit ? `Dinner capped at ${dinnerLimit} kcal` : '';
    const calorieText = [lunchText, dinnerText].filter(Boolean).join(' · ');

    algoText.innerHTML = `
        📊 <strong>How this plan was generated:</strong>
        Scored ${recipes.length} recipes using ingredient match (60%) + personal preferences (30%) + cuisine variety (10%).
        ${favCount > 0 ? `${favCount} recipe(s) boosted from your favourites or history.` : ''}
        Lighter, quicker recipes preferred for lunch. Greedy algorithm ensured no repeated cuisines on consecutive days.
        ${calorieText ? `<br>🔥 Calorie filters applied — ${calorieText}.` : ''}
    `;
    algoInfo.style.display = 'block';
}

// ============================================
// CLEAR PLAN
// ============================================

function clearPlan() {
    if (!confirm('Clear your current meal plan?')) return;
    CURRENT_PLAN = {};
    ALL_SCORED_RECIPES = [];
    localStorage.removeItem('weeklyMealPlan');

    document.getElementById('plannerGrid').style.display = 'none';
    document.getElementById('weeklyShoppingSection').style.display = 'none';
    document.getElementById('algoInfo').style.display = 'none';
    document.getElementById('clearPlanBtn').style.display = 'none';
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