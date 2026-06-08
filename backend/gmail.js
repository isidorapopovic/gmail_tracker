import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

export function createOAuthClient() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
}

export function getAuthUrl(oAuth2Client) {
    return oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/gmail.readonly"],
        prompt: "consent",
    });
}

const JOB_QUERIES = [
    '"thank you for applying" OR "thanks for applying" OR "application received"',
    '"your application" ("under review" OR "reviewed" OR "not moving forward" OR interview OR offer)',
    'subject:("application" OR "interview" OR "offer" OR "candidate" OR "next steps")',
    '"coding challenge" OR "technical assessment" OR "take-home"',
    'from:(greenhouse.io OR lever.co OR ashbyhq.com OR workday.com OR smartrecruiters.com OR jobvite.com OR icims.com)',
    'subject:("hiring" OR "position" OR "role" OR "opportunity")',
];

function decodeBase64Url(data = "") {
    try {
        return Buffer.from(
            data.replace(/-/g, "+").replace(/_/g, "/"),
            "base64"
        ).toString("utf8");
    } catch {
        return "";
    }
}

function stripHtml(html = "") {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

function findPart(payload, mimeType) {
    if (!payload) return null;

    if (payload.mimeType === mimeType && payload.body?.data) {
        return payload;
    }

    for (const part of payload.parts || []) {
        const found = findPart(part, mimeType);
        if (found) return found;
    }

    return null;
}

function getEmailBody(message) {
    const payload = message.payload;

    const plain = findPart(payload, "text/plain");
    if (plain?.body?.data) {
        return decodeBase64Url(plain.body.data)
            .replace(/\s+/g, " ")
            .trim();
    }

    const html = findPart(payload, "text/html");
    if (html?.body?.data) {
        return stripHtml(decodeBase64Url(html.body.data));
    }

    if (payload?.body?.data) {
        return decodeBase64Url(payload.body.data)
            .replace(/\s+/g, " ")
            .trim();
    }

    return message.snippet || "";
}

function getHeader(msg, name) {
    return (
        msg.payload?.headers?.find(
            (h) => h.name.toLowerCase() === name.toLowerCase()
        )?.value || ""
    );
}

export async function fetchJobEmails(accessToken) {
    const auth = createOAuthClient();
    auth.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: "v1", auth });

    const threadIds = new Set();
    const allThreads = [];

    for (const query of JOB_QUERIES) {
        try {
            let pageToken = null;

            do {
                const res = await gmail.users.messages.list({
                    userId: "me",
                    q: query,
                    maxResults: 50,
                    pageToken,
                });

                const messages = res.data.messages || [];

                for (const msg of messages) {
                    if (!threadIds.has(msg.threadId)) {
                        threadIds.add(msg.threadId);
                        allThreads.push(msg.threadId);
                    }
                }

                pageToken = res.data.nextPageToken;
            } while (pageToken && allThreads.length < 250);
        } catch (err) {
            console.error(`Query failed: ${query}`, err.message);
        }
    }

    const threads = [];

    for (const threadId of allThreads.slice(0, 250)) {
        try {
            const thread = await gmail.users.threads.get({
                userId: "me",
                id: threadId,
                format: "full",
                metadataHeaders: ["Subject", "From", "Date", "Reply-To"],
            });

            const messages = thread.data.messages || [];
            if (messages.length === 0) continue;

            const latest = messages[messages.length - 1];

            const getHeader = (msg, name) =>
                msg.payload?.headers?.find(
                    (h) => h.name.toLowerCase() === name.toLowerCase()
                )?.value || "";

            const getMessageDate = (msg) => {
                // Gmail internalDate is milliseconds since epoch and is more reliable
                // for sorting than parsing the Date header.
                if (msg.internalDate) {
                    return new Date(Number(msg.internalDate)).toISOString();
                }

                const headerDate = getHeader(msg, "Date");
                const parsed = new Date(headerDate);

                return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
            };

            threads.push({
                threadId,
                subject: getHeader(latest, "Subject"),
                from: getHeader(latest, "From"),
                date: getMessageDate(latest),
                snippet: latest.snippet || "",
                messageCount: messages.length,
            });
        } catch (err) {
            console.error(`Thread fetch failed: ${threadId}`, err.message);
        }
    }

    return threads;
}