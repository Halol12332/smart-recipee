/**
 * Smart Recipee - Culinary Assistant Chat
 * Powered by Google Gemini Flash
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
        tag.textContent = ing;
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
    wrapper.appendChild(bubble);
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