/**
 * Smart Recipee - Detection & Active Learning Module
 * Author: Jaya Hakim Prajna
 */

// ============================================
// SHARED GLOBAL STATE (Accessible by both files)
// ============================================
var API_BASE_URL = 'http://127.0.0.1:5000/api';
var USER_INGREDIENTS = [];
var CONFIRMED_INGREDIENTS = [];
var DETECTION_DATA = null;

// Zoom State
let currentZoom = 1;
const ZOOM_STEP = 0.2;
const MAX_ZOOM = 3.0;
const MIN_ZOOM = 0.5;

// Active Learning (Annotation) State
let IS_ANNOTATING = false;
let IS_DRAWING = false;
let DRAWN_BOXES = [];
let CURRENT_BOX = null;
let SELECTED_BOX = null;

// ============================================
// DOM ELEMENTS
// ============================================
const imageUpload = document.getElementById('imageUpload');
const modelSelect = document.getElementById('modelSelect');
const detectBtn = document.getElementById('detectBtn');
const uploadStatus = document.getElementById('uploadStatus');

const ingredientsSection = document.getElementById('ingredientsSection');
const ingredientsList = document.getElementById('ingredientsList');
const reviewStatus = document.getElementById('reviewStatus');
const confirmBtn = document.getElementById('confirmBtn');
const clearBtn = document.getElementById('clearBtn');
const manualIngredientInput = document.getElementById('manualIngredientInput');
const addIngredientBtn = document.getElementById('addIngredientBtn');
const testIngredientsBtn = document.getElementById('testIngredientsBtn');

const detectionPreview = document.getElementById('detectionPreview');
const annotatedPreviewImage = document.getElementById('annotatedPreviewImage');
const detectionSummary = document.getElementById('detectionSummary');

const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomResetBtn = document.getElementById('zoomResetBtn');

// Annotation DOM Elements
const startAnnotationBtn = document.getElementById('startAnnotationBtn');
const annotationControls = document.getElementById('annotationControls');
const annotationCanvas = document.getElementById('annotationCanvas');
const annotationLabelInput = document.getElementById('annotationLabelInput');
const addBoxBtn = document.getElementById('addBoxBtn'); // Repurposed as Delete button
const clearBoxesBtn = document.getElementById('clearBoxesBtn');
const submitAnnotationsBtn = document.getElementById('submitAnnotationsBtn');
const cancelAnnotationBtn = document.getElementById('cancelAnnotationBtn');
const currentAnnotationsList = document.getElementById('currentAnnotationsList');
const annotationStatusMsg = document.getElementById('annotationStatusMsg');
let canvasCtx = annotationCanvas ? annotationCanvas.getContext('2d') : null;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function () {
    if (detectBtn) detectBtn.addEventListener('click', detectFromUpload);
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => applyZoom(ZOOM_STEP));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => applyZoom(-ZOOM_STEP));
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetZoom);
    
    if (confirmBtn) confirmBtn.addEventListener('click', confirmIngredients);
    if (clearBtn) clearBtn.addEventListener('click', clearAllDetectionState);
    if (addIngredientBtn) addIngredientBtn.addEventListener('click', addManualIngredient);
    
    if (manualIngredientInput) {
        manualIngredientInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); addManualIngredient(); }
        });
    }

    // Annotation Listeners
    if (startAnnotationBtn) startAnnotationBtn.addEventListener('click', enableAnnotationMode);
    if (cancelAnnotationBtn) cancelAnnotationBtn.addEventListener('click', disableAnnotationMode);
    if (clearBoxesBtn) clearBoxesBtn.addEventListener('click', clearAnnotations);
    if (submitAnnotationsBtn) submitAnnotationsBtn.addEventListener('click', submitAnnotationsToServer);
    if (addBoxBtn) addBoxBtn.addEventListener('click', deleteSelectedBox);

    if (annotationLabelInput) {
        annotationLabelInput.addEventListener('input', function(e) {
            if (SELECTED_BOX) {
                SELECTED_BOX.class_name = e.target.value || 'unknown';
                redrawCanvas();
                updateAnnotationsList();
            }
        });
    }

    if (annotationCanvas) {
        annotationCanvas.addEventListener('mousedown', startDrawing);
        annotationCanvas.addEventListener('mousemove', drawBox);
        annotationCanvas.addEventListener('mouseup', finishDrawing);
        annotationCanvas.addEventListener('mouseleave', finishDrawing);
    }

    if (testIngredientsBtn) {
        testIngredientsBtn.addEventListener('click', function() {
            USER_INGREDIENTS = []; CONFIRMED_INGREDIENTS = []; DETECTION_DATA = null;
            persistDetectionState();
            if (uploadStatus) uploadStatus.textContent = '';
            if (detectionPreview) detectionPreview.style.display = 'none';
            if (ingredientsSection) ingredientsSection.style.display = 'block';
            if (reviewStatus) reviewStatus.textContent = 'Adding ingredients manually.';
            displayIngredients(USER_INGREDIENTS);
        });
    }

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
        if (modelSelect) form.append('model_type', modelSelect.value);

        const response = await fetch(`${API_BASE_URL}/detect`, { method: 'POST', body: form });
        const payload = await response.json();

        if (!response.ok || !payload.success) throw new Error(payload.error || `Detect API error: ${response.status}`);

        DETECTION_DATA = payload.data;
        
        USER_INGREDIENTS = DETECTION_DATA.ingredients.map(ing => ({
            name: normalizeIngredient(ing.name),
            original_name: normalizeIngredient(ing.name),
            detection_id: ing.detection_id,
            count: ing.count || 1
        }));
        
        CONFIRMED_INGREDIENTS = [];
        persistDetectionState();

        if (uploadStatus) {
            uploadStatus.textContent = `Detected ${USER_INGREDIENTS.length} ingredient(s) using ${modelSelect.value.toUpperCase()} ✅`;
        }

        displayIngredients(USER_INGREDIENTS);
        showReviewSection();
        displayDetectionPreview(DETECTION_DATA);

    } catch (error) {
        console.error('Detection error:', error);
        if (uploadStatus) uploadStatus.textContent = `Detection failed: ${error.message}`;
        if (typeof window.showError === 'function') window.showError(error.message);
    }
}

function displayDetectionPreview(data) {
    if (!detectionPreview || !annotatedPreviewImage) return;

    if (!data || !data.annotated_image_url) {
        detectionPreview.style.display = 'none';
        return;
    }

    annotatedPreviewImage.onload = function() {
        if (annotationCanvas) {
            annotationCanvas.width = annotatedPreviewImage.offsetWidth;
            annotationCanvas.height = annotatedPreviewImage.offsetHeight;
        }
    };

    annotatedPreviewImage.src = data.annotated_image_url;
    annotatedPreviewImage.alt = 'Detected ingredients with bounding boxes';

    if (detectionSummary) detectionSummary.style.display = 'none';
    detectionPreview.style.display = 'block';
}

// ============================================
// ADVANCED ACTIVE LEARNING (ANNOTATION)
// ============================================
function enableAnnotationMode() {
    IS_ANNOTATING = true;
    IS_DRAWING = false;
    DRAWN_BOXES = [];
    SELECTED_BOX = null;
    CURRENT_BOX = null;

    if (startAnnotationBtn) startAnnotationBtn.style.display = 'none';
    if (annotationControls) annotationControls.style.display = 'block';
    
    if (addBoxBtn) {
        addBoxBtn.textContent = '🗑️ Delete Box';
        addBoxBtn.className = 'btn-danger';
        addBoxBtn.disabled = true;
    }

    if (annotationCanvas) {
        annotationCanvas.style.display = 'block';
        annotationCanvas.width = annotatedPreviewImage.offsetWidth;
        annotationCanvas.height = annotatedPreviewImage.offsetHeight;
    }
    
    // Preload AI detections as editable boxes
    if (DETECTION_DATA && DETECTION_DATA.detections) {
        const origW = annotatedPreviewImage.naturalWidth || 1;
        const origH = annotatedPreviewImage.naturalHeight || 1;
        
        DETECTION_DATA.detections.forEach(det => {
            const [x1, y1, x2, y2] = det.bbox;
            DRAWN_BOXES.push({
                id: Math.random().toString(36).substr(2, 9),
                class_name: det.name,
                cx: ((x1 + x2) / 2) / origW,
                cy: ((y1 + y2) / 2) / origH,
                w: (x2 - x1) / origW,
                h: (y2 - y1) / origH,
                selected: false
            });
        });
    }

    if (DETECTION_DATA && DETECTION_DATA.original_image_url) {
        annotatedPreviewImage.src = DETECTION_DATA.original_image_url;
    }

    if (annotationStatusMsg) annotationStatusMsg.textContent = '';
    updateAnnotationsList();
    redrawCanvas();
}

function disableAnnotationMode() {
    IS_ANNOTATING = false;
    if (startAnnotationBtn) startAnnotationBtn.style.display = 'inline-block';
    if (annotationControls) annotationControls.style.display = 'none';
    if (annotationCanvas) annotationCanvas.style.display = 'none';
    if (DETECTION_DATA && DETECTION_DATA.annotated_image_url) {
        annotatedPreviewImage.src = DETECTION_DATA.annotated_image_url;
    }
}

function getMouseNormalized(e) {
    const rect = annotationCanvas.getBoundingClientRect();
    const scaleX = annotationCanvas.width / rect.width;
    const scaleY = annotationCanvas.height / rect.height;
    return {
        nx: ((e.clientX - rect.left) * scaleX) / annotationCanvas.width,
        ny: ((e.clientY - rect.top) * scaleY) / annotationCanvas.height
    };
}

function isInsideBox(nx, ny, box) {
    const bx1 = box.cx - box.w / 2;
    const by1 = box.cy - box.h / 2;
    const bx2 = box.cx + box.w / 2;
    const by2 = box.cy + box.h / 2;
    return nx >= bx1 && nx <= bx2 && ny >= by1 && ny <= by2;
}

function startDrawing(e) {
    if (!IS_ANNOTATING) return;
    const { nx, ny } = getMouseNormalized(e);

    // Check if clicking an existing box
    let clickedBox = null;
    for (let i = DRAWN_BOXES.length - 1; i >= 0; i--) {
        if (isInsideBox(nx, ny, DRAWN_BOXES[i])) {
            clickedBox = DRAWN_BOXES[i];
            break;
        }
    }

    if (clickedBox) {
        DRAWN_BOXES.forEach(b => b.selected = false);
        clickedBox.selected = true;
        SELECTED_BOX = clickedBox;
        annotationLabelInput.value = clickedBox.class_name;
        annotationLabelInput.focus();
        redrawCanvas();
    } else {
        DRAWN_BOXES.forEach(b => b.selected = false);
        SELECTED_BOX = null;
        annotationLabelInput.value = '';
        IS_DRAWING = true;
        CURRENT_BOX = { start_nx: nx, start_ny: ny, curr_nx: nx, curr_ny: ny };
        redrawCanvas();
    }
}

function drawBox(e) {
    if (!IS_ANNOTATING || !IS_DRAWING || !CURRENT_BOX) return;
    const { nx, ny } = getMouseNormalized(e);
    CURRENT_BOX.curr_nx = nx;
    CURRENT_BOX.curr_ny = ny;
    redrawCanvas();
}

function finishDrawing() {
    if (!IS_ANNOTATING || !IS_DRAWING || !CURRENT_BOX) return;
    IS_DRAWING = false;

    const x1 = Math.min(CURRENT_BOX.start_nx, CURRENT_BOX.curr_nx);
    const x2 = Math.max(CURRENT_BOX.start_nx, CURRENT_BOX.curr_nx);
    const y1 = Math.min(CURRENT_BOX.start_ny, CURRENT_BOX.curr_ny);
    const y2 = Math.max(CURRENT_BOX.start_ny, CURRENT_BOX.curr_ny);
    const w = x2 - x1;
    const h = y2 - y1;

    if (w > 0.02 && h > 0.02) {
        const newBox = {
            id: Math.random().toString(36).substr(2, 9),
            class_name: annotationLabelInput.value.trim() || 'new_ingredient',
            cx: x1 + (w / 2),
            cy: y1 + (h / 2),
            w: w,
            h: h,
            selected: true
        };
        DRAWN_BOXES.push(newBox);
        SELECTED_BOX = newBox;
        annotationLabelInput.value = newBox.class_name;
        annotationLabelInput.focus();
        annotationLabelInput.select();
    }
    
    CURRENT_BOX = null;
    redrawCanvas();
    updateAnnotationsList();
}

function deleteSelectedBox() {
    if (SELECTED_BOX) {
        DRAWN_BOXES = DRAWN_BOXES.filter(b => b.id !== SELECTED_BOX.id);
        SELECTED_BOX = null;
        annotationLabelInput.value = '';
        redrawCanvas();
        updateAnnotationsList();
    }
}

function redrawCanvas() {
    if (!canvasCtx || !annotationCanvas) return;
    canvasCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);

    const cw = annotationCanvas.width;
    const ch = annotationCanvas.height;

    DRAWN_BOXES.forEach(box => {
        const raw_w = box.w * cw;
        const raw_h = box.h * ch;
        const raw_x = (box.cx * cw) - (raw_w / 2);
        const raw_y = (box.cy * ch) - (raw_h / 2);

        canvasCtx.strokeStyle = box.selected ? '#00ffff' : '#ff00ff';
        canvasCtx.lineWidth = box.selected ? 3 : 2;
        canvasCtx.strokeRect(raw_x, raw_y, raw_w, raw_h);
        
        canvasCtx.fillStyle = box.selected ? '#00ffff' : '#ff00ff';
        canvasCtx.font = '16px Arial';
        const textWidth = canvasCtx.measureText(box.class_name).width;
        canvasCtx.fillRect(raw_x, raw_y - 20, textWidth + 10, 20);
        
        canvasCtx.fillStyle = box.selected ? '#000000' : '#ffffff';
        canvasCtx.fillText(box.class_name, raw_x + 5, raw_y - 5);
    });

    if (IS_DRAWING && CURRENT_BOX) {
        const raw_start_x = CURRENT_BOX.start_nx * cw;
        const raw_start_y = CURRENT_BOX.start_ny * ch;
        const rw = (CURRENT_BOX.curr_nx * cw) - raw_start_x;
        const rh = (CURRENT_BOX.curr_ny * ch) - raw_start_y;

        canvasCtx.strokeStyle = '#00ffff';
        canvasCtx.lineWidth = 2;
        canvasCtx.setLineDash([5, 5]); 
        canvasCtx.strokeRect(raw_start_x, raw_start_y, rw, rh);
        canvasCtx.setLineDash([]); 
    }

    if (addBoxBtn) addBoxBtn.disabled = !SELECTED_BOX;
    if (submitAnnotationsBtn) submitAnnotationsBtn.disabled = DRAWN_BOXES.length === 0;
}

function updateAnnotationsList() {
    if (!currentAnnotationsList) return;
    currentAnnotationsList.innerHTML = '';
    if (DRAWN_BOXES.length === 0) {
        currentAnnotationsList.innerHTML = '<li>No boxes drawn yet.</li>';
        return;
    }
    DRAWN_BOXES.forEach((box, index) => {
        const li = document.createElement('li');
        li.textContent = `[${index + 1}] ${escapeHtml(box.class_name)}`;
        if (box.selected) li.style.fontWeight = 'bold';
        currentAnnotationsList.appendChild(li);
    });
}

function clearAnnotations() {
    DRAWN_BOXES = [];
    SELECTED_BOX = null;
    CURRENT_BOX = null;
    if (addBoxBtn) addBoxBtn.disabled = true;
    if (submitAnnotationsBtn) submitAnnotationsBtn.disabled = true;
    if (annotationLabelInput) annotationLabelInput.value = '';
    if (annotationStatusMsg) annotationStatusMsg.textContent = '';
    updateAnnotationsList();
    redrawCanvas();
}

async function submitAnnotationsToServer() {
    if (DRAWN_BOXES.length === 0 || !DETECTION_DATA || !DETECTION_DATA.raw_filename) return;

    submitAnnotationsBtn.disabled = true;
    annotationStatusMsg.textContent = 'Saving to dataset... 🚀';
    annotationStatusMsg.style.color = '#333';

    try {
        const payload = {
            image: DETECTION_DATA.raw_filename,
            model_type: modelSelect ? modelSelect.value : 'rt-detr',
            annotations: DRAWN_BOXES.map(b => ({
                class_name: b.class_name,
                x_center: b.cx.toFixed(6),
                y_center: b.cy.toFixed(6),
                width: b.w.toFixed(6),
                height: b.h.toFixed(6)
            }))
        };

        const response = await fetch(`${API_BASE_URL}/annotate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        annotationStatusMsg.textContent = '✅ ' + data.message;
        annotationStatusMsg.style.color = '#2e7d32';

        DRAWN_BOXES.forEach(box => {
            if (!USER_INGREDIENTS.some(i => i.name === box.class_name)) {
                USER_INGREDIENTS.push({ name: box.class_name, original_name: box.class_name, detection_id: null, count: 1 });
            }
        });
        
        persistDetectionState();
        displayIngredients(USER_INGREDIENTS);

        setTimeout(() => { disableAnnotationMode(); }, 2000);
    } catch (error) {
        annotationStatusMsg.textContent = `⚠️ Failed: ${error.message}`;
        annotationStatusMsg.style.color = '#c62828';
        submitAnnotationsBtn.disabled = false;
    }
}

// ============================================
// GRID UI & HELPERS
// ============================================
function showReviewSection() {
    if (ingredientsSection) ingredientsSection.style.display = 'block';
    if (reviewStatus) reviewStatus.textContent = 'Review your detected ingredients. Change or remove items, then confirm to get recipes.';
    if (typeof window.resetRecipeArea === 'function') window.resetRecipeArea();
}

function confirmIngredients() {
    if (!USER_INGREDIENTS || USER_INGREDIENTS.length === 0) return;
    CONFIRMED_INGREDIENTS = [...USER_INGREDIENTS];
    persistDetectionState();
    if (reviewStatus) {
        reviewStatus.innerHTML = `✅ <strong>Success! Confirmed ${CONFIRMED_INGREDIENTS.length} ingredient(s).</strong> Finding recipes...`;
        reviewStatus.style.color = '#2e7d32'; 
    }
    // Call the function from friend's module
    if (typeof window.fetchRecipes === 'function') window.fetchRecipes();
}

function displayIngredients(ingredientObjects = []) {
    if (!ingredientsList) return;
    ingredientsList.innerHTML = '';
    if (ingredientObjects.length === 0) { ingredientsList.innerHTML = '<p style="color: #999;">No ingredients detected</p>'; return; }

    const grid = document.createElement('div');
    grid.className = 'ingredient-grid';

    ingredientObjects.forEach((ingObj, index) => {
        const detItem = ingObj.detection_id ? DETECTION_DATA?.ingredients?.find(d => d.detection_id === ingObj.detection_id) : null;
        const isRotten = ingObj.name.toLowerCase().includes('rotten');
        const imgHtml = detItem?.crop_image_url ? `<img src="${detItem.crop_image_url}" class="ing-crop">` : `<div class="ing-placeholder">🍽️</div>`;
        const confText = !detItem ? 'Manually Added' : `${Math.round(detItem.confidence * 100)}% Confidence`;
        const countText = (ingObj.count && ingObj.count > 1) ? ` <span style="color:#888; font-size:0.85em;">(x${ingObj.count})</span>` : '';

        const card = document.createElement('div');
        card.className = `ing-card ${isRotten ? 'rotten' : ''}`;
        card.innerHTML = `
            ${imgHtml}
            <div class="ing-name" style="${isRotten ? 'color: #c62828;' : ''}">${isRotten ? '⚠️ ' : ''}${escapeHtml(ingObj.name)}${countText}</div>
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

window.changeIngredientGrid = function(index) {
    const ingObj = USER_INGREDIENTS[index];
    const newName = prompt(`Change "${ingObj.name}" to:`, ingObj.name);
    if (newName && newName.trim() !== "" && newName.trim() !== ingObj.name) {
        const normalized = normalizeIngredient(newName);
        if (USER_INGREDIENTS.some(i => normalizeIngredient(i.name) === normalized)) alert(`"${normalized}" is already in the list!`);
        else {
            ingObj.name = normalized; 
            persistDetectionState(); displayIngredients(USER_INGREDIENTS);
        }
    }
};

window.removeIngredientGrid = function(index) {
    USER_INGREDIENTS.splice(index, 1);
    persistDetectionState(); displayIngredients(USER_INGREDIENTS);
};

function addManualIngredient() {
    if (!manualIngredientInput) return;
    const value = normalizeIngredient(manualIngredientInput.value);
    if (!value) return;

    if (!USER_INGREDIENTS.some(i => normalizeIngredient(i.name) === value)) {
        USER_INGREDIENTS.push({ name: value, original_name: value, detection_id: null, count: 1 });
        persistDetectionState();
        displayIngredients(USER_INGREDIENTS);
    }
    manualIngredientInput.value = '';
}

function resetDetectionFlow(clearUploadStatus = true) {
    USER_INGREDIENTS = []; CONFIRMED_INGREDIENTS = []; DETECTION_DATA = null;
    displayIngredients([]);
    disableAnnotationMode();
    if (ingredientsSection) ingredientsSection.style.display = 'none'; 
    if (manualIngredientInput) manualIngredientInput.value = '';
    if (reviewStatus) reviewStatus.textContent = '';
    if (detectionPreview) detectionPreview.style.display = 'none';
    if (clearUploadStatus && uploadStatus) uploadStatus.textContent = '';
    if (typeof window.resetRecipeArea === 'function') window.resetRecipeArea();
}

function clearAllDetectionState() {
    resetDetectionFlow(true);
    sessionStorage.removeItem('userIngredients');
    sessionStorage.removeItem('confirmedIngredients');
    sessionStorage.removeItem('detectionData');
}

function applyZoom(step) {
    currentZoom += step;
    if (currentZoom > MAX_ZOOM) currentZoom = MAX_ZOOM;
    if (currentZoom < MIN_ZOOM) currentZoom = MIN_ZOOM;
    if (annotatedPreviewImage) annotatedPreviewImage.style.transform = `scale(${currentZoom})`;
    if (annotationCanvas) annotationCanvas.style.transform = `scale(${currentZoom})`;
}

function resetZoom() {
    currentZoom = 1;
    if (annotatedPreviewImage) annotatedPreviewImage.style.transform = `scale(${currentZoom})`;
    if (annotationCanvas) annotationCanvas.style.transform = `scale(${currentZoom})`;
}

function persistDetectionState() {
    sessionStorage.setItem('userIngredients', JSON.stringify(USER_INGREDIENTS));
    sessionStorage.setItem('confirmedIngredients', JSON.stringify(CONFIRMED_INGREDIENTS));
    if (DETECTION_DATA) sessionStorage.setItem('detectionData', JSON.stringify(DETECTION_DATA));
    else sessionStorage.removeItem('detectionData');
}

function restoreSavedState() {
    try {
        const savedUser = sessionStorage.getItem('userIngredients');
        const savedConfirmed = sessionStorage.getItem('confirmedIngredients');
        const savedDetection = sessionStorage.getItem('detectionData');

        if (savedUser) USER_INGREDIENTS = JSON.parse(savedUser) || [];
        if (savedConfirmed) CONFIRMED_INGREDIENTS = JSON.parse(savedConfirmed) || [];
        if (savedDetection) DETECTION_DATA = JSON.parse(savedDetection);

        const ingredientsToShow = CONFIRMED_INGREDIENTS.length > 0 ? CONFIRMED_INGREDIENTS : USER_INGREDIENTS;

        if (ingredientsToShow.length > 0) {
            displayIngredients(ingredientsToShow);
            if (ingredientsSection) ingredientsSection.style.display = 'block';
        }

        if (DETECTION_DATA) displayDetectionPreview(DETECTION_DATA);
        if (CONFIRMED_INGREDIENTS.length > 0 && typeof window.fetchRecipes === 'function') {
            window.fetchRecipes();
        }
    } catch (error) { console.error('Failed to restore:', error); }
}

function normalizeIngredient(value) { return String(value || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

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
    if (warningContainer) warningContainer.innerHTML = '';
}
