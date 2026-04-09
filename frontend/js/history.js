/**
 * Smart Recipee - History & Favourites Page
 */

const API_BASE_URL = 'http://127.0.0.1:5000/api';

// ============================================
// LOCALSTORAGE HELPERS
// ============================================

function getFavourites() {
    return JSON.parse(localStorage.getItem('favourites') || '[]');
}

function getHistory() {
    return JSON.parse(localStorage.getItem('cookedHistory') || '[]');
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    setupTabs();
    renderFavourites();
    renderHistory();

    document.getElementById('clearFavouritesBtn')?.addEventListener('click', () => {
        if (confirm('Clear all favourites?')) {
            localStorage.removeItem('favourites');
            renderFavourites();
        }
    });

    document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
        if (confirm('Clear all cooked history?')) {
            localStorage.removeItem('cookedHistory');
            renderHistory();
        }
    });
});

// ============================================
// TABS
// ============================================

function setupTabs() {
    const tabFavourites = document.getElementById('tabFavourites');
    const tabHistory = document.getElementById('tabHistory');
    const panelFavourites = document.getElementById('panelFavourites');
    const panelHistory = document.getElementById('panelHistory');

    tabFavourites.addEventListener('click', () => {
        tabFavourites.classList.add('active');
        tabHistory.classList.remove('active');
        panelFavourites.style.display = 'block';
        panelHistory.style.display = 'none';
    });

    tabHistory.addEventListener('click', () => {
        tabHistory.classList.add('active');
        tabFavourites.classList.remove('active');
        panelHistory.style.display = 'block';
        panelFavourites.style.display = 'none';
    });
}

// ============================================
// RENDER FAVOURITES
// ============================================

async function renderFavourites() {
    const container = document.getElementById('favouritesList');
    if (!container) return;

    const favourites = getFavourites();

    if (favourites.length === 0) {
        container.innerHTML = `
            <div class="history-empty">
                <p>💔 No favourites yet.</p>
                <p class="hint">Click "Add to Favourites" on any recipe detail page.</p>
                <a href="browse.html" class="btn-primary" style="display:inline-block; margin-top:1rem; text-decoration:none;">Browse Recipes</a>
            </div>`;
        return;
    }

    container.innerHTML = '';

    for (const item of favourites) {
        const card = await buildHistoryCard(item, 'favourite');
        if (card) container.appendChild(card);
    }
}

// ============================================
// RENDER HISTORY
// ============================================

async function renderHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;

    const history = getHistory();

    if (history.length === 0) {
        container.innerHTML = `
            <div class="history-empty">
                <p>🍳 No cooked recipes yet.</p>
                <p class="hint">Click "Mark as Cooked" on any recipe detail page.</p>
                <a href="browse.html" class="btn-primary" style="display:inline-block; margin-top:1rem; text-decoration:none;">Browse Recipes</a>
            </div>`;
        return;
    }

    container.innerHTML = '';

    for (const item of history) {
        const card = await buildHistoryCard(item, 'history');
        if (card) container.appendChild(card);
    }
}

// ============================================
// BUILD CARD
// ============================================

async function buildHistoryCard(item, type) {
    try {
        const response = await fetch(`${API_BASE_URL}/recipe/${item.id}`);
        const data = await response.json();
        if (!data.success) return null;

        const recipe = data.data;
        const card = document.createElement('div');
        card.className = 'history-card';

        const date = new Date(item.timestamp).toLocaleDateString();
        const label = type === 'favourite' ? '❤️ Saved' : '🍳 Cooked';

        card.innerHTML = `
            ${recipe.image ? `<img src="${recipe.image}" alt="${escapeHtml(recipe.name)}" class="history-card-image">` : ''}
            <div class="history-card-body">
                <h3 class="history-card-title">${escapeHtml(recipe.name)}</h3>
                <p class="history-card-meta">🍽️ ${escapeHtml(recipe.cuisine)} &nbsp;|&nbsp; ⏱️ ${recipe.prepTime} min &nbsp;|&nbsp; 💪 ${escapeHtml(recipe.difficulty || 'N/A')}</p>
                <p class="history-card-date">${label} on ${date}</p>
                <div class="history-card-actions">
                    <a href="detail.html?id=${recipe.id}" class="btn-view-recipe">View Recipe →</a>
                    <button class="btn-remove-small" data-id="${item.id}" data-type="${type}" type="button">Remove</button>
                </div>
            </div>
        `;

        card.querySelector('.btn-remove-small').addEventListener('click', function () {
            removeItem(this.dataset.id, this.dataset.type);
        });

        return card;

    } catch (e) {
        console.warn('Failed to load recipe', item.id, e);
        return null;
    }
}

// ============================================
// REMOVE ITEM
// ============================================

function removeItem(id, type) {
    if (type === 'favourite') {
        const favs = getFavourites().filter(f => f.id !== id);
        localStorage.setItem('favourites', JSON.stringify(favs));
        renderFavourites();
    } else {
        const hist = getHistory().filter(h => h.id !== id);
        localStorage.setItem('cookedHistory', JSON.stringify(hist));
        renderHistory();
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