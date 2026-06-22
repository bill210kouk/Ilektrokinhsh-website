/* =========================================================
   worker.js  —  Backend για τη φόρμα επικοινωνίας (Cloudflare Workers)
   Σερβίρει το στατικό site (binding ASSETS) και χειρίζεται το POST /api/send.

   Ρύθμιση secrets στον Worker:
     npx wrangler secret put TELEGRAM_BOT_TOKEN
     npx wrangler secret put TELEGRAM_CHAT_ID
   ========================================================= */

// Επιτρεπόμενα origins για CORS (scoped αντί για "*").
const ALLOWED_ORIGINS = [
  "https://ilektrokinhsh.com",
  "https://www.ilektrokinhsh.com",
];

// Όριο μεγέθους σώματος αιτήματος (anti-abuse).
const MAX_BODY_BYTES = 10 * 1024; // 10 KB

// Κοινά headers ασφαλείας για τις απαντήσεις του API.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "no-store",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Ο Worker χειρίζεται μόνο το /api/send· οτιδήποτε άλλο -> static assets.
    if (url.pathname !== "/api/send") {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("Not found", { status: 404 });
    }

    const origin = request.headers.get("Origin") || "";
    const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    const cors = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: { ...cors, ...SECURITY_HEADERS } });
    if (request.method !== "POST")
      return json({ error: "Method not allowed" }, 405, cors);

    // ----- Rate limiting (ανά IP) -----
    // Απαιτεί binding RATE_LIMITER στο wrangler.toml. Αν λείπει, απλώς προσπερνά.
    if (env.RATE_LIMITER) {
      const ip = request.headers.get("CF-Connecting-IP") || "anonymous";
      try {
        const { success } = await env.RATE_LIMITER.limit({ key: ip });
        if (!success)
          return json({ error: "Πολλά αιτήματα. Δοκιμάστε ξανά σε λίγο." }, 429, cors);
      } catch {
        // Σε σφάλμα του limiter, μην μπλοκάρεις τη νόμιμη κίνηση.
      }
    }

    // ----- Όριο μεγέθους σώματος -----
    const contentLength = Number(request.headers.get("Content-Length") || "0");
    if (contentLength > MAX_BODY_BYTES)
      return json({ error: "Το αίτημα είναι πολύ μεγάλο." }, 413, cors);

    let data;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES)
        return json({ error: "Το αίτημα είναι πολύ μεγάλο." }, 413, cors);
      data = JSON.parse(raw);
    } catch {
      data = {};
    }

    // honeypot
    if (data.company) return json({ ok: true }, 200, cors);

    const clip = (s, n) => String(s || "").trim().slice(0, n);
    const name = clip(data.name, 200);
    const phone = clip(data.phone, 50);
    const message = clip(data.message, 4000);
    if (!name || !phone || !message)
      return json({ error: "Λείπουν υποχρεωτικά πεδία." }, 400, cors);

    const email = clip(data.email, 200) || "—";
    const subject = clip(data.subject, 200) || "—";
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const text =
      "🔔 <b>Νέο αίτημα από την ιστοσελίδα</b>\n\n" +
      "👤 <b>Όνομα:</b> " + esc(name) + "\n" +
      "📞 <b>Τηλέφωνο:</b> " + esc(phone) + "\n" +
      "✉️ <b>Email:</b> " + esc(email) + "\n" +
      "🏷️ <b>Θέμα:</b> " + esc(subject) + "\n\n" +
      "💬 <b>Μήνυμα:</b>\n" + esc(message);

    let tg;
    try {
      tg = await fetch(
        "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        }
      );
    } catch (err) {
      console.error("Telegram fetch error:", err);
      return json({ error: "Σφάλμα αποστολής στο Telegram." }, 502, cors);
    }

    if (!tg.ok) {
      console.error("Telegram error:", await tg.text());
      return json({ error: "Σφάλμα αποστολής στο Telegram." }, 502, cors);
    }
    return json({ ok: true }, 200, cors);
  },
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...SECURITY_HEADERS, ...headers },
  });
}
