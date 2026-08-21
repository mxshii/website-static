const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_sMn40rEeUbiw@ep-dark-smoke-b1sc7b0k-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  ssl: { rejectUnauthorized: false },
  max: 2,
  idleTimeoutMillis: 3000,
  connectionTimeoutMillis: 5000,
});

let inited = false;
async function initDB() {
  if (inited) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS storefront_pictures (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  inited = true;
}

module.exports = async (req, res) => {
  // Global CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    await initDB();

    if (req.method === "GET") {
      res.setHeader("Cache-Control", "public, s-maxage=5, stale-while-revalidate=20");
      const { rows } = await pool.query("SELECT data FROM storefront_pictures WHERE key = 'custom_map'");
      return res.json(rows[0] ? rows[0].data : {});
    }

    if (req.method === "POST") {
      const data = req.body || {};
      await pool.query(
        `INSERT INTO storefront_pictures (key, data, updated_at)
         VALUES ('custom_map', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [JSON.stringify(data)]
      );
      return res.json({ success: true, count: Object.keys(data).length });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Storefront picture API error:", err);
    res.status(500).json({ error: err.message });
  }
};
