import { useState, useEffect, useCallback } from "react";
import { getJobs, getStats, syncEmails, logout } from "../api";
import StatsBar from "./StatsBar";
import JobTable from "./JobTable";

export default function Dashboard({ onLogout }) {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [jobsRes, statsRes] = await Promise.all([getJobs(), getStats()]);
      setJobs(jobsRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await syncEmails();
      setSyncResult(res.data);
      await loadData();
    } catch (err) {
      setSyncResult({ error: err.response?.data?.error || "Sync failed" });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const filteredJobs = jobs.filter((j) => {
    const matchesFilter = filter === "all" || j.status === filter;
    const matchesSearch =
      !search ||
      j.company?.toLowerCase().includes(search.toLowerCase()) ||
      j.role?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div style={s.root}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.logo}>◈</span>
          <span style={s.logoLabel}>JobTracker</span>
        </div>
        <div style={s.headerRight}>
          <button
            style={{ ...s.btn, ...(syncing ? s.btnDisabled : {}) }}
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <>
                <Spinner /> Syncing…
              </>
            ) : (
              <>↻ Sync Gmail</>
            )}
          </button>
          <button style={{ ...s.btn, ...s.btnGhost }} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      {/* Sync result banner */}
      {syncResult && (
        <div style={{ ...s.banner, ...(syncResult.error ? s.bannerError : s.bannerSuccess) }}>
          {syncResult.error
            ? `❌ ${syncResult.error}`
            : `✅ Sync complete — ${syncResult.emailsFound} emails scanned, ${syncResult.jobsAdded} added, ${syncResult.jobsUpdated} updated`}
        </div>
      )}

      <main style={s.main}>
        {/* Stats */}
        {stats && <StatsBar stats={stats} />}

        {/* Filters + Search */}
        <div style={s.toolbar}>
          <div style={s.filterGroup}>
            {["all", "applied", "reviewing", "interview", "offer", "rejected"].map((f) => (
              <button
                key={f}
                style={{ ...s.filterBtn, ...(filter === f ? s.filterActive : {}) }}
                onClick={() => setFilter(f)}
              >
                {STATUS_LABEL[f] || f}
                {stats && (
                  <span style={s.filterCount}>
                    {f === "all"
                      ? stats.total
                      : stats.byStatus.find((s) => s.status === f)?.count || 0}
                  </span>
                )}
              </button>
            ))}
          </div>
          <input
            style={s.search}
            placeholder="Search company or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        {loading ? (
          <div style={s.center}>
            <Spinner large />
          </div>
        ) : filteredJobs.length === 0 ? (
          <EmptyState filter={filter} onSync={handleSync} />
        ) : (
          <JobTable jobs={filteredJobs} onRefresh={loadData} />
        )}
      </main>
    </div>
  );
}

const STATUS_LABEL = {
  all: "All",
  applied: "📨 Applied",
  reviewing: "👀 Reviewing",
  interview: "📅 Interview",
  offer: "✅ Offer",
  rejected: "❌ Rejected",
};

function EmptyState({ filter, onSync }) {
  return (
    <div style={s.empty}>
      <div style={s.emptyIcon}>◎</div>
      <p style={s.emptyTitle}>
        {filter === "all" ? "No applications yet" : `No ${filter} applications`}
      </p>
      <p style={s.emptyDesc}>
        {filter === "all"
          ? 'Click "Sync Gmail" to scan your inbox for job-related emails.'
          : "Try switching to a different status filter."}
      </p>
      {filter === "all" && (
        <button style={s.btn} onClick={onSync}>
          ↻ Sync Gmail
        </button>
      )}
    </div>
  );
}

function Spinner({ large }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: large ? 28 : 14,
        height: large ? 28 : 14,
        border: `${large ? 2 : 1.5}px solid var(--border2)`,
        borderTopColor: "var(--accent)",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        marginRight: large ? 0 : 6,
      }}
    />
  );
}

const s = {
  root: { minHeight: "100vh", background: "var(--bg)" },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 32px",
    height: 60,
    borderBottom: "1px solid var(--border)",
    background: "var(--surface)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  logo: { fontSize: 20, color: "var(--accent)" },
  logoLabel: { fontWeight: 700, fontSize: 16, letterSpacing: "0.04em" },
  headerRight: { display: "flex", gap: 10 },
  main: { padding: "28px 32px", maxWidth: 1300, margin: "0 auto" },
  btn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "Syne, sans-serif",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  btnGhost: {
    background: "transparent",
    color: "var(--text2)",
    border: "1px solid var(--border2)",
  },
  btnDisabled: { opacity: 0.6, cursor: "not-allowed" },
  banner: {
    padding: "10px 32px",
    fontSize: 13,
    fontFamily: "'DM Mono', monospace",
  },
  bannerSuccess: { background: "rgba(79,207,142,0.1)", color: "#4fcf8e", borderBottom: "1px solid rgba(79,207,142,0.2)" },
  bannerError: { background: "rgba(247,81,79,0.1)", color: "#f7514f", borderBottom: "1px solid rgba(247,81,79,0.2)" },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  filterGroup: { display: "flex", gap: 6, flexWrap: "wrap" },
  filterBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    background: "transparent",
    color: "var(--text2)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "Syne, sans-serif",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  filterActive: {
    background: "var(--accent-dim)",
    borderColor: "var(--accent)",
    color: "var(--accent)",
  },
  filterCount: {
    background: "var(--surface2)",
    borderRadius: 4,
    padding: "1px 5px",
    fontSize: 11,
    fontFamily: "'DM Mono', monospace",
  },
  search: {
    padding: "8px 14px",
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 7,
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
    width: 240,
  },
  center: { display: "flex", justifyContent: "center", paddingTop: 80 },
  empty: {
    textAlign: "center",
    padding: "80px 20px",
    color: "var(--text2)",
  },
  emptyIcon: { fontSize: 40, marginBottom: 16, color: "var(--border2)" },
  emptyTitle: { fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--text)" },
  emptyDesc: { fontSize: 13, color: "var(--text2)", marginBottom: 24, lineHeight: 1.6 },
};
