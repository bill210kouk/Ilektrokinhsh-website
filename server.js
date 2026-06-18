/* =========================================================
   server.js — Τοπικός server για δοκιμή (μόνο για development)
   Σερβίρει την ιστοσελίδα ΚΑΙ χειρίζεται τη φόρμα (/api/send),
   ώστε να δοκιμάσεις την αποστολή στο Telegram τοπικά.

   Χρειάζεται Node 18+ (έχει ενσωματωμένο fetch). Δεν θέλει npm install.

   Εκτέλεση:
     1) Αντίγραψε το secrets.local.example.json σε  secrets.local.json
        και βάλε μέσα το (νέο) TOKEN και το CHAT_ID σου.
     2) node server.js
     3) Άνοιξε http://localhost:3000
   ========================================================= */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// Διάβασμα secrets: πρώτα env, μετά secrets.local.json
let TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let CHAT_ID = process.env.TELEGRAM_CHAT_ID;
try {
  if (!TOKEN || !CHAT_ID) {
    const s = JSON.parse(fs.readFileSync(path.join(ROOT, "secrets.local.json"), "utf8"));
    TOKEN = TOKEN || s.TELEGRAM_BOT_TOKEN;
    CHAT_ID = CHAT_ID || s.TELEGRAM_CHAT_ID;
  }
} catch (_) {}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

const sendJSON = (res, status, obj) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
};

const server = http.createServer((req, res) => {
  // ---- API: φόρμα -> Telegram ----
  if (req.method === "POST" && req.url === "/api/send") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      let data = {};
      try { data = JSON.parse(body); } catch (_) {}

      if (data.company) return sendJSON(res, 200, { ok: true }); // honeypot

      const name = String(data.name || "").trim();
      const phone = String(data.phone || "").trim();
      const message = String(data.message || "").trim();
      if (!name || !phone || !message)
        return sendJSON(res, 400, { error: "Λείπουν υποχρεωτικά πεδία." });

      if (!TOKEN || !CHAT_ID)
        return sendJSON(res, 500, {
          error: "Δεν έχει οριστεί TOKEN/CHAT_ID. Συμπλήρωσε το secrets.local.json.",
        });

      const esc = (s) =>
        String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      const text =
        "🔔 <b>Νέο αίτημα από την ιστοσελίδα (τοπικό τεστ)</b>\n\n" +
        "👤 <b>Όνομα:</b> " + esc(name) + "\n" +
        "📞 <b>Τηλέφωνο:</b> " + esc(phone) + "\n" +
        "✉️ <b>Email:</b> " + esc(String(data.email || "—").trim() || "—") + "\n" +
        "🏷️ <b>Θέμα:</b> " + esc(String(data.subject || "—").trim() || "—") + "\n\n" +
        "💬 <b>Μήνυμα:</b>\n" + esc(message);

      try {
        const tg = await fetch("https://api.telegram.org/bot" + TOKEN + "/sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        });
        if (!tg.ok) {
          console.error("Telegram:", await tg.text());
          return sendJSON(res, 502, { error: "Σφάλμα αποστολής στο Telegram." });
        }
        return sendJSON(res, 200, { ok: true });
      } catch (e) {
        console.error(e);
        return sendJSON(res, 500, { error: "Server error." });
      }
    });
    return;
  }

  // ---- Στατικά αρχεία ----
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Δεν βρέθηκε: " + urlPath);
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log("\n▶  Η ιστοσελίδα τρέχει: http://localhost:" + PORT);
  if (!TOKEN || !CHAT_ID)
    console.log("⚠  Δεν βρέθηκε TOKEN/CHAT_ID — η φόρμα θα δείχνει σφάλμα μέχρι να συμπληρώσεις το secrets.local.json\n");
  else console.log("✓  Telegram έτοιμο — δοκίμασε τη φόρμα.\n");
});
