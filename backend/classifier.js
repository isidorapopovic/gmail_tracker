// Classify a Gmail thread into a job application entry

const STATUS_RULES = {
    offer: [
        [/offer letter/i, 6],
        [/offer of employment/i, 6],
        [/pleased to offer/i, 6],
        [/we('d| would) like to offer/i, 5],
        [/extend.*offer/i, 5],
        [/job offer/i, 5],
        [/congratulations.*offer/i, 5],
        [/congratulations/i, 2],
    ],

    rejected: [
        [/not moving forward/i, 6],
        [/will not be moving/i, 6],
        [/not selected/i, 6],
        [/decided not to/i, 5],
        [/not be proceeding/i, 5],
        [/not a match/i, 5],
        [/filled the position/i, 5],
        [/gone with another/i, 5],
        [/other candidates/i, 4],
        [/regret to inform/i, 4],
        [/we appreciate.*not/i, 3],
        [/unfortunately/i, 1],
    ],

    interview: [
        [/interview/i, 5],
        [/schedule (a|an)?\s*(call|interview|chat)/i, 6],
        [/speak with you/i, 4],
        [/chat with you/i, 4],
        [/meet with you/i, 4],
        [/next step/i, 4],
        [/technical assessment/i, 5],
        [/coding challenge/i, 5],
        [/take-home/i, 4],
        [/video call/i, 4],
        [/phone screen/i, 5],
    ],

    reviewing: [
        [/under review/i, 5],
        [/being reviewed/i, 5],
        [/carefully review/i, 4],
        [/in review/i, 4],
        [/considering your/i, 4],
        [/shortlisted/i, 5],
    ],

    applied: [
        [/application received/i, 5],
        [/thank you for applying/i, 5],
        [/thanks for applying/i, 5],
        [/application submitted/i, 5],
        [/we received your/i, 4],
        [/application has been received/i, 5],
        [/successfully applied/i, 5],
    ],
};

function normaliseText(value = "") {
    return value
        .replace(/\s+/g, " ")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .trim();
}

function classifyStatus(subject = "", snippet = "", body = "") {
    const text = normaliseText(`${subject}\n${snippet}\n${body}`);
    const scores = {};
    const reasons = {};

    for (const status of Object.keys(STATUS_RULES)) {
        scores[status] = 0;
        reasons[status] = [];
    }

    for (const [status, rules] of Object.entries(STATUS_RULES)) {
        for (const [regex, weight] of rules) {
            const match = text.match(regex);
            if (match) {
                scores[status] += weight;
                reasons[status].push(match[0]);
            }
        }
    }

    // Avoid false rejection for emails like:
    // "Unfortunately we need to reschedule your interview"
    if (/unfortunately.{0,80}(reschedule|delay|postpone|move)/i.test(text)) {
        scores.rejected -= 3;
        scores.interview += 2;
    }

    // Avoid "offer" false positives from phrases like:
    // "we cannot offer you a position"
    if (/cannot offer|unable to offer|not able to offer/i.test(text)) {
        scores.offer -= 5;
        scores.rejected += 3;
    }

    const [bestStatus, bestScore] = Object.entries(scores).sort(
        (a, b) => b[1] - a[1]
    )[0];

    if (bestScore < 3) {
        return {
            status: "unknown",
            confidence: 0,
            reason: "No strong status pattern matched",
        };
    }

    return {
        status: bestStatus,
        confidence: Math.min(bestScore, 10),
        reason: reasons[bestStatus].slice(0, 3).join(", "),
    };
}

function cleanCompany(value = "") {
    const cleaned = value
        .replace(/\s*(team|recruiting|talent|careers|hr|jobs|no.?reply)\s*/gi, " ")
        .replace(/[<>"']/g, "")
        .replace(/\s+/g, " ")
        .replace(/[.,\-–:]+$/g, "")
        .trim();

    if (!cleaned) return null;

    if (
        /^(team|recruiting|talent|careers|hr|jobs|no.?reply|notifications|hello)$/i.test(
            cleaned
        )
    ) {
        return null;
    }

    return cleaned;
}

function humaniseCompany(value = "") {
    return cleanCompany(
        value
            .replace(/[-_]+/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase())
    );
}

function extractCompany(from = "", subject = "", body = "", replyTo = "") {
    const text = `${from}\n${replyTo}\n${subject}\n${body}`;

    // ATS-specific URL/subdomain patterns
    const atsPatterns = [
        /jobs\.lever\.co\/([^/\s?#]+)/i,
        /boards\.greenhouse\.io\/([^/\s?#]+)/i,
        /job-boards\.greenhouse\.io\/([^/\s?#]+)/i,
        /([\w-]+)\.greenhouse\.io/i,
        /([\w-]+)\.lever\.co/i,
        /([\w-]+)\.ashbyhq\.com/i,
        /([\w-]+)\.workdayjobs\.com/i,
        /([\w-]+)\.myworkdayjobs\.com/i,
    ];

    for (const pattern of atsPatterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
            const company = humaniseCompany(match[1]);
            if (company) return company;
        }
    }

    // Subject/body examples:
    // "Your application to Stripe"
    // "Application for Software Engineer at Monzo"
    // "Thank you for applying to Wise"
    const companyPatterns = [
        /(?:application|applied)\s+(?:to|at)\s+([A-Z][A-Za-z0-9&.\- ]{2,60})(?:\s|$|[-–,:.])/i,
        /(?:application|applied)\s+for\s+.+?\s+at\s+([A-Z][A-Za-z0-9&.\- ]{2,60})(?:\s|$|[-–,:.])/i,
        /thank you for applying to\s+([A-Z][A-Za-z0-9&.\- ]{2,60})(?:\s|$|[-–,:.])/i,
        /(?:position|role)\s+at\s+([A-Z][A-Za-z0-9&.\- ]{2,60})(?:\s|$|[-–,:.])/i,
    ];

    for (const pattern of companyPatterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
            const company = cleanCompany(match[1]);
            if (company) return company;
        }
    }

    // Try sender domain
    const emailMatch = from.match(/@([\w.-]+)/);
    if (emailMatch) {
        const host = emailMatch[1].toLowerCase();
        const parts = host.split(".");
        const domain = parts.length > 2 ? parts[parts.length - 2] : parts[0];

        const genericDomains = new Set([
            "gmail",
            "yahoo",
            "outlook",
            "hotmail",
            "mail",
            "icloud",
            "proton",
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
        ]);

        if (!genericDomains.has(domain)) {
            const company = humaniseCompany(domain);
            if (company) return company;
        }
    }

    // Try display name
    const nameMatch = from.match(/^"?([^"<@]+)"?\s*</);
    if (nameMatch) {
        const company = cleanCompany(nameMatch[1]);
        if (company) return company;
    }

    return "Unknown Company";
}

function cleanRole(value = "") {
    const role = value
        .replace(/\s+/g, " ")
        .replace(/^(the|a|an)\s+/i, "")
        .replace(/[.,\-–:]+$/g, "")
        .trim();

    if (!role || role.length < 3 || role.length > 80) return null;

    if (
        /^(application|candidate|company|interview|offer|status|update)$/i.test(role)
    ) {
        return null;
    }

    if (/thank you|unfortunately|received|submitted/i.test(role)) {
        return null;
    }

    return role;
}

function extractRole(subject = "", body = "") {
    const text = `${subject}\n${body}`;

    const patterns = [
        /(?:application|applied)\s+(?:for|to)\s+(?:the\s+)?["“]?([^"\n“”]{3,80}?)(?:["”]?\s+(?:role|position|job)?\s*(?:at|with|[-–,.\n]))/i,
        /(?:position|role|job):\s*([^\n]{3,80})/i,
        /(?:for the)\s+([A-Za-z0-9\s\/+#.&-]{3,80})\s+(?:position|role)/i,
        /([A-Za-z0-9\s\/+#.&-]{3,80})\s+(?:position|role)\s+at/i,
        /re:\s*([A-Za-z0-9\s\/+#.&-]{3,80})\s*[-–]\s*/i,
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

function safeDate(date) {
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime())
        ? new Date().toISOString()
        : parsed.toISOString();
}

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

    const statusResult = classifyStatus(subject, snippet, body);
    const company = extractCompany(from, subject, body, replyTo);
    const role = extractRole(subject, body);

    return {
        company,
        role,
        status: statusResult.status,
        email_subject: subject,
        email_snippet: snippet?.slice(0, 300),
        sender: from,
        thread_id: threadId,
        applied_date: safeDate(date),

        // Optional DB fields added below
        parser_confidence: statusResult.confidence,
        parser_reason: statusResult.reason,
    };
}