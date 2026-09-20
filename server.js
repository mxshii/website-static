const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

let picturesHandler = null;
try {
  picturesHandler = require("./api/pictures.js");
} catch (e) {
  console.warn("API handler load warning:", e.message);
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = parsedUrl.pathname;

  // Handle /api/pictures
  if (pathname === "/api/pictures" && picturesHandler) {
    let bodyData = "";
    req.on("data", (chunk) => { bodyData += chunk; });
    req.on("end", async () => {
      try {
        req.body = bodyData ? JSON.parse(bodyData) : {};
      } catch (_) {
        req.body = {};
      }

      res.status = function(code) {
        this.statusCode = code;
        return this;
      };
      res.json = function(data) {
        this.setHeader("Content-Type", "application/json");
        this.end(JSON.stringify(data));
      };

      try {
        await picturesHandler(req, res);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Handle static files
  if (pathname === "/" || pathname === "") pathname = "/index.html";

  let filePath = path.join(ROOT, decodeURIComponent(pathname));

  if (!fs.existsSync(filePath)) {
    if (fs.existsSync(filePath + ".html")) {
      filePath += ".html";
    } else {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("404 Not Found");
    }
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";

  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`\n✦ STATIC Dev Server is live!`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Shop:    http://localhost:${PORT}/shop.html`);
  console.log(`  Admin:   http://localhost:${PORT}/admin.html\n`);
});
