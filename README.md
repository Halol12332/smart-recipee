# Smart Recipee: Web Application & AI Backend 🍳📱

This repository contains the core web application and backend API for **Smart Recipee**, an AI-powered smart recipe recommendation system developed for a Final Year Project (FYP). 

It integrates a custom computer vision pipeline (RT-DETR for ingredient detection & YOLOv8n-cls for freshness classification) with a Flask-based recommendation engine to provide users with zero-waste meal ideas based on their actual fridge contents.

---

## 🏗️ System Architecture

The application is built on a 2-pillar architecture:
1. **Frontend UI:** HTML/CSS/JS interface featuring an interactive meal planner, recipe history, and an LLM-powered cooking assistant.
2. **Backend & AI API:** A Python Flask backend that manages a localized database of ~100 Malaysian, Chinese, and Indian recipes. It handles user image uploads, processes them through the YOLO/RT-DETR inference scripts, and executes the recipe matching logic.

---

## 📂 Project Structure

```text
smart_recipee_v2/
├── backend/                  # Core Flask & Inference API
│   ├── data/                 # Localized recipe JSON databases
│   ├── models/               # Model weights directory (weights excluded via gitignore)
│   ├── utils/                # Detection adapter, recipe filter, and fuzzy matcher
│   ├── app.py                # Main Flask web application
│   ├── detect_api.py         # FastAPI service for computer vision inference
│   └── preprocess.py         # Image normalization and enhancement logic
│
├── frontend/                 # User Interface
│   ├── css/                  # Stylesheets
│   ├── images/               # UI Assets
│   ├── js/                   # Client-side routing and logic
│   └── *.html                # Application views (browse, detail, planner, etc.)
│
├── README.md                 # Project documentation
└── requirements.txt          # Python dependencies
```
🚀 Getting Started
Prerequisites
Ensure you have Python 3.9+ installed.

Installation
Clone the repository:

```Bash
git clone https://github.com/Halol12332/smart-recipee.git
cd smart-recipee
```
Install the required dependencies:

```Bash
pip install -r requirements.txt
```
Running the Application
Start the main Flask backend:

```Bash
python backend/app.py
(The server will typically run on http://127.0.0.1:5000)
```
