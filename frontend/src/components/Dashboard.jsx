import { useState, useEffect, useCallback, useRef } from "react";
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
    const loadingRef = useRef(false);

    const loadData = useCallback(async () => {
        if (loadingRef.current) return;

        loadingRef.current = true;

        try {
            setLoading(true);

            const [jobsRes, statsRes] = await Promise.all([
                getJobs(),
                getStats(),
            ]);

            setJobs(jobsRes.data);
            setStats(statsRes.data);
        } catch (err) {
            console.error("Failed to load jobs/stats:", err);
            setSyncResult({
                error: err.response?.data?.error || "Failed to load dashboard data",
            });
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

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

    const filteredJobs = jobs
        .filter((j) => {
            const matchesFilter = filter === "all" || j.status === filter;
            const matchesSearch =
                !search ||
                j.company?.toLowerCase().includes(search.toLowerCase()) ||
                j.role?.toLowerCase().includes(search.toLowerCase());

            return matchesFilter && matchesSearch;
        })
        .sort((a, b) => {
            const dateA = new Date(a.applied_date || a.last_updated || 0).getTime();
            const dateB = new Date(b.applied_date || b.last_updated || 0).getTime();

            return dateB - dateA;
        });

    return (
        <div style={s.root}>
            <header style={s.header}>
                <div style={s.headerLeft}>
                    <span style={s.logo}>◈</span>
                    <span style={s.logoLabel}>JobTracker</span>
                </div>
                <div style={s.headerRight}>
                    <button style={{ ...s.btn, ...(syncing ? s.btnDisabled : {}) }} onClick={handleSync} disabled={syncing}>
                        {syncing ? <><Spinner /> Syncing…</> : <>↻ Sync Gmail</>}
                    </button>
                    <button style={{ ...s.btn, ...s.btnGhost }} onClick={handleLogout}>Sign out</button>
                </div>
            </header>

            {syncResult && (
                <div style={{ ...s.banner, ...(syncResult.error ? s.bannerError : s.bannerSuccess) }}>
                    {syncResult.error
                        ? `❌ ${syncResult.error}`
                        : `✅ Sync complete — ${syncResult.emailsFound} emails scanned, ${syncResult.jobsAdded} added, ${syncResult.jobsUpdated} updated`}
                </div>
            )}

            <main style={s.main}>
                {stats && <StatsBar stats={stats} />}
                <div style={s.toolbar}>
                    <div style={s.filterGroup}>
                        {["all", "applied", "reviewing", "interview", "offer", "rejected"].map((f) => (
                            <button key={f} style={{ ...s.filterBtn, ...(filter === f ? s.filterActive : {}) }} onClick={() => setFilter(f)}>
                                {STATUS_LABEL[f] || f}
                                {stats && (
                                    <span style={s.filterCount}>
                                        {f === "all" ? stats.total : stats.byStatus.find((s) => s.status === f)?.count || 0}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                    <input style={s.search} placeholder="Search company or role…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {loading ? (
                    <div style={s.center}><Spinner large /></div>
                ) : filteredJobs.length === 0 ? (
                    <EmptyState filter={filter} onSync={handleSync} />
                ) : (
                    <JobTable jobs={filteredJobs} onChange={loadData} />
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
            <p style={s.emptyTitle}>{filter === "all" ? "No applications yet" : `No ${filter} applications`}</p>
            <p style={s.emptyDesc}>{filter === "all" ? 'Click "Sync Gmail" to scan your inbox.' : "Try a different filter."}</p>
            {filter === "all" && <button style={s.btn} onClick={onSync}>↻ Sync Gmail</button>}
        </div>
    );
}

function Spinner({ large }) {
    return (
        <span style={{
            display: "inline-block",
            width: large ? 28 : 14,
            height: large ? 28 : 14,
            border: `${large ? 2 : 1.5}px solid var(--border2)`,
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
            marginRight: large ? 0 : 6,
        }} />
    );
}

const s = {
    root: {
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: 'Georgia, "Times New Roman", Times, serif',
    },

    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "24px 48px 8px",
        height: "auto",
        borderBottom: "none",
        background: "var(--surface)",
        position: "static",
        zIndex: 10,
    },

    headerLeft: {
        display: "flex",
        alignItems: "center",
        gap: 10,
    },

    logo: {
        fontSize: 17,
        color: "var(--text)",
        lineHeight: 1,
    },

    logoLabel: {
        fontWeight: 700,
        fontSize: 16,
        letterSpacing: "0.02em",
    },

    headerRight: {
        display: "flex",
        gap: 10,
        alignItems: "center",
    },

    main: {
        padding: "8px 88px 48px",
        maxWidth: "none",
        margin: "0",
    },

    btn: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "0",
        background: "transparent",
        color: "var(--text)",
        border: "none",
        borderRadius: 0,
        fontSize: 13,
        fontWeight: 700,
        fontFamily: 'Georgia, "Times New Roman", Times, serif',
        cursor: "pointer",
    },

    btnGhost: {
        background: "transparent",
        color: "var(--text)",
        border: "none",
    },

    btnDisabled: {
        opacity: 0.45,
        cursor: "not-allowed",
    },

    banner: {
        padding: "10px 88px",
        fontSize: 13,
        fontFamily: 'Georgia, "Times New Roman", Times, serif',
    },

    bannerSuccess: {
        background: "transparent",
        color: "var(--text)",
        borderBottom: "none",
    },

    bannerError: {
        background: "transparent",
        color: "var(--text)",
        borderBottom: "none",
    },

    toolbar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        marginTop: 28,
        marginBottom: 72,
        flexWrap: "wrap",
    },

    filterGroup: {
        display: "flex",
        gap: 26,
        flexWrap: "wrap",
        alignItems: "center",
    },

    filterBtn: {
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: 0,
        background: "transparent",
        color: "var(--text)",
        border: "none",
        borderRadius: 0,
        fontSize: 14,
        fontWeight: 700,
        fontFamily: 'Georgia, "Times New Roman", Times, serif',
        cursor: "pointer",
    },

    filterActive: {
        background: "transparent",
        borderColor: "transparent",
        color: "var(--text)",
    },

    filterCount: {
        background: "transparent",
        borderRadius: 0,
        padding: 0,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'Georgia, "Times New Roman", Times, serif',
    },

    search: {
        padding: "4px 0",
        background: "transparent",
        border: "none",
        borderRadius: 0,
        color: "var(--text)",
        fontSize: 14,
        outline: "none",
        width: 260,
    },

    center: {
        display: "flex",
        justifyContent: "center",
        paddingTop: 80,
    },

    empty: {
        textAlign: "center",
        padding: "10px 20px 80px",
        color: "var(--text)",
    },

    emptyIcon: {
        fontSize: 42,
        marginBottom: 22,
        color: "var(--text)",
        lineHeight: 1,
    },

    emptyTitle: {
        fontSize: 20,
        fontWeight: 700,
        marginBottom: 16,
        color: "var(--text)",
    },

    emptyDesc: {
        fontSize: 14,
        color: "var(--text)",
        marginBottom: 24,
        lineHeight: 1.6,
    },
};