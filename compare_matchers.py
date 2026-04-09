import json
import time
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
import os
from backend.utils.matcher import get_recipe_recommendations

# ============================================================
# LOAD RECIPES
# ============================================================

with open('backend/data/recipes.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    recipes = data['recipes']

print(f"Loaded {len(recipes)} recipes from database")

# ============================================================
# TEST CASES
# ============================================================

test_cases = [
    {
        'name': 'Test Case 1 — Perfect Match (Nasi Lemak)',
        'ingredients': [
            "rice", "coconut milk", "pandan leaves",
            "egg", "cucumber", "peanuts", "ikan bilis", "sambal"
        ],
        'expected_best': 'Nasi Lemak',
        'relevant_ingredients': [
            "rice", "coconut milk", "pandan leaves",
            "egg", "cucumber", "peanuts", "ikan bilis", "sambal"
        ]
    },
    {
        'name': 'Test Case 2 — Ingredient Variation (chicken vs chicken breast)',
        'ingredients': ["rice", "chicken", "egg", "soy sauce", "garlic"],
        'expected_best': 'Hainanese Chicken Rice or similar',
        'relevant_ingredients': ["rice", "chicken", "egg", "soy sauce", "garlic"]
    },
    {
        'name': 'Test Case 3 — Typo Handling (chicekn instead of chicken)',
        'ingredients': ["rice", "chicekn", "egg", "soy sauce", "garlic"],
        'expected_best': 'Chicken-based recipe (if fuzzy/hybrid works)',
        'relevant_ingredients': ["rice", "chicken", "egg", "soy sauce", "garlic"]
    },
    {
        'name': 'Test Case 4 — Limited Ingredients',
        'ingredients': ["rice", "egg"],
        'expected_best': 'Any rice or egg based recipe',
        'relevant_ingredients': ["rice", "egg"]
    }
]

# ============================================================
# METRICS CALCULATION
# ============================================================

def calculate_precision(matched_ingredients, user_ingredients):
    """
    Precision = True Positives / (True Positives + False Positives)
    Of all ingredients the system said matched, how many were correct?
    """
    if not matched_ingredients:
        return 0.0
    user_set = set(ing.lower().strip() for ing in user_ingredients)
    true_positives = sum(1 for ing in matched_ingredients if ing.lower().strip() in user_set)
    return round((true_positives / len(matched_ingredients)) * 100, 1)


def calculate_recall(matched_ingredients, relevant_ingredients):
    """
    Recall = True Positives / (True Positives + False Negatives)
    Of all relevant ingredients, how many did the system correctly find?
    """
    if not relevant_ingredients:
        return 0.0
    relevant_set = set(ing.lower().strip() for ing in relevant_ingredients)
    true_positives = sum(1 for ing in matched_ingredients if ing.lower().strip() in relevant_set)
    return round((true_positives / len(relevant_set)) * 100, 1)


def calculate_f1(precision, recall):
    """
    F1 Score = 2 × (Precision × Recall) / (Precision + Recall)
    Harmonic mean of precision and recall.
    """
    if precision + recall == 0:
        return 0.0
    f1 = 2 * (precision * recall) / (precision + recall)
    return round(f1, 1)


# ============================================================
# METHODS TO COMPARE
# ============================================================

methods = ['exact', 'normalized', 'fuzzy', 'hybrid', 'jaccard']

# ============================================================
# RUN COMPARISON
# ============================================================

print("\n" + "=" * 80)
print("SMART RECIPEE — MATCHER ALGORITHM COMPARISON")
print("Metrics: Accuracy | Precision | Recall | F1 Score | Speed")
print("=" * 80)

# Summary table data
summary = {method: {
    'accuracy': [],
    'precision': [],
    'recall': [],
    'f1': [],
    'speed': []
} for method in methods}

for test_case in test_cases:
    print(f"\n{'='*80}")
    print(f"TEST: {test_case['name']}")
    print(f"Ingredients: {', '.join(test_case['ingredients'])}")
    print(f"Expected: {test_case['expected_best']}")
    print(f"{'='*80}")

    for method in methods:
        print(f"\n  [{method.upper()}]")

        # Measure speed
        start_time = time.time()
        results = get_recipe_recommendations(
            test_case['ingredients'],
            recipes,
            min_match=0,
            method=method
        )
        end_time = time.time()
        execution_time = (end_time - start_time) * 1000

        if results:
            top = results[0]

            # Calculate metrics based on top result
            precision = calculate_precision(
                top['matched_ingredients'],
                test_case['ingredients']
            )
            recall = calculate_recall(
                top['matched_ingredients'],
                test_case['relevant_ingredients']
            )
            f1 = calculate_f1(precision, recall)
            accuracy = top['match_percentage']

            # Store for summary
            summary[method]['accuracy'].append(accuracy)
            summary[method]['precision'].append(precision)
            summary[method]['recall'].append(recall)
            summary[method]['f1'].append(f1)
            summary[method]['speed'].append(execution_time)

            print(f"  Top Match   : {top['name']}")
            print(f"  Accuracy    : {accuracy}%")
            print(f"  Precision   : {precision}%")
            print(f"  Recall      : {recall}%")
            print(f"  F1 Score    : {f1}%")
            print(f"  Speed       : {execution_time:.2f}ms")
            print(f"  Matched     : {top['total_matched']}/{top['total_required']}")
            print(f"  Missing     : {', '.join(top['missing_ingredients'][:3])}")
            if len(top['missing_ingredients']) > 3:
                print(f"              + {len(top['missing_ingredients']) - 3} more...")
        else:
            print("  No matches found")
            summary[method]['accuracy'].append(0)
            summary[method]['precision'].append(0)
            summary[method]['recall'].append(0)
            summary[method]['f1'].append(0)
            summary[method]['speed'].append(execution_time)

# ============================================================
# SUMMARY TABLE
# ============================================================

print("\n\n" + "=" * 80)
print("SUMMARY — AVERAGE ACROSS ALL TEST CASES")
print("=" * 80)
print(f"\n{'Algorithm':<15} {'Accuracy':>10} {'Precision':>10} {'Recall':>10} {'F1 Score':>10} {'Avg Speed':>12}")
print("-" * 70)

for method in methods:
    avg_accuracy  = round(sum(summary[method]['accuracy'])  / len(summary[method]['accuracy']),  1)
    avg_precision = round(sum(summary[method]['precision']) / len(summary[method]['precision']), 1)
    avg_recall    = round(sum(summary[method]['recall'])    / len(summary[method]['recall']),    1)
    avg_f1        = round(sum(summary[method]['f1'])        / len(summary[method]['f1']),        1)
    avg_speed     = round(sum(summary[method]['speed'])     / len(summary[method]['speed']),     2)

    print(f"{method:<15} {avg_accuracy:>9}% {avg_precision:>9}% {avg_recall:>9}% {avg_f1:>9}% {avg_speed:>10.2f}")

# ============================================================
# CALCULATE AVERAGES FOR GRAPHS
# ============================================================

avg_results = {}
for method in methods:
    avg_results[method] = {
        'accuracy':  round(sum(summary[method]['accuracy'])  / len(summary[method]['accuracy']),  1),
        'precision': round(sum(summary[method]['precision']) / len(summary[method]['precision']), 1),
        'recall':    round(sum(summary[method]['recall'])    / len(summary[method]['recall']),    1),
        'f1':        round(sum(summary[method]['f1'])        / len(summary[method]['f1']),        1),
        'speed':     round(sum(summary[method]['speed'])     / len(summary[method]['speed']),     2)
    }

# ============================================================
# GENERATE GRAPHS
# ============================================================

os.makedirs('evaluation_graphs', exist_ok=True)

method_labels = ['Exact', 'Normalized', 'Fuzzy', 'Hybrid', 'Jaccard']
colors = ['#ff6b6b', '#667eea', '#ffa94d', '#51cf66', '#cc5de8']
highlight = ['#cccccc', '#667eea', '#cccccc', '#cccccc', '#cccccc']

# ============================================================
# GRAPH 1 — Accuracy Comparison
# ============================================================

accuracy_vals = [avg_results[m]['accuracy'] for m in methods]

fig, ax = plt.subplots(figsize=(9, 5))
bars = ax.bar(method_labels, accuracy_vals, color=highlight, edgecolor='white', linewidth=1.5)

for bar, val in zip(bars, accuracy_vals):
    ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.5,
            f'{val}%', ha='center', va='bottom', fontweight='bold', fontsize=11)

ax.set_ylim(0, 115)
ax.set_ylabel('Accuracy (%)', fontsize=12)
ax.set_title('Algorithm Accuracy Comparison\n(Average across all test cases)', fontsize=13, fontweight='bold')
ax.axhline(y=avg_results['normalized']['accuracy'], color='#667eea',
           linestyle='--', linewidth=1.5, label=f'Normalized: {avg_results["normalized"]["accuracy"]}%')
ax.legend(fontsize=10)
ax.set_facecolor('#f8f9ff')
fig.patch.set_facecolor('white')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
plt.tight_layout()
plt.savefig('evaluation_graphs/graph1_accuracy.png', dpi=150, bbox_inches='tight')
plt.close()
print("\n✅ Graph 1 saved: evaluation_graphs/graph1_accuracy.png")

# ============================================================
# GRAPH 2 — Speed Comparison
# ============================================================

speed_vals = [avg_results[m]['speed'] for m in methods]

fig, ax = plt.subplots(figsize=(9, 5))
bars = ax.bar(method_labels, speed_vals, color=highlight, edgecolor='white', linewidth=1.5)

for bar, val in zip(bars, speed_vals):
    ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.3,
            f'{val}ms', ha='center', va='bottom', fontweight='bold', fontsize=11)

ax.set_ylabel('Average Execution Time (ms)', fontsize=12)
ax.set_title('Algorithm Speed Comparison\n(Average across all test cases)', fontsize=13, fontweight='bold')
ax.set_facecolor('#f8f9ff')
fig.patch.set_facecolor('white')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
plt.tight_layout()
plt.savefig('evaluation_graphs/graph2_speed.png', dpi=150, bbox_inches='tight')
plt.close()
print("✅ Graph 2 saved: evaluation_graphs/graph2_speed.png")

# ============================================================
# GRAPH 3 — Precision, Recall and F1 Grouped Bar Chart
# ============================================================

x = np.arange(len(method_labels))
width = 0.25

precision_vals = [avg_results[m]['precision'] for m in methods]
recall_vals    = [avg_results[m]['recall']    for m in methods]
f1_vals        = [avg_results[m]['f1']        for m in methods]

fig, ax = plt.subplots(figsize=(11, 6))

bars1 = ax.bar(x - width, precision_vals, width, label='Precision', color='#74c0fc', edgecolor='white')
bars2 = ax.bar(x,         recall_vals,    width, label='Recall',    color='#63e6be', edgecolor='white')
bars3 = ax.bar(x + width, f1_vals,        width, label='F1 Score',  color='#ffa94d', edgecolor='white')

for bars in [bars1, bars2, bars3]:
    for bar in bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width() / 2, height + 0.3,
                f'{height}%', ha='center', va='bottom', fontsize=8, fontweight='bold')

ax.set_ylabel('Score (%)', fontsize=12)
ax.set_title('Precision, Recall and F1 Score by Algorithm\n(Average across all test cases)',
             fontsize=13, fontweight='bold')
ax.set_xticks(x)
ax.set_xticklabels(method_labels, fontsize=11)
ax.set_ylim(0, 115)
ax.legend(fontsize=10)
ax.set_facecolor('#f8f9ff')
fig.patch.set_facecolor('white')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
plt.tight_layout()
plt.savefig('evaluation_graphs/graph3_precision_recall_f1.png', dpi=150, bbox_inches='tight')
plt.close()
print("✅ Graph 3 saved: evaluation_graphs/graph3_precision_recall_f1.png")

# ============================================================
# GRAPH 4 — Overall Metrics Radar / Summary Bar
# ============================================================

metrics = ['Accuracy', 'Precision', 'Recall', 'F1 Score']
x = np.arange(len(metrics))
width = 0.15

fig, ax = plt.subplots(figsize=(12, 6))

for i, (method, label, color) in enumerate(zip(methods, method_labels, colors)):
    vals = [
        avg_results[method]['accuracy'],
        avg_results[method]['precision'],
        avg_results[method]['recall'],
        avg_results[method]['f1']
    ]
    offset = (i - 2) * width
    bars = ax.bar(x + offset, vals, width, label=label, color=color,
                  edgecolor='white', linewidth=1)

ax.set_ylabel('Score (%)', fontsize=12)
ax.set_title('Full Metrics Comparison Across All Algorithms',
             fontsize=13, fontweight='bold')
ax.set_xticks(x)
ax.set_xticklabels(metrics, fontsize=11)
ax.set_ylim(0, 120)
ax.legend(fontsize=10, loc='lower right')
ax.set_facecolor('#f8f9ff')
fig.patch.set_facecolor('white')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
plt.tight_layout()
plt.savefig('evaluation_graphs/graph4_full_comparison.png', dpi=150, bbox_inches='tight')
plt.close()
print("✅ Graph 4 saved: evaluation_graphs/graph4_full_comparison.png")

# ============================================================
# GRAPH 5 — Per Test Case Accuracy Line Chart
# ============================================================

test_labels = ['TC1\nPerfect Match', 'TC2\nVariation', 'TC3\nTypo', 'TC4\nLimited']

fig, ax = plt.subplots(figsize=(10, 6))

for method, label, color in zip(methods, method_labels, colors):
    lw = 3 if method == 'normalized' else 1.5
    ls = '-' if method == 'normalized' else '--'
    ax.plot(test_labels, summary[method]['accuracy'],
            marker='o', label=label, color=color,
            linewidth=lw, linestyle=ls, markersize=7)

ax.set_ylabel('Accuracy (%)', fontsize=12)
ax.set_title('Accuracy per Test Case by Algorithm',
             fontsize=13, fontweight='bold')
ax.set_ylim(0, 115)
ax.legend(fontsize=10)
ax.set_facecolor('#f8f9ff')
fig.patch.set_facecolor('white')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.grid(axis='y', alpha=0.3)
plt.tight_layout()
plt.savefig('evaluation_graphs/graph5_accuracy_per_testcase.png', dpi=150, bbox_inches='tight')
plt.close()
print("✅ Graph 5 saved: evaluation_graphs/graph5_accuracy_per_testcase.png")

print("\n✅ All 5 graphs saved to evaluation_graphs/ folder")