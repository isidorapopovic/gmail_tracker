// Classify a Gmail thread into a job application entry

const STATUS_PATTERNS = {
    offer: [
        /job offer/i,
        /offer letter/i,
        /pleased to offer/i,
        /offer of employment/i,
        /congratulations.*offer/i,
        /we('d| would) like to offer/i,
        /extend.*offer/i,
    ],
    rejected: [
        /unfortunately/i,
        /not moving forward/i,
        /other candidates/i,
        /not selected/i,
        /decided not to/i,
        /will not be moving/i,
        /not a match/i,
        /not be proceeding/i,
        /filled the position/i,
        /gone with another/i,
        /regret to inform/i,
        /we appreciate.*not/i,
    ],
    interview: [
        /interview/i,
        /schedule a call/i,
        /speak with you/i,
        /chat with you/i,
        /meet with you/i,
        /next step/i,
        /technical assessment/i,
        /coding challenge/i,
        /take-home/i,
        /video call/i,
        /phone screen/i,
    ],
    reviewing: [
        /under review/i,
        /being reviewed/i,
        /carefully review/i,
        /in review/i,
        /considering your/i,
        /shortlisted/i,
    ],
    applied: [
        /application received/i,
        /thank you for applying/i,
        /thanks for applying/i,
        /application submitted/i,
        /we received your/i,
        /application has been received/i,
        /successfully applied/i,
    ],
};

function classifyStatus(subject, snippet) {
    const text = `${subject} ${snippet}`.toLowerCase();

    // Order matters — more specific first
    for (const [status, patterns] of Object.entries(STATUS_PATTERNS)) {
        if (patterns.some((p) => p.test(text))) return status;
    }
    return "unknown";
}

function extractCompany(from, subject) {
    // Try to get company from sender email domain
    const emailMatch = from.match(/@([\w.-]+)\./);
    if (emailMatch) {
        const domain = emailMatch[1];
        // Skip generic providers
        const generic = [
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
            "taleo",
        ];
        if (!generic.includes(domain.toLowerCase())) {
            return capitalize(domain);
        }
    }

    // Try to extract from "From" display name
    const nameMatch = from.match(/^"?([^"<@]+)"?\s*</);
    if (nameMatch) {
        const name = nameMatch[1].trim();
        // Remove common suffixes
        return name
            .replace(/\s*(team|recruiting|talent|careers|hr|no.?reply)\s*/gi, "")
            .trim();
    }

    // Try to extract from subject (e.g. "Your application to Stripe")
    const subjectMatch = subject.match(
        /(?:application to|applied to|at|from)\s+([A-Z][a-zA-Z0-9\s&.]+?)(?:\s*[-–,]|\s+for|\s+is|\s*$)/
    );
    if (subjectMatch) return subjectMatch[1].trim();

    return "Unknown Company";
}

function extractRole(subject) {
    // Common patterns: "Application for Software Engineer", "Your application - Senior PM at Stripe"
    const patterns = [
        /(?:application for|applied for|position of|role of|the\s+)?([A-Z][a-zA-Z0-9\s\/+#.-]+?)\s+(?:position|role|job|at\b)/i,
        /(?:for\s+(?:the\s+)?)([\w\s\/+#.-]+?)(?:\s+at|\s*[-–]|\s*,)/i,
        /(?:application\s*[-–:]\s*)([\w\s\/+#.-]+)/i,
    ];

    for (const p of patterns) {
        const m = subject.match(p);
        if (m && m[1].length < 60) return m[1].trim();
    }

    return null;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function classifyEmail(thread) {
    const { subject, from, snippet, date, threadId } = thread;

    const status = classifyStatus(subject, snippet);
    const company = extractCompany(from, subject);
    const role = extractRole(subject);

    return {
        company,
        role: role || "Unknown Role",
        status,
        email_subject: subject,
        email_snippet: snippet?.slice(0, 300),
        sender: from,
        thread_id: threadId,
        applied_date: date ? new Date(date).toISOString() : new Date().toISOString(),
    };
}
