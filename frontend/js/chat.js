/**
 * Smart Recipee - Culinary Assistant Chat
 * Powered by Groq API (Llama 3.3 70B)
 */

const API_BASE_URL = 'http://127.0.0.1:5000/api';

let conversationHistory = [];
let userIngredients = [];
let topRecipes = [];

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async function () {
    loadContext();
    setupInput();
    setupSuggestions();
    showWelcomeMessage();
});

function loadContext() {
    // Load ingredients from sessionStorage
    const stored = sessionStorage.getItem('confirmedIngredients')
        || sessionStorage.getItem('userIngredients');

    if (stored) {
        userIngredients = JSON.parse(stored);
        renderContextBar(userIngredients);
        fetchTopRecipes();
    }
}

async function fetchTopRecipes() {
    if (!userIngredients.length) return;

    try {
        const response = await fetch(`${API_BASE_URL}/recommend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ingredients: userIngredients,
                method: 'normalized',
                min_match: 0,
                filters: {}
            })
        });

        const data = await response.json();
        if (data.success) {
            topRecipes = data.data.recommendations.slice(0, 5);
        }
    } catch (e) {
        console.warn('Could not fetch recipes for chat context:', e);
    }
}

function renderContextBar(ingredients) {
    const container = document.getElementById('chatContextTags');
    if (!container) return;

    if (!ingredients.length) return;

    container.innerHTML = '';
    ingredients.slice(0, 8).forEach(ing => {
        const tag = document.createElement('span');
        tag.className = 'chat-context-tag';
        
        // FIXED: Extract the name property from the object (with a fallback just in case)
        tag.textContent = ing.name || ing; 
        
        container.appendChild(tag);
    });

    if (ingredients.length > 8) {
        const more = document.createElement('span');
        more.className = 'chat-context-tag';
        more.textContent = `+${ingredients.length - 8} more`;
        container.appendChild(more);
    }
}

// ============================================
// WELCOME MESSAGE
// ============================================

function showWelcomeMessage() {
    const hasIngredients = userIngredients.length > 0;

    const welcomeText = hasIngredients
        ? `Hi! 👋 I can see you have **${userIngredients.length} ingredients** ready. I've loaded your matched recipes too!\n\nWhat would you like to cook today? You can ask me for recipe suggestions, step-by-step instructions, or cooking tips.`
        : `Hi! 👋 Welcome to your Smart Recipee Culinary Assistant!\n\nTo get personalised recipe suggestions, go to the **Recipes page** first and confirm your ingredients. Then come back here and I'll help you cook!\n\nYou can still ask me general Malaysian cooking questions in the meantime.`;

    appendMessage('bot', welcomeText);
}

// ============================================
// INPUT SETUP
// ============================================

function setupInput() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSendBtn');

    sendBtn?.addEventListener('click', sendMessage);

    input?.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    input?.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
}

function setupSuggestions() {
    const suggestions = document.querySelectorAll('.chat-suggestion');
    suggestions.forEach(btn => {
        btn.addEventListener('click', function () {
            const input = document.getElementById('chatInput');
            if (input) {
                input.value = this.textContent;
                sendMessage();
            }
        });
    });
}

// ============================================
// SEND MESSAGE
// ============================================

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSendBtn');
    const message = input?.value.trim();

    if (!message) return;

    // Clear input
    if (input) {
        input.value = '';
        input.style.height = 'auto';
    }

    // Hide suggestions after first message
    const suggestions = document.getElementById('chatSuggestions');
    if (suggestions) suggestions.style.display = 'none';

    // Show user message
    appendMessage('user', message);

    // Add to history
    conversationHistory.push({ role: 'user', content: message });

    // Show typing indicator
    const typingId = showTyping();

    // Disable send button
    if (sendBtn) sendBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                ingredients: userIngredients,
                recipes: topRecipes,
                history: conversationHistory.slice(-10) // last 10 messages for context
            })
        });

        const data = await response.json();

        removeTyping(typingId);

        if (!data.success) throw new Error(data.error);

        const reply = data.data.reply;
        appendMessage('bot', reply);
        conversationHistory.push({ role: 'assistant', content: reply });

    } catch (error) {
        removeTyping(typingId);
        appendMessage('bot', '⚠️ Sorry, I couldn\'t connect to the assistant. Please make sure the Flask server is running and try again.');
        console.error('Chat error:', error);
    } finally {
        if (sendBtn) sendBtn.disabled = false;
        input?.focus();
    }
}

// ============================================
// RENDER MESSAGES
// ============================================

function appendMessage(role, text) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.className = `chat-message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = role === 'bot' ? '🤖' : '👤';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerHTML = formatMessage(text);

    wrapper.appendChild(avatar);

    // For bot messages, wrap bubble and save button together
    if (role === 'bot') {
        const botContent = document.createElement('div');
        botContent.className = 'chat-bot-content';
        botContent.appendChild(bubble);

        // Add Save as Recipe button
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn-save-recipe-from-chat';
        saveBtn.type = 'button';
        saveBtn.textContent = '💾 Save as Recipe';
        saveBtn.addEventListener('click', () => saveRecipeFromChat(text));

        botContent.appendChild(saveBtn);
        wrapper.appendChild(botContent);
    } else {
        wrapper.appendChild(bubble);
    }

    container.appendChild(wrapper);

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function formatMessage(text) {
    // Convert markdown-like formatting to HTML
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^### (.*$)/gm, '<h4 style="margin:0.5rem 0 0.25rem; font-size:0.95rem;">$1</h4>')
        .replace(/^## (.*$)/gm, '<h3 style="margin:0.5rem 0 0.25rem;">$1</h3>')
        .replace(/^\d+\.\s(.+)/gm, '<li>$1</li>')
        .replace(/^[-•]\s(.+)/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/gs, '<ol>$1</ol>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/^(.+)$/, '<p>$1</p>');
}

// ============================================
// TYPING INDICATOR
// ============================================

function showTyping() {
    const container = document.getElementById('chatMessages');
    if (!container) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message bot';
    const id = 'typing-' + Date.now();
    wrapper.id = id;

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = '🤖';

    const typing = document.createElement('div');
    typing.className = 'chat-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';

    wrapper.appendChild(avatar);
    wrapper.appendChild(typing);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;

    return id;
}

function removeTyping(id) {
    if (!id) return;
    document.getElementById(id)?.remove();
}

// ============================================
// SAVE RECIPE FROM CHAT
// ============================================

function saveRecipeFromChat(text) {
    const parsed = parseChatRecipe(text);

    // Store parsed data in sessionStorage
    sessionStorage.setItem('chatRecipeDraft', JSON.stringify(parsed));

    window.location.href = 'add-recipe.html?from_chat=1';
}

function parseChatRecipe(text) {
    const result = { name: '', ingredients: [], instructions: [] };
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // ── Section detection ──
    const isIngredientHeader = l => /^#+\s*ingredient|^\*{0,2}ingredient/i.test(l);
    const isInstructionHeader = l => /^#+\s*(instruction|step|method|direction)|^\*{0,2}(instruction|step|method|direction)/i.test(l);
    const isIngredientLine = l => /^[*-]\s+/.test(l);
    const isInstructionLine = l => /^\d+[\.\)]\s+/.test(l);
    const isTipOrNote = l => /^(tip|note|enjoy|that|serve|optional)/i.test(l.replace(/^\*+/, '').trim());

    // ── Extract recipe name ──
    // Priority 1: Look for explicit "Recipe Name: X" pattern
    for (const line of lines) {
        const cleaned = line.replace(/\*\*/g, '').replace(/\*/g, '').trim();
        const match = cleaned.match(/^recipe\s+name\s*:\s*(.+)/i);
        if (match) {
            result.name = match[1].trim().replace(/[!:*]/g, '').trim();
            break;
        }
    }

    // Priority 2: Standalone title line before Ingredients header
    if (!result.name) {
        for (let i = 0; i < Math.min(lines.length, 10); i++) {
            const line = lines[i].replace(/\*\*/g, '').replace(/\*/g, '').trim();
            const nextLine = (lines[i + 1] || '').trim();
            if (
                isIngredientHeader(nextLine) &&
                line.length >= 4 && line.length <= 60 &&
                !isIngredientHeader(line) && !isInstructionHeader(line) &&
                !line.includes('guide you') && !line.includes('happy to') &&
                !line.includes('step-by-step') &&
                /^[A-Z]/.test(line) && !line.endsWith(':') &&
                line.split(' ').length <= 9
            ) {
                result.name = line;
                break;
            }
        }
    }

    // Priority 3: Pattern matching fallback
    if (!result.name) {
        for (const line of lines.slice(0, 5)) {
            if (isIngredientHeader(line) || isInstructionHeader(line)) break;
            const cleaned = line.replace(/\*\*/g, '').replace(/\*/g, '').trim();
            const patterns = [
                /through the ([A-Za-z][A-Za-z\s\-&]{3,45}?)(?:\s+recipe|\.|,|!|\?|$)/i,
                /recipe for ([A-Za-z][A-Za-z\s\-&]{3,45}?)(?:\s+using|\s+with|\.|,|!|\?|$)/i,
                /(?:make|cook|prepare|create|whip up)\s+(?:a\s+)?(?:simple\s+|delicious\s+|quick\s+)?([A-Z][A-Za-z\s\-&]{3,45}?)(?:\s+using|\s+with|\s+recipe|\.|,|!|\?|$)/i,
                /here(?:'s| is) (?:a\s+)?(?:simple\s+|delicious\s+|quick\s+)?([A-Z][A-Za-z\s\-&]{3,45}?) recipe/i,
                /^##?\s+([A-Z][A-Za-z\s\-&]{3,45})$/,
            ];
            for (const p of patterns) {
                const m = cleaned.match(p);
                if (m) {
                    const candidate = m[1].trim().replace(/[!:*]/g, '').trim();
                    if (candidate.length <= 50 && candidate.split(' ').length <= 7) {
                        result.name = candidate;
                        break;
                    }
                }
            }
            if (result.name) break;
        }
    }

    // ── Parse sections ──
    let section = 'none';

    const unitMap = {
        'cup': 'cup', 'cups': 'cup',
        'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'tbsp': 'tbsp',
        'teaspoon': 'tsp', 'teaspoons': 'tsp', 'tsp': 'tsp',
        'gram': 'g', 'grams': 'g', 'g': 'g',
        'kg': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
        'ml': 'ml', 'l': 'l', 'liter': 'l', 'liters': 'l',
        'piece': 'pieces', 'pieces': 'pieces',
        'clove': 'cloves', 'cloves': 'cloves',
        'stalk': 'stalks', 'stalks': 'stalks',
        'slice': 'pieces', 'slices': 'pieces',
    };

    for (const line of lines) {
        // Detect section changes
        if (isIngredientHeader(line)) { section = 'ingredients'; continue; }
        if (isInstructionHeader(line)) { section = 'instructions'; continue; }

        // Skip tip/note lines in ingredients
        if (section === 'ingredients' && isTipOrNote(line)) continue;

        // ── Ingredient lines ──
        if (section === 'ingredients' && isIngredientLine(line)) {
            const raw = line.replace(/^[*-]\s+/, '').trim();
            if (!raw || raw.length < 2) continue;

            const match = raw.match(
                /^([\d½¼¾\/\-]+(?:\.\d+)?(?:\s*[-–]\s*[\d]+)?)\s+([a-z]+)\s+(.+)/i
            );

            if (match) {
                const qty = match[1].trim();
                const unitRaw = match[2].toLowerCase();
                const name = match[3]
                    .replace(/\(.*?\)/g, '')
                    .replace(/,.*$/, '')
                    .trim();
                const unit = unitMap[unitRaw] || 'pieces';
                if (name.length > 1) result.ingredients.push({ name, quantity: qty, unit });
            } else {
                // No quantity — whole string is name
                const name = raw
                    .replace(/\(.*?\)/g, '')
                    .replace(/,.*$/, '')
                    .replace(/to taste.*$/i, '')
                    .trim();
                if (name.length > 1) result.ingredients.push({ name, quantity: '1', unit: 'pieces' });
            }
        }

        // ── Instruction lines ──
        if (section === 'instructions' && isInstructionLine(line)) {
            const raw = line.replace(/^\d+[\.\)]\s*/, '').trim();
            // Strip bold step labels like "**Prepare the fish**:"
            const cleaned = raw.replace(/^\*\*[^*]+\*\*:?\s*/, '').trim();
            if (cleaned.length > 5) result.instructions.push(cleaned);
        }
    }

    return result;
}