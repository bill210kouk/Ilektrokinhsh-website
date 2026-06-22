/* =========================================================
   /api/send  —  Cloudflare Pages Function
   Δέχεται την υποβολή της φόρμας και στέλνει μήνυμα στο Telegram.
   Το token ΔΕΝ φαίνεται ποτέ στον browser — διαβάζεται από env vars.

   Απαραίτητες μεταβλητές (Cloudflare Pages → Settings →
   Environment variables, ως Secret):
     TELEGRAM_BOT_TOKEN   π.χ. 123456789:AA....
     TELEGRAM_CHAT_ID     π.χ. 123456789  (το chat id σου ή group id)
   ========================================================= */

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestPost({ request, env }) {
  const TOKEN = env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = env.TELEGRAM_CHAT_ID;
  if (!TOKEN || !CHAT_ID) {
    return json({ error: "Λείπουν οι ρυθμίσεις Telegram στον server." }, 500);
  }

  let data;
  try { data = await request.json(); } catch { data = {}; }
  data = data || {};

  // Anti-spam: αν συμπληρώθηκε το κρυφό πεδίο, είναι bot → "ok" χωρίς αποστολή
  if (data.company) return json({ ok: true }, 200);

  const name = String(data.name || "").trim();
  const phone = String(data.phone || "").trim();
  const message = String(data.message || "").trim();
  if (!name || !phone || !message) {
    return json({ error: "Λείπουν υποχρεωτικά πεδία." }, 400);
  }

  const email = String(data.email || "").trim() || "—";
  const subject = String(data.subject || "").trim() || "—";

  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const text =
    "🔔 <b>Νέο αίτημα από την ιστοσελίδα</b>\n\n" +
    "👤 <b>Όνομα:</b> " + esc(name) + "\n" +
    "📞 <b>Τηλέφωνο:</b> " + esc(phone) + "\n" +
    "✉️ <b>Email:</b> " + esc(email) + "\n" +
    "🏷️ <b>Θέμα:</b> " + esc(subject) + "\n\n" +
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
      const detail = await tg.text();
      console.error("Telegram error:", detail);
      return json({ error: "Σφάλμα αποστολής στο Telegram." }, 502);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: "Server error." }, 500);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
