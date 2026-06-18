/* =========================================================
   worker.js  —  Εναλλακτικό backend (Cloudflare Workers)
   Χρήσιμο αν φιλοξενείς το frontend στο GitHub Pages.

   Ρύθμιση secrets στον Worker:
     npx wrangler secret put TELEGRAM_BOT_TOKEN
     npx wrangler secret put TELEGRAM_CHAT_ID

   Μετά, στο js/main.js βάλε:
     const FORM_ENDPOINT = "https://<το-worker-σου>.workers.dev";
   ========================================================= */

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST")
      return json({ error: "Method not allowed" }, 405, cors);

    let data;
    try { data = await request.json(); } catch { data = {}; }

    // honeypot
    if (data.company) return json({ ok: true }, 200, cors);

    const name = (data.name || "").trim();
    const phone = (data.phone || "").trim();
    const message = (data.message || "").trim();
    if (!name || !phone || !message)
      return json({ error: "Λείπουν υποχρεωτικά πεδία." }, 400, cors);

    const email = (data.email || "").trim() || "—";
    const subject = (data.subject || "").trim() || "—";
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const text =
      "🔔 <b>Νέο αίτημα από την ιστοσελίδα</b>\n\n" +
      "👤 <b>Όνομα:</b> " + esc(name) + "\n" +
      "📞 <b>Τηλέφωνο:</b> " + esc(phone) + "\n" +
      "✉️ <b>Email:</b> " + esc(email) + "\n" +
      "🏷️ <b>Θέμα:</b> " + esc(subject) + "\n\n" +
      "💬 <b>Μήνυμα:</b>\n" + esc(message);

    const tg = await fetch(
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

    if (!tg.ok) return json({ error: "Σφάλμα αποστολής στο Telegram." }, 502, cors);
    return json({ ok: true }, 200, cors);
  },
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
