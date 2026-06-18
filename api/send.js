/* =========================================================
   /api/send  —  Vercel Serverless Function
   Δέχεται την υποβολή της φόρμας και στέλνει μήνυμα στο Telegram.
   Το token ΔΕΝ φαίνεται ποτέ στον browser — διαβάζεται από env vars.

   Απαραίτητες μεταβλητές περιβάλλοντος (Vercel → Settings → Environment Variables):
     TELEGRAM_BOT_TOKEN   π.χ. 123456789:AA....
     TELEGRAM_CHAT_ID     π.χ. 123456789  (το chat id σου ή group id)
   ========================================================= */

export default async function handler(req, res) {
  // CORS (σε περίπτωση που το frontend είναι σε άλλο domain, π.χ. GitHub Pages)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (!TOKEN || !CHAT_ID) {
    return res.status(500).json({ error: "Λείπουν οι ρυθμίσεις Telegram στον server." });
  }

  // Το body μπορεί να έρθει ως string ή ως object ανάλογα με το runtime
  let data = req.body;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { data = {}; }
  }
  data = data || {};

  // Anti-spam: αν συμπληρώθηκε το κρυφό πεδίο, είναι bot → "ok" χωρίς αποστολή
  if (data.company) return res.status(200).json({ ok: true });

  const name = String(data.name || "").trim();
  const phone = String(data.phone || "").trim();
  const message = String(data.message || "").trim();
  if (!name || !phone || !message) {
    return res.status(400).json({ error: "Λείπουν υποχρεωτικά πεδία." });
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
      return res.status(502).json({ error: "Σφάλμα αποστολής στο Telegram." });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error." });
  }
}
