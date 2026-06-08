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
      email_subject TEXT,
      email_snippet TEXT,
      sender TEXT,
      thread_id TEXT UNIQUE,
      applied_date TIMESTAMPTZ,
      last_updated TIMESTAMPTZ DEFAULT NOW(),
      notes TEXT,
      parser_confidence INTEGER DEFAULT 0,
      parser_reason TEXT
    )
  `;

    // Safe migrations for existing databases
    await sql`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS parser_confidence INTEGER DEFAULT 0
  `;

    await sql`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS parser_reason TEXT
  `;

    await sql`
    CREATE TABLE IF NOT EXISTS sync_log (
      id SERIAL PRIMARY KEY,
      synced_at TIMESTAMPTZ DEFAULT NOW(),
      emails_found INTEGER,
      jobs_added INTEGER,
      jobs_updated INTEGER
    )
  `;

    console.log("✅ DB initialized");
}

export async function upsertJob(job) {
    const result = await sql`
    INSERT INTO jobs (
      company,
      role,
      status,
      email_subject,
      email_snippet,
      sender,
      thread_id,
      applied_date
    )
    VALUES (
      ${job.company},
      ${job.role},
      ${job.status},
      ${job.email_subject},
      ${job.email_snippet},
      ${job.sender},
      ${job.thread_id},
      ${job.applied_date}
    )
    ON CONFLICT (thread_id) DO UPDATE SET
      company = COALESCE(NULLIF(EXCLUDED.company, 'Unknown Company'), jobs.company),
      role = COALESCE(NULLIF(EXCLUDED.role, 'Unknown Role'), jobs.role),
      status = CASE
        WHEN EXCLUDED.status != 'unknown' THEN EXCLUDED.status
        ELSE jobs.status
      END,
      email_subject = EXCLUDED.email_subject,
      email_snippet = EXCLUDED.email_snippet,
      sender = EXCLUDED.sender,
      applied_date = COALESCE(EXCLUDED.applied_date, jobs.applied_date),
      last_updated = NOW()
    RETURNING *, (xmax = 0) AS inserted
  `;

    return result[0];
}

export async function getAllJobs() {
    return await sql`
    SELECT *
    FROM jobs
    ORDER BY
      applied_date DESC NULLS LAST,
      last_updated DESC
  `;
}

export async function updateJobNotes(id, notes) {
    return await sql`
    UPDATE jobs
    SET notes = ${notes}, last_updated = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
}

export async function updateJobStatus(id, status) {
    return await sql`
    UPDATE jobs
    SET status = ${status}, last_updated = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
}

export async function deleteJob(id) {
    return await sql`DELETE FROM jobs WHERE id = ${id}`;
}

export async function getStats() {
    const counts = await sql`
    SELECT status, COUNT(*) as count
    FROM jobs
    GROUP BY status
  `;

    const total = await sql`SELECT COUNT(*) as total FROM jobs`;

    const lastSync = await sql`
    SELECT synced_at
    FROM sync_log
    ORDER BY synced_at DESC
    LIMIT 1
  `;

    return {
        byStatus: counts,
        total: parseInt(total[0].total),
        lastSync: lastSync[0]?.synced_at || null,
    };
}

export async function logSync(emailsFound, jobsAdded, jobsUpdated) {
    await sql`
    INSERT INTO sync_log (emails_found, jobs_added, jobs_updated)
    VALUES (${emailsFound}, ${jobsAdded}, ${jobsUpdated})
  `;
}

export default sql;