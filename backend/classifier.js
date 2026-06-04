function classifyStatus(subject = "", snippet = "", body = "") {
    const text = normaliseText(`${subject}\n${snippet}\n${body}`);

    const rules = {
        offer: [
            [/offer letter/i, 8],
            [/offer of employment/i, 8],
            [/pleased to offer/i, 8],
            [/we('d| would) like to offer/i, 7],
            [/extend.*offer/i, 7],
            [/job offer/i, 7],
        ],

        rejected: [
            [/not moving forward/i, 8],
            [/will not be moving/i, 8],
            [/not selected/i, 8],
            [/decided not to/i, 7],
            [/not be proceeding/i, 7],
            [/not a match/i, 7],
            [/filled the position/i, 7],
            [/gone with another/i, 7],
            [/other candidates/i, 6],
            [/regret to inform/i, 6],
            [/unfortunately/i, 2],
        ],

        interview: [
            [/schedule (a|an)?\s*(call|interview|chat)/i, 8],
            [/interview/i, 7],
            [/phone screen/i, 7],
            [/technical assessment/i, 7],
            [/coding challenge/i, 7],
            [/take-home/i, 6],
            [/next step/i, 5],
            [/speak with you/i, 5],
            [/chat with you/i, 5],
            [/meet with you/i, 5],
        ],

        reviewing: [
            [/under review/i, 6],
            [/being reviewed/i, 6],
            [/carefully review/i, 5],
            [/reviewing your application/i, 5],
            [/considering your application/i, 5],
            [/shortlisted/i, 6],
        ],

        applied: [
            [/thank you for applying/i, 5],
            [/thanks for applying/i, 5],
            [/application received/i, 5],
            [/application submitted/i, 5],
            [/successfully applied/i, 5],
            [/we received your application/i, 5],
            [/your application has been received/i, 5],
        ],
    };

    const scores = {
        offer: 0,
        rejected: 0,
        interview: 0,
        reviewing: 0,
        applied: 0,
    };

    const reasons = {
        offer: [],
        rejected: [],
        interview: [],
        reviewing: [],
        applied: [],
    };

    for (const [status, statusRules] of Object.entries(rules)) {
        for (const [regex, weight] of statusRules) {
            const match = text.match(regex);
            if (match) {
                scores[status] += weight;
                reasons[status].push(match[0]);
            }
        }
    }

    // Important: "thank you for applying" is only an application receipt.
    // It should not make the parser think anything progressed.
    const onlyApplicationReceipt =
        scores.applied > 0 &&
        scores.offer === 0 &&
        scores.rejected === 0 &&
        scores.interview === 0 &&
        scores.reviewing === 0;

    if (onlyApplicationReceipt) {
        return {
            status: "applied",
            confidence: Math.min(scores.applied, 10),
            reason: reasons.applied.slice(0, 3).join(", "),
        };
    }

    // Avoid false rejection:
    // "Unfortunately, we need to reschedule your interview"
    if (/unfortunately.{0,80}(reschedule|delay|postpone|move)/i.test(text)) {
        scores.rejected -= 4;
        scores.interview += 3;
    }

    // Avoid false offer:
    // "We cannot offer you a position"
    if (/cannot offer|unable to offer|not able to offer/i.test(text)) {
        scores.offer -= 8;
        scores.rejected += 5;
    }

    // Applied is intentionally lowest priority.
    // If another status exists, applied should almost never win.
    if (
        scores.offer > 0 ||
        scores.rejected > 0 ||
        scores.interview > 0 ||
        scores.reviewing > 0
    ) {
        scores.applied = 0;
    }

    const priority = ["offer", "rejected", "interview", "reviewing", "applied"];

    const best = priority
        .map((status) => ({
            status,
            score: scores[status],
            reason: reasons[status].slice(0, 3).join(", "),
        }))
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return priority.indexOf(a.status) - priority.indexOf(b.status);
        })[0];

    if (!best || best.score < 3) {
        return {
            status: "unknown",
            confidence: 0,
            reason: "No strong status pattern matched",
        };
    }

    return {
        status: best.status,
        confidence: Math.min(best.score, 10),
        reason: best.reason,
    };
}