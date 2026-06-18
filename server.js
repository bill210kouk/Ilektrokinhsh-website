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
let GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;
let PLACE_ID = process.env.GOOGLE_PLACE_ID;
try {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, "secrets.local.json"), "utf8"));
  TOKEN = TOKEN || s.TELEGRAM_BOT_TOKEN;
  CHAT_ID = CHAT_ID || s.TELEGRAM_CHAT_ID;
  GOOGLE_KEY = GOOGLE_KEY || s.GOOGLE_PLACES_API_KEY;
  PLACE_ID = PLACE_ID || s.GOOGLE_PLACE_ID;
} catch (_) {}

// Cache για τις κριτικές Google (ώστε να μη χτυπάμε το API σε κάθε επίσκεψη)
const REVIEWS_TTL_MS = 12 * 60 * 60 * 1000; // 12 ώρες
let reviewsCache = { at: 0, data: null };

async function getGoogleReviews() {
  if (reviewsCache.data && Date.now() - reviewsCache.at < REVIEWS_TTL_MS) {
    return reviewsCache.data;
  }
  if (!GOOGLE_KEY || !PLACE_ID) {
    throw new Error("Λείπει GOOGLE_PLACES_API_KEY ή GOOGLE_PLACE_ID στο secrets.local.json");
  }
  const url =
    "https://maps.googleapis.com/maps/api/place/details/json" +
    "?place_id=" + encodeURIComponent(PLACE_ID) +
    "&fields=rating,user_ratings_total,reviews" +
    "&reviews_sort=newest&language=el&key=" + encodeURIComponent(GOOGLE_KEY);

  const r = await fetch(url);
  const j = await r.json();
  if (j.status !== "OK") {
    throw new Error("Google Places: " + j.status + (j.error_message ? " — " + j.error_message : ""));
  }
  const res = j.result || {};
  const data = {
    rating: res.rating ?? null,
    total: res.user_ratings_total ?? null,
    reviews: (res.reviews || []).map((rv) => ({
      author: rv.author_name,
      rating: rv.rating,
      text: rv.text,
      time: rv.relative_time_description,
      profile_photo: rv.profile_photo_url,
    })),
  };
  reviewsCache = { at: Date.now(), data };
  return data;
}

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

  // ---- API: Google reviews (cached) ----
  if (req.method === "GET" && (req.url || "").split("?")[0] === "/api/reviews") {
    getGoogleReviews()
      .then((data) => {
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        });
        res.end(JSON.stringify(data));
      })
      .catch((e) => {
        console.error("reviews:", e.message);
        sendJSON(res, 502, { error: "Δεν ήταν δυνατή η ανάκτηση κριτικών." });
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
