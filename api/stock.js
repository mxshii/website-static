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
    CREATE TABLE IF NOT EXISTS stock (
      id        TEXT PRIMARY KEY,
      item_name TEXT NOT NULL,
      quantity  INTEGER NOT NULL DEFAULT 0,
      price     NUMERIC(12, 2) NOT NULL DEFAULT 0,
      sku       TEXT
    );
  `);
  inited = true;
}

function generateSku(category, itemName) {
  const cat = String(category || "").toLowerCase();
  const name = String(itemName || "").toLowerCase();
  let prefix = "STK";
  if (cat.includes("sheet") || name.includes("sheet") || cat.includes("pack")) {
    prefix = "SSH";
  } else if (cat.includes("poster") || name.includes("poster")) {
    prefix = "PTR";
  }
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${rand}`;
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
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      const { rows } = await pool.query(`
        SELECT id, item_name AS "itemName", quantity, price::float AS price, sku
        FROM stock ORDER BY item_name
      `);
      return res.json(rows);
    }

    if (req.method === "POST") {
      const { itemName, category, price, quantity, sku } = req.body || {};
      if (!itemName || !String(itemName).trim()) {
        return res.status(400).json({ error: "Item name is required" });
      }

      const cleanName = String(itemName).trim();
      const numPrice = Math.max(0, Number(price) || 15);
      const numQty = Math.max(0, parseInt(quantity, 10) || 1);

      let finalSku = (sku && String(sku).trim())
        ? String(sku).trim().toUpperCase()
        : generateSku(category, cleanName);

      const stockId = "stk_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

      const { rows } = await pool.query(
        `INSERT INTO stock (id, item_name, quantity, price, sku)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, item_name AS "itemName", quantity, price::float AS price, sku`,
        [stockId, cleanName, numQty, numPrice, finalSku]
      );

      return res.json({ ok: true, stockItem: rows[0] });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Storefront Stock API error:", err);
    res.status(500).json({ error: err.message });
  }
};
