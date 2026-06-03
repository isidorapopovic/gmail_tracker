# Job Application Tracker — Gmail + Neon

A full-stack app that scans your Gmail for job application emails and tracks them in a Neon (PostgreSQL) database.

---

## Project Structure

```
job-tracker/
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── db.js               # Neon DB connection + schema
│   ├── gmail.js            # Gmail API helpers
│   ├── classifier.js       # Email → status classifier
│   └── server.js           # Express API routes
├── frontend/
│   ├── package.json
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js           # Axios calls to backend
│       └── components/
│           ├── Dashboard.jsx
│           ├── JobTable.jsx
│           ├── StatsBar.jsx
│           └── SyncButton.jsx
└── README.md
```

---

## Setup Instructions

### 1. Google Cloud Console
1. Go to https://console.cloud.google.com
2. Create a new project (e.g. "Job Tracker")
3. Go to **APIs & Services → Library** → Enable **Gmail API**
4. Go to **APIs & Services → OAuth Consent Screen**
   - User type: External
   - Add scope: `https://www.googleapis.com/auth/gmail.readonly`
5. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3001/auth/callback`
6. Copy your **Client ID** and **Client Secret**

### 2. Neon Database
1. Go to https://neon.tech and create a free account
2. Create a new project and database
3. Copy the **connection string** (looks like `postgresql://user:pass@host/dbname?sslmode=require`)

### 3. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Fill in your .env values
node server.js
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 5. First Run
1. Open http://localhost:5173
2. Click **Connect Gmail**
3. Authorize with your Google account
4. Click **Sync Emails** — the app will scan your inbox and populate the tracker

---

## How It Works

1. **OAuth Flow**: Backend redirects to Google, gets an access token, stores it in the session
2. **Gmail Sync**: Searches your inbox using Gmail API queries for job-related emails
3. **Classification**: Each email thread is classified by status (Applied, Interview, Offer, Rejected, etc.) using keyword matching on subject + snippet
4. **Deduplication**: Groups by company name extracted from sender domain — avoids duplicate entries
5. **Storage**: All jobs stored in Neon PostgreSQL, synced on demand

---

## Status Classification Logic

| Status       | Keywords / Signals                                      |
|-------------|----------------------------------------------------------|
| 📨 Applied   | "application received", "thank you for applying"        |
| 👀 In Review | "under review", "being considered", "next steps"        |
| 📅 Interview | "interview", "schedule a call", "speak with you"        |
| ✅ Offer     | "offer", "pleased to inform", "congratulations"         |
| ❌ Rejected  | "unfortunately", "not moving forward", "other candidates"|
| ❓ Unknown   | Doesn't match any pattern                               |
