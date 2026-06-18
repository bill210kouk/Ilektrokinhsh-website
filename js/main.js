/* =========================================================
   Κουκογιώργος Ηλεκτροκίνηση — main.js
   Διαχείριση φόρμας επικοινωνίας + αποστολή στο backend (Telegram)
   ========================================================= */

// Πού στέλνει η φόρμα.
// • Vercel  -> "/api/send"   (προεπιλογή, ασφαλές)
// • Cloudflare Worker -> βάλε εδώ το URL του worker, π.χ.
//   "https://koukogiorgos-form.<λογαριασμός>.workers.dev"
const FORM_ENDPOINT = "/api/send";

document.addEventListener("DOMContentLoaded", () => {
  // Έτος στο footer
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // (Κριτικές Google: προς το παρόν χειροκίνητα στατικά νούμερα.
  //  Έτοιμο endpoint /api/reviews στον server.js για μελλοντική ενεργοποίηση.)

  const form = document.getElementById("contact-form");
  if (!form) return;

  const statusEl = document.getElementById("form-status");
  const submitBtn = document.getElementById("submit-btn");

  const setStatus = (msg, type) => {
    statusEl.textContent = msg;
    statusEl.className = "form-status" + (type ? " " + type : "");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("", "");

    // Απλός έλεγχος υποχρεωτικών πεδίων
    const required = ["name", "phone", "message"];
    let firstInvalid = null;
    required.forEach((id) => {
      const el = form.elements[id];
      const empty = !el.value.trim();
      el.classList.toggle("invalid", empty);
      if (empty && !firstInvalid) firstInvalid = el;
    });

    if (firstInvalid) {
      setStatus("Συμπληρώστε τα υποχρεωτικά πεδία (όνομα, τηλέφωνο, μήνυμα).", "err");
      firstInvalid.focus();
      return;
    }

    // Συλλογή δεδομένων
    const payload = {
      name: form.elements["name"].value.trim(),
      phone: form.elements["phone"].value.trim(),
      email: form.elements["email"].value.trim(),
      subject: form.elements["subject"].value,
      message: form.elements["message"].value.trim(),
      company: form.elements["company"].value, // honeypot
      page: location.href,
    };

    submitBtn.classList.add("is-loading");

    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("HTTP " + res.status);

      form.reset();
      setStatus("Λάβαμε το αίτημά σας. Θα επικοινωνήσουμε σύντομα μαζί σας — ευχαριστούμε!", "ok");
    } catch (err) {
      console.error(err);
      setStatus(
        "Δεν ήταν δυνατή η αποστολή. Δοκιμάστε ξανά ή καλέστε μας στο 24220 29050.",
        "err"
      );
    } finally {
      submitBtn.classList.remove("is-loading");
    }
  });

  // Καθαρισμός σήμανσης λάθους καθώς πληκτρολογεί ο χρήστης
  ["name", "phone", "message"].forEach((id) => {
    const el = form.elements[id];
    el.addEventListener("input", () => el.classList.remove("invalid"));
  });
});
