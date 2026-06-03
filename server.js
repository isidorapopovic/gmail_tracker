import express from "express";
import session from "express-session";
import cors from "cors";
import dotenv from "dotenv";
import { createOAuthClient, getAuthUrl, fetchJobEmails } from "./gmail.js";
import { classifyEmail } from "./classifier.js";
import {
  initDB,
  upsertJob,
  getAllJobs,
  updateJobNotes,
  updateJobStatus,
  deleteJob,
  getStats,
  logSync,
} from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set true in production with HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// Init DB on startup
await initDB();

// ─── Auth Routes ────────────────────────────────────────────────────────────

// Step 1: Redirect to Google
app.get("/auth/google", (req, res) => {
  const oAuth2Client = createOAuthClient();
  const url = getAuthUrl(oAuth2Client);
  res.redirect(url);
});

// Step 2: Google calls back with code
app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Missing code");

  try {
    const oAuth2Client = createOAuthClient();
    const { tokens } = await oAuth2Client.getToken(code);
    req.session.tokens = tokens;
    res.redirect(process.env.FRONTEND_URL || "http://localhost:5173");
  } catch (err) {
    console.error("Auth callback error:", err);
    res.status(500).send("Authentication failed");
  }
});

// Check auth status
app.get("/auth/status", (req, res) => {
  res.json({ authenticated: !!req.session.tokens });
});

// Logout
app.post("/auth/logout", (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// ─── Sync Route ──────────────────────────────────────────────────────────────

app.post("/sync", async (req, res) => {
  if (!req.session.tokens) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    console.log("🔄 Starting Gmail sync...");
    const threads = await fetchJobEmails(req.session.tokens.access_token);
    console.log(`📧 Found ${threads.length} job-related threads`);

    let added = 0;
    let updated = 0;

    for (const thread of threads) {
      const classified = classifyEmail(thread);
      const result = await upsertJob(classified);
      if (result?.inserted) added++;
      else updated++;
    }

    await logSync(threads.length, added, updated);

    console.log(`✅ Sync complete: ${added} added, ${updated} updated`);
    res.json({
      ok: true,
      emailsFound: threads.length,
      jobsAdded: added,
      jobsUpdated: updated,
    });
  } catch (err) {
    console.error("Sync error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Jobs CRUD ───────────────────────────────────────────────────────────────

app.get("/jobs", async (req, res) => {
  try {
    const jobs = await getAllJobs();
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/jobs/:id/notes", async (req, res) => {
  const { notes } = req.body;
  try {
    const updated = await updateJobNotes(req.params.id, notes);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/jobs/:id/status", async (req, res) => {
  const { status } = req.body;
  const validStatuses = ["applied", "reviewing", "interview", "offer", "rejected", "unknown"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  try {
    const updated = await updateJobStatus(req.params.id, status);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/jobs/:id", async (req, res) => {
  try {
    await deleteJob(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Stats ───────────────────────────────────────────────────────────────────

app.get("/stats", async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
