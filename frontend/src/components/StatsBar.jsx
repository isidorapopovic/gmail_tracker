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
  wrapper: { marginBottom: 28 },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 14,
    marginBottom: 16,
  },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "16px 18px",
  },
  cardValue: {
    fontSize: 32,
    fontWeight: 800,
    lineHeight: 1,
    marginBottom: 6,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text2)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 11,
    color: "var(--text3)",
    fontFamily: "'DM Mono', monospace",
  },
  breakdown: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "16px 18px",
  },
  barLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text3)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 10,
  },
  bar: {
    display: "flex",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    background: "var(--surface2)",
    marginBottom: 12,
    gap: 2,
  },
  barSegment: {
    height: "100%",
    transition: "width 0.4s ease",
    borderRadius: 2,
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 20px",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
  },
  legendLabel: { color: "var(--text2)" },
  legendCount: {
    color: "var(--text3)",
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
  },
};
