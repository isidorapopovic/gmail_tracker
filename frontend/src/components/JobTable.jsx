import { useState } from "react";
import { updateNotes, updateStatus, deleteJob } from "../api";

const STATUS_OPTIONS = [
    "applied",
    "reviewing",
    "interview",
    "offer",
    "rejected",
    "unknown",
];

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
}

export default function JobTable({ jobs, onChange }) {
    const [savingId, setSavingId] = useState(null);

    const handleStatusChange = async (jobId, status) => {
        try {
            setSavingId(jobId);
            await updateStatus(jobId, status);
            await onChange?.();
        } catch (err) {
            console.error("Failed to update status:", err);
        } finally {
            setSavingId(null);
        }
    };

    const handleNotesBlur = async (jobId, notes) => {
        try {
            setSavingId(jobId);
            await updateNotes(jobId, notes);
            await onChange?.();
        } catch (err) {
            console.error("Failed to update notes:", err);
        } finally {
            setSavingId(null);
        }
    };

    const handleDelete = async (jobId) => {
        if (!window.confirm("Delete this job application?")) return;

        try {
            setSavingId(jobId);
            await deleteJob(jobId);
            await onChange?.();
        } catch (err) {
            console.error("Failed to delete job:", err);
        } finally {
            setSavingId(null);
        }
    };

    return (
        <div style={s.wrap}>
            <table style={s.table}>
                <thead>
                    <tr>
                        <th style={s.th}>Company</th>
                        <th style={s.th}>Role</th>
                        <th style={s.th}>Status</th>
                        <th style={s.th}>Date</th>
                        <th style={s.th}>Notes</th>
                        <th style={s.th}></th>
                    </tr>
                </thead>

                <tbody>
                    {jobs.map((job) => (
                        <tr key={job.id} style={s.tr}>
                            <td style={s.td}>{job.company || "Unknown"}</td>
                            <td style={s.td}>{job.role || "Unknown"}</td>

                            <td style={s.td}>
                                <select
                                    value={job.status || "unknown"}
                                    onChange={(e) => handleStatusChange(job.id, e.target.value)}
                                    disabled={savingId === job.id}
                                    style={s.select}
                                >
                                    {STATUS_OPTIONS.map((status) => (
                                        <option key={status} value={status}>
                                            {status}
                                        </option>
                                    ))}
                                </select>
                            </td>

                            <td style={s.td}>
                                {formatDate(job.applied_date)}
                            </td>

                            <td style={s.td}>
                                <textarea
                                    defaultValue={job.notes || ""}
                                    onBlur={(e) => handleNotesBlur(job.id, e.target.value)}
                                    disabled={savingId === job.id}
                                    style={s.notes}
                                    placeholder="Add notes..."
                                />
                            </td>

                            <td style={s.td}>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(job.id)}
                                    disabled={savingId === job.id}
                                    style={s.deleteBtn}
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const s = {
    wrap: {
        width: "100%",
        overflowX: "auto",
    },

    table: {
        width: "100%",
        borderCollapse: "collapse",
        fontFamily: 'Georgia, "Times New Roman", Times, serif',
    },

    th: {
        textAlign: "left",
        padding: "12px 8px",
        borderBottom: "1px solid #111",
        fontSize: 13,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
    },

    tr: {
        borderBottom: "1px solid #ddd",
    },

    td: {
        padding: "12px 8px",
        verticalAlign: "top",
        fontSize: 14,
    },

    select: {
        background: "transparent",
        border: "1px solid #111",
        padding: "4px 6px",
        fontFamily: "inherit",
    },

    notes: {
        width: "220px",
        minHeight: "38px",
        border: "1px solid #111",
        padding: "6px",
        resize: "vertical",
        fontFamily: "inherit",
    },

    deleteBtn: {
        background: "transparent",
        border: "none",
        padding: 0,
        fontFamily: "inherit",
        fontWeight: 700,
        cursor: "pointer",
    },
};