// ─── Text Normalisation ───────────────────────────────────────────────────────

function normalise(text = "") {
    return String(text)
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[–—]/g, "-")
        .replace(/\bhttps?:\/\/\S+/gi, " ")
        .replace(/\s+/g, " ")
        .toLowerCase()
        .trim();
}

function cleanText(text = "") {
    return String(text)
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/\bhttps?:\/\/\S+/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// ─── Ignore Non-Application Emails ────────────────────────────────────────────

const IGNORE_RULES = [
    // Account/admin emails
    /reset your password/i,
    /password reset/i,
    /account created/i,
    /activate your account/i,
    /verify your email/i,
    /confirm your email/i,
    /security alert/i,
    /sign[- ]?in/i,
    /login/i,
    /two[- ]?factor/i,
    /2fa/i,

    // Newsletters/job alerts/digests
    /daily digest/i,
    /weekly digest/i,
    /job alert/i,
    /new jobs posted/i,
    /a new job may be waiting/i,
    /recommended jobs/i,
    /jobs you may be interested in/i,
    /talent community/i,
    /monthly newsletter/i,
    /unsubscribe/i,

    // Banking/documents/statements
    /bank statement/i,
    /monthly activity statement/i,
    /documents? disponible/i,
    /documents? available/i,
    /nouveau\(x\) document/i,
    /invoice/i,
    /receipt/i,
    /payment/i,
    /transaction/i,

    // Non-job admin/promotional
    /tax/i,
    /налога/i,
    /air serbia/i,
    /facebook/i,
    /twitter/i,
    /linkedin/i,
];

const STRONG_JOB_SIGNALS = [
    /thank you for applying/i,
    /thanks for applying/i,
    /thank you for your application/i,
    /thank you for your interest/i,
    /your application/i,
    /application received/i,
    /application submitted/i,
    /application confirmation/i,
    /successfully received/i,
    /successfully applied/i,
    /we have received your application/i,
    /we received your application/i,
    /your interest in/i,
    /interview/i,
    /assessment/i,
    /coding challenge/i,
    /technical test/i,
    /task result/i,
    /candidate account/i,
    /not selected/i,
    /not moving forward/i,
    /offer letter/i,
    /job offer/i,
    /role of/i,
    /position of/i,
    /hiring team/i,
];

function shouldIgnoreEmail(subject = "", snippet = "", body = "") {
    const text = normalise(`${subject} ${snippet} ${body}`);
    const hasStrongJobSignal = STRONG_JOB_SIGNALS.some((rule) => rule.test(text));

    // Keep real application emails even if they contain ATS/account words.
    if (hasStrongJobSignal) {
        const onlyAdminCandidateEmail =
            /candidate account/i.test(text) &&
            !/application|interview|assessment|task result|offer|selected|received|submitted|hiring team/i.test(text);

        if (!onlyAdminCandidateEmail) return false;
    }

    return IGNORE_RULES.some((rule) => rule.test(text));
}

// ─── Status Classification ───────────────────────────────────────────────────

const RULES = {
    offer: [
        [/offer letter/i, 8],
        [/offer of employment/i, 8],
        [/pleased to (offer|extend an offer)/i, 8],
        [/we('d| would) like to offer you/i, 8],
        [/formal offer/i, 7],
        [/job offer/i, 7],
        [/extend.{0,30}offer/i, 7],
        [/congratulations.{0,80}offer/i, 7],
        [/accept.{0,40}offer/i, 6],
        [/welcome to the team/i, 6],
        [/start date/i, 3],
        [/compensation package/i, 4],
        [/salary.{0,40}offer/i, 5],
    ],

    rejected: [
        [/will not be moving forward/i, 9],
        [/not moving forward with your/i, 9],
        [/not moving forward/i, 9],
        [/decided (not to|to not) move/i, 8],
        [/not selected for/i, 9],
        [/not selected/i, 9],
        [/was not selected/i, 9],
        [/your startup was not selected/i, 9],
        [/not be proceeding/i, 8],
        [/filled the position/i, 7],
        [/position has been filled/i, 7],
        [/gone with another candidate/i, 7],
        [/pursued other candidates/i, 7],
        [/other candidates (more closely|better)/i, 6],
        [/not a (good )?match/i, 7],
        [/regret to (inform|let you know)/i, 6],
        [/no longer (moving|considering)/i, 7],
        [/after careful consideration/i, 4],
        [/we appreciate your interest.{0,120}however/i, 5],
        [/sorry to say/i, 5],
        [/we're sorry/i, 4],
        [/we are sorry/i, 4],
        [/unfortunately.{0,120}not/i, 5],
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
        [/availability.{0,40}(call|chat|meeting|interview)/i, 5],
        [/calendly/i, 5],
        [/book.{0,20}(time|slot|call|interview)/i, 4],
        [/task result/i, 5],
        [/assessment result/i, 5],
        [/checked your answers/i, 5],
        [/complete.{0,40}(task|assessment|test)/i, 5],
        [/interview/i, 3],
    ],

    reviewing: [
        [/application is (under|being) review/i, 7],
        [/currently reviewing/i, 7],
        [/under review/i, 7],
        [/shortlisted/i, 6],
        [/under consideration/i, 6],
        [/carefully (reviewing|considering)/i, 6],
        [/your application.{0,80}progressed/i, 6],
        [/moved to the (next|review)/i, 5],
        [/in our (review|selection) process/i, 5],
        [/keep your (application|cv|resume) on file/i, 4],
        [/your details are with the hiring team/i, 6],
        [/hiring team to consider/i, 6],
    ],

    applied: [
        [/application (has been |successfully )?(received|submitted|confirmed)/i, 7],
        [/thank you for (applying|your application)/i, 7],
        [/thanks for (applying|your interest)/i, 7],
        [/successfully (applied|submitted)/i, 7],
        [/successfully received/i, 7],
        [/we('ve| have) received your application/i, 8],
        [/we received your application/i, 8],
        [/your application.{0,80}has been (received|submitted)/i, 7],
        [/your application at .* has been successfully received/i, 8],
        [/has been successfully received/i, 7],
        [/application confirmation/i, 6],
        [/dear .* thank you for your interest in/i, 5],
        [/we'll (review|be in touch)/i, 4],
    ],
};

const CANCELLERS = [
    {
        pattern: /unfortunately.{0,80}(reschedule|delay|postpone)/i,
        penalise: "rejected",
        boost: "interview",
        amount: 4,
    },
    {
        pattern: /cannot (offer|provide)/i,
        penalise: "offer",
        boost: "rejected",
        amount: 5,
    },
    {
        pattern: /unable to offer/i,
        penalise: "offer",
        boost: "rejected",
        amount: 5,
    },
    {
        pattern: /not able to offer/i,
        penalise: "offer",
        boost: "rejected",
        amount: 5,
    },
    {
        pattern: /thank you.{0,80}application.{0,120}unfortunately/i,
        penalise: null,
        boost: "rejected",
        amount: 3,
    },
    {
        pattern: /keep.{0,40}on file/i,
        penalise: "rejected",
        boost: "reviewing",
        amount: 4,
    },
];

const STATUS_PRIORITY = ["offer", "rejected", "interview", "reviewing", "applied"];

function classifyStatus(subject = "", snippet = "", body = "") {
    const text = normalise(`${subject} ${snippet} ${body}`);
    const scores = {
        offer: 0,
        rejected: 0,
        interview: 0,
        reviewing: 0,
        applied: 0,
    };

    for (const [status, rules] of Object.entries(RULES)) {
        for (const [regex, weight] of rules) {
            if (regex.test(text)) {
                scores[status] += weight;
            }
        }
    }

    for (const { pattern, penalise, boost, amount } of CANCELLERS) {
        if (pattern.test(text)) {
            if (penalise) scores[penalise] = Math.max(0, scores[penalise] - amount);
            if (boost) scores[boost] += amount;
        }
    }

    let bestStatus = "unknown";
    let bestScore = 0;

    for (const status of STATUS_PRIORITY) {
        if (scores[status] > bestScore) {
            bestStatus = status;
            bestScore = scores[status];
        }
    }

    if (bestScore < 4) {
        return {
            status: "unknown",
            confidence: 0,
        };
    }

    return {
        status: bestStatus,
        confidence: Math.min(Math.round(bestScore / 2), 10),
    };
}

// ─── Company Extraction ───────────────────────────────────────────────────────

const GENERIC_DOMAINS = new Set([
    "gmail",
    "googlemail",
    "yahoo",
    "outlook",
    "hotmail",
    "mail",
    "icloud",
    "proton",
    "protonmail",

    "lever",
    "greenhouse",
    "workday",
    "ashbyhq",
    "jobvite",
    "icims",
    "smartrecruiters",
    "myworkdayjobs",
    "workdayjobs",
    "taleo",
    "notifications",
    "email",
    "noreply",
    "no-reply",
    "careers",
    "jobs",
    "recruiting",
    "talent",
    "hire",
    "apply",
    "workable",
    "breezy",
    "jazz",
    "successfactors",
    "personio",
    "teamtailor",
]);

const GENERIC_NAMES = new Set([
    "team",
    "recruiting",
    "talent",
    "careers",
    "hr",
    "jobs",
    "no-reply",
    "noreply",
    "notifications",
    "hello",
    "info",
    "support",
    "hiring",
    "workday",
    "people services",
    "people serv",
]);

function titleCase(str = "") {
    return String(str)
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .map((word) => {
            const upper = word.toUpperCase();

            if (["EPAM", "IBM", "SAP", "UBS", "EY", "KPMG", "PwC", "Citi"].includes(upper)) {
                return upper === "CITI" ? "Citi" : upper;
            }

            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(" ");
}

function cleanCompanyName(raw = "") {
    let cleaned = cleanText(raw)
        .replace(/[<>"']/g, "")
        .replace(
            /\b(workday|greenhouse|lever|ashby|jobvite|people serv\.?|people services|careers|recruiting|talent|hr|jobs|team|no.?reply|noreply|notifications)\b/gi,
            " "
        )
        .replace(/\b\d+\b/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^[.,\-–:|\s]+|[.,\-–:|\s]+$/g, "")
        .trim();

    const knownNormalisations = {
        syneoshealth: "Syneos Health",
        "syneos health": "Syneos Health",
        beobank: "Beobank",
        clarivate: "Clarivate",
        medtronic: "Medtronic",
        philips: "Philips",
        epam: "EPAM",
        citi: "Citi",
        google: "Google",
        unilever: "Unilever",
        agfa: "Agfa",
        "y combinator": "Y Combinator",
        yc: "Y Combinator",
        "jp morgan chase": "JPMorgan Chase",
        jpmorgan: "JPMorgan Chase",
        "jpmorgan chase": "JPMorgan Chase",
        "interactive brokers": "Interactive Brokers",
    };

    const key = cleaned.toLowerCase().replace(/\s+/g, " ").trim();
    if (knownNormalisations[key]) return knownNormalisations[key];

    if (!cleaned || cleaned.length < 2) return null;
    if (GENERIC_NAMES.has(cleaned.toLowerCase())) return null;

    return titleCase(cleaned);
}

function extractDomainCandidates(from = "") {
    const emailMatch = String(from).match(/@([\w.-]+)/);
    if (!emailMatch) return [];

    const host = emailMatch[1].toLowerCase();
    const parts = host.split(".").filter(Boolean);

    if (parts.length < 2) return [];

    const candidates = [];

    // jobs.stripe.com -> stripe
    if (parts.length >= 2) {
        candidates.push(parts[parts.length - 2]);
    }

    // stripe.greenhouse.io / company.workdayjobs.com -> company
    if (parts.length >= 3) {
        candidates.push(parts[0]);
    }

    return candidates.filter(Boolean);
}

function extractCompany(from = "", subject = "", body = "", replyTo = "") {
    const allText = `${from} ${replyTo} ${subject} ${body}`;

    // 1. ATS URL/subdomain patterns
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
            const company = cleanCompanyName(match[1]);
            if (company) return company;
        }
    }

    // 2. Subject/body patterns
    const subjectPatterns = [
        /thank you for applying to\s+([A-Z][A-Za-z0-9&.'’\- ]{2,60})(?=\s*[-–,.]|\s*$)/i,
        /your application at\s+([A-Z][A-Za-z0-9&.'’\- ]{2,60})\s+has been/i,
        /your\s+([A-Z][A-Za-z0-9&.'’\- ]{2,60})\s+application/i,
        /^([A-Z][A-Za-z0-9&.'’\- ]{2,60})\s*[-–]\s+[A-Za-z].{2,80}/,
        /application\s+(?:with|at|to)\s+([A-Z][A-Za-z0-9&.'’\- ]{2,60})(?=\s*[-–,.]|\s+for|\s*$)/i,
        /interest in\s+([A-Z][A-Za-z0-9&.'’\- ]{2,60})(?=\s*[-–,.]|\s+and|\s*$)/i,
        /(?:position|role|job)\s+at\s+([A-Z][A-Za-z0-9&.'’\- ]{2,60})(?=\s*[-–,.]|\s*$)/i,
        /^([A-Z][A-Za-z0-9&.'’\- ]{2,60})\s+Workday\b/i,
    ];

    for (const pattern of subjectPatterns) {
        const match = `${subject} ${body}`.match(pattern);
        if (match?.[1]) {
            const name = cleanCompanyName(match[1]);
            if (name) return name;
        }
    }

    // 3. Sender display name, often better than generic ATS domain.
    const nameMatch = String(from).match(/^"?([^"<@\n]{2,80})"?\s*</);
    if (nameMatch) {
        const name = cleanCompanyName(nameMatch[1]);
        if (name) return name;
    }

    // 4. Sender email domain.
    const domainCandidates = extractDomainCandidates(from);
    for (const candidate of domainCandidates) {
        if (!GENERIC_DOMAINS.has(candidate) && candidate.length > 2) {
            const name = cleanCompanyName(candidate);
            if (name) return name;
        }
    }

    return "Unknown Company";
}

// ─── Role Extraction ──────────────────────────────────────────────────────────

const BAD_ROLE_WORDS =
    /^(application|candidate|company|interview|offer|status|update|thank|unfortunately|received|submitted|position|role|job|your|our|account|password)$/i;

function cleanRole(raw = "") {
    const role = cleanText(raw)
        .replace(/^(the|a|an)\s+/i, "")
        .replace(/[.,\-–:]+$/g, "")
        .trim();

    if (!role || role.length < 3 || role.length > 80) return null;
    if (BAD_ROLE_WORDS.test(role)) return null;
    if (/thank you|unfortunately|received|submitted|password|account created/i.test(role)) return null;

    return titleCase(role);
}

function extractRole(subject = "", body = "") {
    const text = `${cleanText(subject)}\n${cleanText(body).slice(0, 3000)}`;

    const patterns = [
        // "application for Software Engineer at Stripe"
        /application\s+for\s+(?:the\s+)?[""]?([^""\n]{3,80}?)[""]?\s+(?:at|with|role|position)/i,

        // "Your application to Stripe for Software Engineer"
        /application\s+(?:to|at|with)\s+[A-Za-z0-9&.'’\- ]{2,60}\s+for\s+(?:the\s+)?([A-Za-z0-9\s\/+#.&()'-]{3,80})/i,

        // "Thank you for applying for the Field Service Engineer..."
        /thank you for applying for\s+(?:the\s+)?([A-Za-z0-9\s\/+#.&()'-]{3,80})/i,

        // "Thank you for applying to the Healthcare Operations Intern role"
        /applying to\s+(?:the\s+)?([A-Za-z0-9\s\/+#.&()'-]{3,80}?)\s+(?:role|position|job)/i,

        // "Citi - Quantitative Analyst"
        /^[A-Za-z0-9&.'’\- ]{2,60}\s*[-–]\s*([A-Za-z0-9\s\/+#.&()'-]{3,80})/i,

        // "Software Engineer - Application Received"
        /^([A-Za-z0-9\s\/+#.&()'-]{3,80})\s*[-–|]\s*(?:application|your application|thank you)/i,

        // "for Software Engineer role"
        /\bfor\s+(?:the\s+)?([A-Za-z0-9\s\/+#.&()'-]{3,80})\s+(?:role|position|job)\b/i,

        // "role: Software Engineer"
        /(?:position|role|job title|job)[:\s]+([A-Za-z0-9\s\/+#.&()'-]{3,80})(?:\n|$)/i,

        // "role of Healthcare Operations & Consulting Intern"
        /role of\s+([A-Za-z0-9\s\/+#.&()'-]{3,80})(?:\s*[-–,.]|\s*$)/i,
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

// ─── Date Handling ────────────────────────────────────────────────────────────

function parseEmailDate(date) {
    if (!date) return null;

    // Gmail internalDate is usually milliseconds since epoch.
    if (/^\d+$/.test(String(date))) {
        const parsedFromMs = new Date(Number(date));
        return Number.isNaN(parsedFromMs.getTime()) ? null : parsedFromMs.toISOString();
    }

    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function classifyEmail(thread = {}) {
    const {
        subject = "",
        from = "",
        replyTo = "",
        snippet = "",
        body = "",
        date = null,
        threadId,
    } = thread;

    if (shouldIgnoreEmail(subject, snippet, body)) {
        return null;
    }

    const { status, confidence } = classifyStatus(subject, snippet, body);

    const combinedText = normalise(`${subject} ${snippet} ${body}`);
    const hasJobSignal = STRONG_JOB_SIGNALS.some((rule) => rule.test(combinedText));

    // Prevent random newsletters, statements, account emails, and bank emails
    // from becoming "Unknown Company / Unknown Role" jobs.
    if (!hasJobSignal && status === "unknown") {
        return null;
    }

    const company = extractCompany(from, subject, body, replyTo);
    const role = extractRole(subject, body);

    return {
        company,
        role,
        status,
        email_subject: cleanText(subject),
        email_snippet: cleanText(snippet || body).slice(0, 300),
        sender: from,
        thread_id: threadId,
        applied_date: parseEmailDate(date),
        parser_confidence: confidence,
    };
}

// Optional exports for testing/debugging.
export const __classifierInternals = {
    normalise,
    cleanText,
    shouldIgnoreEmail,
    classifyStatus,
    extractCompany,
    extractRole,
    parseEmailDate,
};