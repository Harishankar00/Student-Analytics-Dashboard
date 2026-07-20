# Student Analytics & Coding Performance Dashboard

A full-stack, AI-powered analytics platform designed for students, educators, and mentors to track, analyze, and optimize technical growth across major coding and data science platforms in real time.

---

## 🌟 Key Features

### 📊 Multi-Platform Live Integration
- **GitHub Integration**: Tracks total commits across the year, active repository counts, current contribution streaks, and displays high-commit repositories.
- **LeetCode Analytics**: Monitors total problems solved with difficulty breakdowns (Easy, Medium, Hard), submission calendar activity, and skill category distributions (Arrays, Linked Lists, Hash Tables, DP, etc.).
- **Kaggle Portfolio**: Synchronizes dataset publications, notebook creations, user profile badges (Novice, Contributor, Expert, Master, Grandmaster), and competition medal tallies (Gold, Silver, Bronze).

### 🎯 Multi-Dimensional Analytics Engine
- Computes weighted competency scores across 4 key dimensions:
  - **Problem Solving** (LeetCode difficulty & problem volume)
  - **Development Activity** (GitHub commits & repository count)
  - **Data Science** (Kaggle datasets, notebooks & medals)
  - **Consistency Score** (Active submission streaks & regular platform activity)
- Visualizes student proficiency via interactive Radar Charts and progress indicators.

### 🤖 AI Coding Coach & Cohort Advisor
- Integrated with **Gemini AI** to generate personalized progress summaries and actionable improvement steps.
- Intelligent **AI Cache System** to minimize API token consumption and optimize response latency.
- Class-wide **AI Cohort Advisor** for instructors to identify skill gaps and class trends.

### 👥 Admin Analytics Portal
- **Multi-Student Comparison**: Select multiple students via checkboxes for multi-student comparison matrixes and visual cohort benchmarks.
- **Class Metrics Overview**: Class average activity, link ratio metrics, and student directory overview.

### 📄 Executive PDF Report Generation
- **One-Click PDF Export**: Download formatted, print-ready PDF summary reports for both individual student profiles and class cohort overviews without relying on third-party canvas dependencies.

### 🔄 Real-Time & Background Synchronization
- Manual **Sync Profiles** button for instant metric updates.
- Background snapshot engine running every 12 hours to store historical snapshots in Cloud Firestore whenever metric changes occur.

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 18 (built with Vite)
- **Data Visualization**: Recharts (Area Charts, Pie Charts, Radar Charts)
- **Styling**: Modern Vanilla CSS Design System with responsive layouts & glassmorphism accents

### Backend
- **Framework**: Python Flask
- **Database**: Firebase Cloud Firestore (via `firebase-admin` SDK)
- **Authentication**: Firebase Authentication (Email/Password)
- **AI Integration**: Google Gemini API (`gemini-1.5-flash`)

---

## 📁 Project Structure

```text
Student-Analytics-Dashboard/
├── backend/
│   ├── app.py                      # Core Flask API & Background Snapshot Worker
│   ├── firebase_config.py          # Firebase Admin SDK initialization
│   ├── requirements.txt            # Python dependencies
│   ├── .env                        # Environment variables (API Keys)
│   └── serviceAccountKey.json      # Firebase Admin Service Account Key
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── App.jsx                 # Main React Dashboard & Admin Portal
│       ├── App.css                 # Application styling
│       ├── firebase.js             # Client Firebase initialization
│       └── main.jsx
├── docs/
│   └── PROJECT_ROADMAP.md          # Development roadmap & status tracker
└── README.md                       # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher) & `npm`
- **Python** (v3.9 or higher)
- **Firebase Project** (with Firestore & Authentication enabled)
- **Gemini API Key** (from Google AI Studio)

---

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables in `backend/.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

5. Place your Firebase Service Account JSON file as `serviceAccountKey.json` inside the `backend/` folder:
   ```bash
   cp /path/to/your-firebase-key.json serviceAccountKey.json
   ```

6. Start the Flask backend server:
   ```bash
   python3 app.py
   ```
   *The server will run on `http://127.0.0.1:5000`.*

---

### 2. Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install npm dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The application will be accessible at `http://localhost:5173`.*

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/student/<email>` | Retrieves student profile, platform metrics & evaluations |
| `POST` | `/api/register` | Registers a student profile & links platform usernames |
| `POST` | `/api/student/<email>/sync` | Triggers a real-time sync of GitHub, LeetCode & Kaggle data |
| `GET` | `/api/student/<email>/ai-summary` | Fetches or generates cached AI coding coach recommendations |
| `GET` | `/api/student/<email>/history` | Fetches historical snapshots for timeline charting |
| `GET` | `/api/student/<email>/goals` | Fetches active student goals |
| `POST` | `/api/student/<email>/goals` | Creates a new performance goal target |
| `DELETE` | `/api/student/<email>/goals/<id>` | Deletes an active goal |
| `GET` | `/api/cohort` | Fetches overall class metrics & all student profiles for admin portal |
| `GET` | `/api/admin/ai-summary` | Generates AI cohort level improvement insights for instructors |
| `POST` | `/api/kaggle-upload` | Uploads Kaggle API JSON key for dataset & kernel queries |

---

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).