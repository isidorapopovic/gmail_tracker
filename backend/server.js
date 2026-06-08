import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createOAuthClient, getAuthUrl, fetchJobEmails } from "./gmail.js";
import { classifyEmail } from "./classifier.js";
import {
    initDB, upsertJob, getAllJobs, updateJobNotes,
    updateJobStatus, deleteJob, getStats, logSync,
} from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cors({
    origin: [
        process.env.FRONTEND_URL || "http://localhost:5173",
        "http://localhost:5173",
    ],
    credentials: true,
}));

await initDB();

// Simple in-memory token store (keyed by a random token we generate)
const tokenStore = new Map();

function makeToken() {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function getGmailTokens(req) {
    const auth = req.headers.authorization;
    if (!auth) return null;
    const token = auth.replace("Bearer ", "");
    return tokenStore.get(token) || null;
}

// ─── Auth ─────────────────────────────────────────────────────────────────

app.get("/auth/google", (req, res) => {
    const oAuth2Client = createOAuthClient();
    res.redirect(getAuthUrl(oAuth2Client));
});

app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("Missing code");
    try {
        const oAuth2Client = createOAuthClient();
        const { tokens } = await oAuth2Client.getToken(code);
        const appToken = makeToken();
        tokenStore.set(appToken, tokens);
        const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
        res.redirect(`${frontend}?token=${appToken}`);
    } catch (err) {
        console.error("Auth callback error:", err);
        res.status(500).send("Authentication failed");
    }
});

app.get("/auth/status", (req, res) => {
    const tokens = getGmailTokens(req);
    res.json({ authenticated: !!tokens });
});

app.post("/auth/logout", (req, res) => {
    const auth = req.headers.authorization;
    if (auth) tokenStore.delete(auth.replace("Bearer ", ""));
    res.json({ ok: true });
});

// ─── Sync ─────────────────────────────────────────────────────────────────

app.post("/sync", async (req, res) => {
    const tokens = getGmailTokens(req);

    console.log("SYNC AUTH:", {
        hasTokens: !!tokens,
        hasAccessToken: !!tokens?.access_token,
        hasRefreshToken: !!tokens?.refresh_token,
    });

    if (!tokens) return res.status(401).json({ error: "Not authenticated" });

    try {
        const threads = await fetchJobEmails(tokens);

        console.log("SYNC RESULT:", {
            threadsFound: threads.length,
        });

        let added = 0;
        let updated = 0;
        let ignored = 0;

        for (const thread of threads) {
            const classified = classifyEmail(thread);

            if (!classified) {
                ignored++;
                continue;
            }

            const result = await upsertJob(classified);

            if (result?.inserted) {
                added++;
            } else {
                updated++;
            }
        }

        await logSync(threads.length, added, updated, ignored);

        res.json({
            ok: true,
            emailsFound: threads.length,
            jobsAdded: added,
            jobsUpdated: updated,
            jobsIgnored: ignored,
        });
    } catch (err) {
        console.error("Sync error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ─── Jobs ─────────────────────────────────────────────────────────────────

app.get("/jobs", async (req, res) => {
    try { res.json(await getAllJobs()); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch("/jobs/:id/notes", async (req, res) => {
    try { res.json((await updateJobNotes(req.params.id, req.body.notes))[0]); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch("/jobs/:id/status", async (req, res) => {
    const valid = ["applied", "reviewing", "interview", "offer", "rejected", "unknown"];
    if (!valid.includes(req.body.status)) return res.status(400).json({ error: "Invalid status" });
    try { res.json((await updateJobStatus(req.params.id, req.body.status))[0]); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/jobs/:id", async (req, res) => {
    try { await deleteJob(req.params.id); res.json({ ok: true }); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Stats ────────────────────────────────────────────────────────────────

app.get("/stats", async (req, res) => {
    try { res.json(await getStats()); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));