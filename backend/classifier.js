// ─── Normalise ───────────────────────────────────────────────────────────────

function normalise(text = "") {
    return text
        .replace(/\s+/g, " ")
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        .toLowerCase()
        .trim();
}

// ─── Status Classification ───────────────────────────────────────────────────

const RULES = {
    offer: [
        [/offer letter/i, 8],
        [/offer of employment/i, 8],
        [/pleased to (offer|extend an offer)/i, 8],
        [/we('d| would) like to offer you/i, 8],
        [/formal offer/i, 7],
        [/job offer/i, 6],
        [/extend.*offer/i, 6],
        [/congratulations.*offer/i, 6],
        [/accept.*offer/i, 5],
        [/start date/i, 3],
        [/compensation package/i, 4],
        [/salary.*offer/i, 5],
    ],
    rejected: [
        [/will not be moving forward/i, 9],
        [/not moving forward with your/i, 9],
        [/decided (not to|to not) move/i, 8],
        [/not selected for/i, 8],
        [/not be proceeding/i, 8],
        [/filled the position/i, 7],
        [/gone with another candidate/i, 7],
        [/pursued other candidates/i, 7],
        [/not a (good )?match/i, 7],
        [/regret to (inform|let you know)/i, 6],
        [/position has been filled/i, 7],
        [/no longer (moving|considering)/i, 7],
        [/after careful consideration/i, 4],
        [/we appreciate your interest.*however/i, 5],
        [/other candidates (more closely|better)/i, 6],
        [/unfortunately.*not/i, 4],
        [/unfortunately/i, 2],
    ],
    interview: [
        [/schedule.{0,30}(interview|call|meeting|chat)/i, 8],
        [/invite you.{0,30}(interview|call)/i, 8],
        [/like to (speak|talk|chat) with you/i, 7],
        [/next (round|stage|step).{0,30}(interview|call)/i, 7],
        [/phone (screen|interview)/i, 7],
        [/video (interview|call)/i, 7],
        [/technical (interview|assessment|screen)/i, 7],
        [/coding (challenge|assessment|test)/i, 7],
        [/take.?home (assignment|test|project)/i, 7],
        [/on.?site interview/i, 7],
        [/moved (forward|to the next)/i, 6],
        [/shortlisted for/i, 6],
        [/would like to (meet|connect)/i, 5],
        [/availability.{0,40}(call|chat|meeting)/i, 5],
        [/calendly/i, 5],
        [/book.{0,20}(time|slot|call)/i, 4],
        [/interview/i, 3],
    ],
    reviewing: [
        [/application is (under|being) review/i, 7],
        [/currently reviewing/i, 7],
        [/shortlisted/i, 6],
        [/under consideration/i, 6],
        [/carefully (reviewing|considering)/i, 6],
        [/your application.*progressed/i, 6],
        [/moved to the (next|review)/i, 5],
        [/in our (review|selection) process/i, 5],
        [/keep your (application|cv|resume) on file/i, 4],
    ],
    applied: [
        [/application (has been |successfully )?(received|submitted|confirmed)/i, 7],
        [/thank you for (applying|your application)/i, 7],
        [/thanks for (applying|your interest)/i, 7],
        [/successfully (applied|submitted)/i, 7],
        [/we('ve| have) received your application/i, 7],
        [/your application.*has been (received|submitted)/i, 7],
        [/application confirmation/i, 6],
        [/we'll (review|be in touch)/i, 4],
    ],
};

// Phrases that cancel out false positives
const CANCELLERS = [
    { pattern: /unfortunately.{0,80}(reschedule|delay|postpone)/i, penalise: "rejected", boost: "interview", amount: 4 },
    { pattern: /cannot (offer|provide)/i, penalise: "offer", boost: "rejected", amount: 5 },
    { pattern: /unable to offer/i, penalise: "offer", boost: "rejected", amount: 5 },
    { pattern: /not able to offer/i, penalise: "offer", boost: "rejected", amount: 5 },
    { pattern: /thank you.*application.*unfortunately/i, penalise: null, boost: "rejected", amount: 3 },
    { pattern: /keep.*on file/i, penalise: "rejected", boost: "reviewing", amount: 4 },
];

function classifyStatus(subject = "", snippet = "", body = "") {
    const text = normalise(`${subject} ${snippet} ${body}`);
    const scores = { offer: 0, rejected: 0, interview: 0, reviewing: 0, applied: 0 };

    // Score each status
    for (const [status, rules] of Object.entries(RULES)) {
        for (const [regex, weight] of rules) {
            if (regex.test(text)) scores[status] += weight;
        }
    }

    // Apply cancellers
    for (const { pattern, penalise, boost, amount } of CANCELLERS) {
        if (pattern.test(text)) {
            if (penalise) scores[penalise] = Math.max(0, scores[penalise] - amount);
            if (boost) scores[boost] += amount;
        }
    }

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [bestStatus, bestScore] = sorted[0];

    if (bestScore < 4) return { status: "unknown", confidence: 0 };

    return {
        status: bestStatus,
        confidence: Math.min(Math.round(bestScore / 2), 10),
    };
}

// ─── Company Extraction ───────────────────────────────────────────────────────

const GENERIC_DOMAINS = new Set([
    "gmail", "yahoo", "outlook", "hotmail", "mail", "icloud", "proton",
    "lever", "greenhouse", "workday", "ashbyhq", "jobvite", "icims",
    "smartrecruiters", "myworkdayjobs", "workdayjobs", "taleo", "jobvite",
    "notifications", "email", "noreply", "no-reply", "careers", "jobs",
    "recruiting", "talent", "hire", "apply", "workable", "breezy", "jazz",
]);

const GENERIC_NAMES = new Set([
    "team", "recruiting", "talent", "careers", "hr", "jobs", "no-reply",
    "noreply", "notifications", "hello", "info", "support", "hiring",
]);

function titleCase(str) {
    return str
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
}

function cleanCompanyName(raw = "") {
    const cleaned = raw
        .replace(/\s*(team|recruiting|talent|careers|hr|jobs|no.?reply)\s*/gi, " ")
        .replace(/[<>"']/g, "")
        .replace(/\s+/g, " ")
        .replace(/[.,\-–:]+$/g, "")
        .trim();

    if (!cleaned || cleaned.length < 2) return null;
    if (GENERIC_NAMES.has(cleaned.toLowerCase())) return null;
    return cleaned;
}

function extractCompany(from = "", subject = "", body = "", replyTo = "") {
    const allText = `${from} ${replyTo} ${subject} ${body}`;

    // 1. ATS subdomain patterns (most reliable)
    const atsPatterns = [
        /jobs\.lever\.co\/([a-z0-9-]+)/i,
        /boards\.greenhouse\.io\/([a-z0-9-]+)/i,
        /job-boards\.greenhouse\.io\/([a-z0-9-]+)/i,
        /([\w-]+)\.greenhouse\.io/i,
        /([\w-]+)\.lever\.co/i,
        /([\w-]+)\.ashbyhq\.com/i,
        /([\w-]+)\.workdayjobs\.com/i,
        /([\w-]+)\.myworkdayjobs\.com/i,
        /([\w-]+)\.jobvite\.com/i,
        /([\w-]+)\.workable\.com/i,
        /([\w-]+)\.breezy\.hr/i,
    ];

    for (const pattern of atsPatterns) {
        const match = allText.match(pattern);
        if (match?.[1] && !GENERIC_DOMAINS.has(match[1].toLowerCase())) {
            return titleCase(match[1]);
        }
    }

    // 2. Subject line patterns
    const subjectPatterns = [
        /(?:application|applied)\s+(?:to|at)\s+([A-Z][A-Za-z0-9&.\- ]{2,50})(?=\s*[-–,.]|\s+for|\s*$)/,
        /thank you for applying to\s+([A-Z][A-Za-z0-9&.\- ]{2,50})(?=\s*[-–,.]|\s*$)/i,
        /(?:position|role|job)\s+at\s+([A-Z][A-Za-z0-9&.\- ]{2,50})(?=\s*[-–,.]|\s*$)/i,
        /your\s+([A-Z][A-Za-z0-9&.\- ]{2,50})\s+application/,
        /from\s+([A-Z][A-Za-z0-9&.\- ]{2,50})\s+(?:recruiting|talent|careers)/i,
    ];

    for (const pattern of subjectPatterns) {
        const match = `${subject} ${body}`.match(pattern);
        if (match?.[1]) {
            const name = cleanCompanyName(match[1]);
            if (name) return name;
        }
    }

    // 3. Sender email domain
    const emailMatch = from.match(/@([\w.-]+)/);
    if (emailMatch) {
        const host = emailMatch[1].toLowerCase();
        const parts = host.split(".");
        // Try second-level domain first (e.g. "stripe" from "jobs.stripe.com")
        const candidates = parts.length > 2
            ? [parts[parts.length - 2], parts[0]]
            : [parts[0]];

        for (const candidate of candidates) {
            if (!GENERIC_DOMAINS.has(candidate) && candidate.length > 2) {
                return titleCase(candidate);
            }
        }
    }

    // 4. Sender display name
    const nameMatch = from.match(/^"?([^"<@\n]{2,50})"?\s*</);
    if (nameMatch) {
        const name = cleanCompanyName(nameMatch[1]);
        if (name) return name;
    }

    return "Unknown Company";
}

// ─── Role Extraction ──────────────────────────────────────────────────────────

const BAD_ROLE_WORDS = /^(application|candidate|company|interview|offer|status|update|thank|unfortunately|received|submitted|position|role|job|your|our)$/i;

function cleanRole(raw = "") {
    const role = raw
        .replace(/\s+/g, " ")
        .replace(/^(the|a|an)\s+/i, "")
        .replace(/[.,\-–:]+$/g, "")
        .trim();

    if (!role || role.length < 3 || role.length > 80) return null;
    if (BAD_ROLE_WORDS.test(role)) return null;
    if (/thank you|unfortunately|received|submitted/i.test(role)) return null;
    return role;
}

function extractRole(subject = "", body = "") {
    const text = `${subject}\n${body}`;

    const patterns = [
        // "application for Software Engineer at Stripe"
        /application\s+for\s+(?:the\s+)?[""]?([^""\n]{3,80}?)[""]?\s+(?:at|with|role|position)/i,
        // "Software Engineer - Application Received"
        /^([A-Za-z0-9\s\/+#.&-]{3,60})\s*[-–|]\s*(?:application|your application)/i,
        // "Your application to Stripe for Software Engineer"
        /\bfor\s+(?:the\s+)?([A-Za-z0-9\s\/+#.&()-]{3,60})\s+(?:role|position|job)\b/i,
        // "Re: Software Engineer"
        /^re:\s*([A-Za-z0-9\s\/+#.&()-]{3,60})\s*$/im,
        // "Position: Software Engineer"
        /(?:position|role|job)[:\s]+([A-Za-z0-9\s\/+#.&()-]{3,60})(?:\n|$)/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
            const role = cleanRole(match[1]);
            if (role) return role;
        }
    }

    return "Unknown Role";
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function classifyEmail(thread) {
    const {
        subject = "",
        from = "",
        replyTo = "",
        snippet = "",
        body = "",
        date,
        threadId,
    } = thread;

    const { status, confidence } = classifyStatus(subject, snippet, body);
    const company = extractCompany(from, subject, body, replyTo);
    const role = extractRole(subject, body);

    return {
        company,
        role,
        status,
        email_subject: subject,
        email_snippet: snippet?.slice(0, 300),
        sender: from,
        thread_id: threadId,
        applied_date: (() => {
            const d = new Date(date);
            return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
        })(),
        parser_confidence: confidence,
    };
}