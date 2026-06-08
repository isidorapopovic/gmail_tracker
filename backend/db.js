import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

export async function initDB() {
    await sql`
        CREATE TABLE IF NOT EXISTS jobs (
            id SERIAL PRIMARY KEY,
            company TEXT NOT NULL,
            role TEXT,
            status TEXT NOT NULL DEFAULT 'applied',
            thread_id TEXT UNIQUE NOT NULL,
            applied_date TIMESTAMPTZ,
            last_updated TIMESTAMPTZ DEFAULT NOW(),
            notes TEXT
        )
    `;

    // Safe migrations for existing databases.
    await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS thread_id TEXT`;
    await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS applied_date TIMESTAMPTZ`;
    await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW()`;
    await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notes TEXT`;

    // Make thread_id unique if the constraint does not already exist.
    await sql`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'jobs_thread_id_key'
            ) THEN
                ALTER TABLE jobs ADD CONSTRAINT jobs_thread_id_key UNIQUE (thread_id);
            END IF;
        END
        $$;
    `;

    // Remove old columns you no longer need.
    await sql`ALTER TABLE jobs DROP COLUMN IF EXISTS email_subject`;
    await sql`ALTER TABLE jobs DROP COLUMN IF EXISTS email_snippet`;
    await sql`ALTER TABLE jobs DROP COLUMN IF EXISTS sender`;
    await sql`ALTER TABLE jobs DROP COLUMN IF EXISTS parser_confidence`;
    await sql`ALTER TABLE jobs DROP COLUMN IF EXISTS parser_reason`;

    await sql`
        CREATE TABLE IF NOT EXISTS sync_log (
            id SERIAL PRIMARY KEY,
            synced_at TIMESTAMPTZ DEFAULT NOW(),
            emails_found INTEGER,
            jobs_added INTEGER,
            jobs_updated INTEGER,
            jobs_ignored INTEGER DEFAULT 0
        )
    `;

    await sql`ALTER TABLE sync_log ADD COLUMN IF NOT EXISTS jobs_ignored INTEGER DEFAULT 0`;

    console.log("✅ DB initialised");
}

export async function upsertJob(job) {
    if (!job) return null;

    const result = await sql`
        INSERT INTO jobs (
            company,
            role,
            status,
            thread_id,
            applied_date
        )
        VALUES (
            ${job.company || "Unknown Company"},
            ${job.role || "Unknown Role"},
            ${job.status || "unknown"},
            ${job.thread_id},
            ${job.applied_date || null}
        )
        ON CONFLICT (thread_id) DO UPDATE SET
            company = CASE
                WHEN jobs.company = 'Unknown Company'
                     AND EXCLUDED.company != 'Unknown Company'
                THEN EXCLUDED.company
                ELSE jobs.company
            END,
            role = CASE
                WHEN (jobs.role IS NULL OR jobs.role = 'Unknown Role')
                     AND EXCLUDED.role != 'Unknown Role'
                THEN EXCLUDED.role
                ELSE jobs.role
            END,
            status = CASE
                WHEN EXCLUDED.status != 'unknown'
                THEN EXCLUDED.status
                ELSE jobs.status
            END,
            applied_date = COALESCE(EXCLUDED.applied_date, jobs.applied_date),
            last_updated = NOW()
        RETURNING *, (xmax = 0) AS inserted
    `;

    return result[0];
}

export async function getAllJobs() {
    return await sql`
        SELECT
            id,
            company,
            role,
            status,
            thread_id,
            applied_date,
            last_updated,
            notes
        FROM jobs
        ORDER BY
            applied_date DESC NULLS LAST,
            last_updated DESC
    `;
}

export async function updateJobNotes(id, notes) {
    return await sql`
        UPDATE jobs
        SET
            notes = ${notes},
            last_updated = NOW()
        WHERE id = ${id}
        RETURNING *
    `;
}

export async function updateJobStatus(id, status) {
    return await sql`
        UPDATE jobs
        SET
            status = ${status},
            last_updated = NOW()
        WHERE id = ${id}
        RETURNING *
    `;
}

export async function deleteJob(id) {
    return await sql`
        DELETE FROM jobs
        WHERE id = ${id}
    `;
}

export async function getStats() {
    const counts = await sql`
        SELECT status, COUNT(*) AS count
        FROM jobs
        GROUP BY status
    `;

    const total = await sql`
        SELECT COUNT(*) AS total
        FROM jobs
    `;

    const lastSync = await sql`
        SELECT synced_at
        FROM sync_log
        ORDER BY synced_at DESC
        LIMIT 1
    `;

    return {
        byStatus: counts,
        total: parseInt(total[0].total, 10),
        lastSync: lastSync[0]?.synced_at || null,
    };
}

export async function logSync(emailsFound, jobsAdded, jobsUpdated, jobsIgnored = 0) {
    await sql`
        INSERT INTO sync_log (
            emails_found,
            jobs_added,
            jobs_updated,
            jobs_ignored
        )
        VALUES (
            ${emailsFound},
            ${jobsAdded},
            ${jobsUpdated},
            ${jobsIgnored}
        )
    `;
}

export default sql;