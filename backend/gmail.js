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
    'subject:("application received") OR subject:("thank you for applying") OR subject:("thanks for applying")',
    'subject:("interview") OR subject:("schedule a call") OR subject:("speak with you")',
    'subject:("unfortunately") OR subject:("not moving forward") OR subject:("other candidates")',
    'subject:("job offer") OR subject:("offer letter") OR subject:("pleased to offer")',
    'subject:("application status") OR subject:("your application") OR subject:("we reviewed")',
    'subject:("hiring") AND (subject:("position") OR subject:("role") OR subject:("opportunity"))',
];

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
            } while (pageToken && allThreads.length < 200);
        } catch (err) {
            console.error(`Query failed: ${query}`, err.message);
        }
    }

    const threads = [];
    for (const threadId of allThreads.slice(0, 200)) {
        try {
            const thread = await gmail.users.threads.get({
                userId: "me",
                id: threadId,
                format: "metadata",
                metadataHeaders: ["Subject", "From", "Date"],
            });

            const messages = thread.data.messages || [];
            if (messages.length === 0) continue;

            const latest = messages[messages.length - 1];
            const first = messages[0];

            const getHeader = (msg, name) =>
                msg.payload?.headers?.find(
                    (h) => h.name.toLowerCase() === name.toLowerCase()
                )?.value || "";

            threads.push({
                threadId,
                subject: getHeader(latest, "Subject"),
                from: getHeader(latest, "From"),
                date: getHeader(first, "Date"),
                snippet: latest.snippet || "",
                messageCount: messages.length,
            });
        } catch (err) {
            console.error(`Thread fetch failed: ${threadId}`, err.message);
        }
    }

    return threads;
}