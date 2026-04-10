# Smart Recipee: Web Application & AI Backend 🍳📱

This repository contains the core web application and backend API for **Smart Recipee**, an AI-powered smart recipe recommendation system developed for a Final Year Project (FYP). 

It integrates a custom computer vision pipeline (RT-DETR for ingredient detection & YOLOv8n-cls for freshness classification) with a backend recommendation engine to provide users with zero-waste meal ideas based on their actual fridge contents.

## ✨ Key Features
* **Multi-Ingredient Detection:** Real-time identification of 30 different refrigerator ingredients using a fine-tuned RT-DETR Vision Transformer.
* **Freshness Interception:** Automatically flags spoiled ingredients using YOLOv8n-cls and visually sanitizes the output (Orange warning boxes) to prevent unsafe recipe recommendations.
* **Active Learning (HITL):** Features an interactive HTML5 Canvas that allows users to manually draw missing bounding boxes and correct AI predictions using a strictly controlled dropdown, feeding high-quality data back into the pipeline.
* **Smart Meal Planner:** Generates localized recipe recommendations (Malaysian, Chinese, and Indian cuisines) based on confirmed fridge inventory.

---

## 🏗️ System Architecture

The application is built on a decoupled 2-pillar architecture:
1. **Frontend UI:** Pure HTML/CSS/JS interface featuring an interactive meal planner, dynamic image slicing (Canvas API), recipe history, and an LLM-powered cooking assistant.
2. **Backend & AI API:** A Python FastAPI/Flask backend that manages a localized JSON database of ~100 recipes. It handles user multipart image uploads, processes them through the PyTorch inference scripts, and executes the recipe matching logic.

---

## 📂 Project Structure

```text
smart_recipee/
├── backend/                  # Core API & Inference Engine
│   ├── data/                 # Localized recipe JSON databases
│   ├── models/               # Model weights (.pt files excluded via gitignore)
│   ├── utils/                # Detection adapter, recipe filter, and fuzzy matcher
│   ├── app.py                # Main backend web application
│   ├── detect_api.py         # Service for computer vision inference
│   ├── preprocess.py         # Image normalization and enhancement logic
│   └── .env                  # Chatbot API Key Credentials  
│
├── frontend/                 # User Interface
│   ├── css/                  # Stylesheets
│   ├── images/               # UI Assets
│   ├── js/                   # Client-side routing, Canvas logic, and API calls
│   └── *.html                # Application views (browse, detail, planner, etc.)
│
├── README.md                 # Project documentation
└── requirements.txt          # Python dependencies
```
🚀 Getting Started
Prerequisites
Python 3.10+ (Recommended)

NVIDIA GPU (Optional but highly recommended for CUDA-accelerated inference)

Installation
Clone the repository:

```Bash
git clone https://github.com/Halol12332/smart-recipee.git
cd smart-recipee
```
Initialize a Virtual Environment (Crucial for dependency isolation):

```Bash
python -m venv .venv
```
* Activate on Windows: .\.venv\Scripts\activate
* Activate on Mac/Linux: source .venv/bin/activate

Install the required dependencies:

```Bash
pip install -r requirements.txt
```
Environment Variables:
Create a .env file inside the backend/ directory to configure your model thresholds (and add your Firebase/Cloud credentials if applicable):

```Code Snippet
INGREDIENT_CONF_THRESHOLD=0.25
MODEL_TYPE_DEFAULT=rt-detr
```
Running the Application
This system requires both the backend API and the frontend client to be running simultaneously.

1. **Start the Backend API:**
Open your terminal, ensure your virtual environment is activated, and run:

```Bash
python backend/app.py
```
# Note: The server will typically run on [http://127.0.0.1:5000]
2. **Start the Frontend Client:**
Open a new terminal window and run a simple HTTP server:

```Bash
cd frontend
python -m http.server 8000
```
Once both servers are running, open your web browser and navigate to http://localhost:8000.
