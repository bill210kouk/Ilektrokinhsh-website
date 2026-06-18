# Κουκογιώργος Ηλεκτροκίνηση — Ιστοσελίδα

Ιστοσελίδα παρουσίασης για το ηλεκτρολογικό κατάστημα **ΚΟΥΚΟΓΙΩΡΓΟΣ, ΕΥΣΤΑΘ., & ΣΙΑ Ο.Ε. — ΗΛΕΚΤΡΟΚΙΝΗΣΗ** (Αλμυρός).
Περιλαμβάνει αρχική σελίδα, υπηρεσίες, ωράριο, τοποθεσία και **φόρμα επικοινωνίας που στέλνει ειδοποίηση στο Telegram** σε κάθε υποβολή.

## Περιεχόμενα

```
index.html        Η ιστοσελίδα (αρχική + όλες οι ενότητες)
css/styles.css    Εμφάνιση / σχεδίαση
js/main.js        Λογική φόρμας — εδώ ορίζεις το FORM_ENDPOINT
api/send.js       Backend για Vercel (στέλνει στο Telegram, κρατά κρυφό το token)
worker.js         Εναλλακτικό backend για Cloudflare Workers
```

---

## 1) Φτιάξε το Telegram bot (2 λεπτά)

1. Άνοιξε το Telegram και μίλησε στο **@BotFather**.
2. Στείλε `/newbot`, δώσε όνομα και username. Θα πάρεις ένα **token** (μοιάζει με `123456789:AAH...`). Κράτησέ το.
3. Βρες το **chat id** σου: στείλε ένα μήνυμα στο νέο bot, μετά άνοιξε στον browser:
   `https://api.telegram.org/bot<ΤΟ_TOKEN>/getUpdates`
   και βρες το `"chat":{"id": ... }`. Αυτό είναι το `TELEGRAM_CHAT_ID`.
   *(Για ομάδα: πρόσθεσε το bot στην ομάδα και χρησιμοποίησε το id της ομάδας — ξεκινά με `-`.)*

---

## 2) Ανέβασέ το στο GitHub

Από τον φάκελο του project:

```bash
git init
git add .
git commit -m "Ιστοσελίδα Κουκογιώργος Ηλεκτροκίνηση"
git branch -M main
git remote add origin https://github.com/<USERNAME>/<REPO>.git
git push -u origin main
```

> Αντικατέστησε το `<USERNAME>/<REPO>` με το δικό σου. Αν δεν έχεις repo, φτιάξε ένα κενό στο github.com → **New repository**.

---

## 3) Κάνε τη φόρμα να δουλεύει (διάλεξε ΕΝΑ)

### Επιλογή Α — Vercel (προτεινόμενο, όλα σε ένα repo)

1. Πήγαινε στο [vercel.com](https://vercel.com) → **Add New → Project** και σύνδεσε το GitHub repo.
2. **Settings → Environment Variables**, πρόσθεσε:
   - `TELEGRAM_BOT_TOKEN` = το token από το BotFather
   - `TELEGRAM_CHAT_ID` = το chat id σου
3. **Deploy**. Έτοιμο — το `api/send.js` δουλεύει αυτόματα και το `FORM_ENDPOINT` (`/api/send`) ταιριάζει ήδη.

### Επιλογή Β — GitHub Pages + Cloudflare Worker

Το GitHub Pages φιλοξενεί μόνο στατικές σελίδες, οπότε το backend μπαίνει στο Cloudflare (δωρεάν):

1. Δημοσίευσε το site: **repo → Settings → Pages → Branch: main**.
2. Ανέβασε τον Worker:
   ```bash
   npm i -g wrangler
   wrangler deploy worker.js --name koukogiorgos-form
   wrangler secret put TELEGRAM_BOT_TOKEN
   wrangler secret put TELEGRAM_CHAT_ID
   ```
3. Στο `js/main.js` βάλε το URL του worker:
   ```js
   const FORM_ENDPOINT = "https://koukogiorgos-form.<λογαριασμός>.workers.dev";
   ```
   και κάνε ξανά `git push`.

---

## 4) Δοκίμασε

Άνοιξε την ιστοσελίδα, συμπλήρωσε τη φόρμα και πάτησε **Αποστολή αιτήματος**.
Θα πρέπει να λάβεις μήνυμα στο Telegram με τα στοιχεία.

---

## Τι μπορείς εύκολα να αλλάξεις

- **Τηλέφωνο / διεύθυνση:** αναζήτησε `24220 29050` και `Βασ. Γεωργίου` στο `index.html`.
- **Ωράριο:** στην ενότητα `id="hours"` του `index.html`.
  ⚠️ Το Σάββατο στο Google εμφανιζόταν ασαφές (`12:00 π.μ.–2:00 μ.μ.`), οπότε το έβαλα ως `08:00 – 14:00` για συνέπεια με τις άλλες μέρες — **άλλαξέ το αν ισχύει κάτι διαφορετικό**.
- **Υπηρεσίες / κείμενα:** ενότητα `id="services"`. Τα κείμενα είναι ενδεικτικά· προσάρμοσέ τα σε ό,τι πραγματικά προσφέρετε.
- **Χρώματα:** στην αρχή του `css/styles.css` (μεταβλητές `--blue`, `--earth-green`, κ.λπ.).

## Ασφάλεια

Το token του Telegram μένει **πάντα στον server** (env vars / secrets) και δεν φαίνεται ποτέ στον browser. Μην το γράψεις ποτέ μέσα στο `js/main.js`.
