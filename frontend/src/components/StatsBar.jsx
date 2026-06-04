import { formatDistanceToNow } from "date-fns";

const STATUS_CONFIG = {
  applied:   { label: "Applied",   color: "var(--applied)",   icon: "📨" },
  reviewing: { label: "Reviewing", color: "var(--reviewing)", icon: "👀" },
  interview: { label: "Interview", color: "var(--interview)", icon: "📅" },
  offer:     { label: "Offer",     color: "var(--offer)",     icon: "✅" },
  rejected:  { label: "Rejected",  color: "var(--rejected)",  icon: "❌" },
  unknown:   { label: "Unknown",   color: "var(--unknown)",   icon: "❓" },
};

export default function StatsBar({ stats }) {
  const statusMap = {};
  for (const row of stats.byStatus) {
    statusMap[row.status] = parseInt(row.count);
  }

  const replyRate =
    stats.total > 0
      ? Math.round(
          (((statusMap.interview || 0) +
            (statusMap.offer || 0) +
            (statusMap.rejected || 0)) /
            stats.total) *
            100
        )
      : 0;

  return (
    <div style={s.wrapper}>
      {/* Big stat cards */}
      <div style={s.cards}>
        <StatCard
          label="Total Applications"
          value={stats.total}
          accent="var(--accent)"
          sub={
            stats.lastSync
              ? `Last synced ${formatDistanceToNow(new Date(stats.lastSync), { addSuffix: true })}`
              : "Never synced"
          }
        />
        <StatCard
          label="Interviews"
          value={(statusMap.interview || 0) + (statusMap.offer || 0)}
          accent="var(--interview)"
          sub="Active pipeline"
        />
        <StatCard
          label="Offers"
          value={statusMap.offer || 0}
          accent="var(--offer)"
          sub="Congratulations!"
        />
        <StatCard
          label="Response Rate"
          value={`${replyRate}%`}
          accent="var(--reviewing)"
          sub="Replies received"
        />
      </div>

      {/* Breakdown bar */}
      <div style={s.breakdown}>
        <div style={s.barLabel}>Status breakdown</div>
        <div style={s.bar}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = statusMap[key] || 0;
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={key}
                title={`${cfg.label}: ${count}`}
                style={{
                  ...s.barSegment,
                  width: `${pct}%`,
                  background: cfg.color,
                }}
              />
            );
          })}
        </div>
        <div style={s.legend}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = statusMap[key] || 0;
            return (
              <div key={key} style={s.legendItem}>
                <span style={{ ...s.dot, background: cfg.color }} />
                <span style={s.legendLabel}>{cfg.label}</span>
                <span style={s.legendCount}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, sub }) {
  return (
    <div style={{ ...s.card, borderTop: `3px solid ${accent}` }}>
      <div style={{ ...s.cardValue, color: accent }}>{value}</div>
      <div style={s.cardLabel}>{label}</div>
      <div style={s.cardSub}>{sub}</div>
    </div>
  );
}

const s = {
    wrapper: {
        marginTop: 8,
        marginBottom: 30,
    },

    cards: {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(140px, 1fr))",
        gap: 80,
        marginBottom: 46,
        maxWidth: 1050,
    },

    card: {
        background: "transparent",
        border: "none",
        borderRadius: 0,
        padding: 0,
    },

    cardValue: {
        fontSize: 34,
        fontWeight: 700,
        lineHeight: 1,
        marginBottom: 9,
        color: "var(--text)",
    },

    cardLabel: {
        fontSize: 13,
        fontWeight: 700,
        color: "var(--text)",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        marginBottom: 5,
    },

    cardSub: {
        fontSize: 13,
        color: "var(--text)",
        fontFamily: 'Georgia, "Times New Roman", Times, serif',
    },

    breakdown: {
        background: "transparent",
        border: "none",
        borderRadius: 0,
        padding: 0,
    },

    barLabel: {
        fontSize: 13,
        fontWeight: 700,
        color: "var(--text)",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        marginBottom: 28,
    },

    bar: {
        display: "none",
    },

    barSegment: {
        height: "100%",
    },

    legend: {
        display: "flex",
        flexWrap: "wrap",
        gap: "0 42px",
    },

    legendItem: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 14,
        color: "var(--text)",
    },

    dot: {
        display: "none",
    },

    legendLabel: {
        color: "var(--text)",
    },

    legendCount: {
        color: "var(--text)",
        fontFamily: 'Georgia, "Times New Roman", Times, serif',
        fontSize: 13,
        fontWeight: 700,
    },
};