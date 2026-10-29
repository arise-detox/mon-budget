// Import de PDF (relevé bancaire, crédit en cours).
// Tout se passe dans le navigateur : le PDF n'est jamais envoyé sur internet.
// Les fonctions de lecture sont pures (testables) ; seule loadPdfjs() touche au navigateur.

const NBSP = /[  ]/g;
const AMOUNT_SRC = String.raw`(?<![\d,])[-+−–]?\s?\d{1,3}(?:[ .]\d{3})*,\d{2}(?!\d)|(?<![\d,])[-+−–]?\d+,\d{2}(?!\d)`;
const amounts = s => [...s.matchAll(new RegExp(AMOUNT_SRC, "g"))];
const DATE_START = /^\s*(\d{2})[\/.\-](\d{2})(?:[\/.\-](\d{4}|\d{2}))?(?!\d)/;
const DATE_ANY = /\b\d{2}[\/.]\d{2}(?:[\/.]\d{2,4})?\b/g;
const SKIP = /(ancien solde|nouveau solde|solde (pr[ée]c[ée]dent|au|initial|final|cr[ée]diteur|d[ée]biteur)|total (des )?(op[ée]rations|d[ée]bits?|cr[ée]dits?|mouvements)|sous[- ]total|report)/i;
const NOISE = /(page\s*\d|\biban\b|\bbic\b|relev[ée]|www\.|https?:|n°|siret|capital de)/i;
const INCOME_KW = /(virement\s+(re[cç]u|de\b)|\bvir(ement)?\s+(sepa\s+)?(re[cç]u|de\b)|salaire|\bpaie\b|remise de ch|remboursement|\bavoir\b)/i;

const pad = n => String(n).padStart(2, "0");
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const round = n => Math.round(n * 100) / 100;

export function parseAmount(str) {
  const s = str.replace(NBSP, " ").trim();
  return { value: round(Number(s.replace(/[^\d,]/g, "").replace(",", "."))), neg: /^[-−–]/.test(s), plus: /^\+/.test(s) };
}

export function addMonths(dateStr, n) {
  if (!n) return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  const last = new Date(y, m - 1 + n + 1, 0).getDate();
  return isoOf(new Date(y, m - 1 + n, Math.min(d, last)));
}

// ---------- Extraction du texte, ligne par ligne, avec positions ----------
export async function extractLines(pdfjs, data) {
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const rows = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const x = it.transform[4], y = it.transform[5];
      let row = rows.find(r => Math.abs(r.y - y) < 3);
      if (!row) rows.push((row = { y, items: [] }));
      row.items.push({ str: it.str, x, end: x + (it.width || 0) });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      lines.push({ text: r.items.map(i => i.str).join(" ").replace(NBSP, " ").replace(/\s+/g, " ").trim(), items: r.items });
    }
  }
  return lines;
}

export async function loadPdfjs() {
  const pdfjs = await import(new URL("vendor/pdf.min.mjs", document.baseURI).href);
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("vendor/pdf.worker.min.mjs", document.baseURI).href;
  return pdfjs;
}

// ---------- Aides ----------
function detectColumns(lines) {
  for (const l of lines) {
    const d = l.items.find(i => /^d[ée]bit/i.test(i.str.trim()));
    const c = l.items.find(i => /^cr[ée]dit/i.test(i.str.trim()));
    if (d && c) return { debit: (d.x + d.end) / 2, credit: (c.x + c.end) / 2 };
  }
  return null;
}
function guessYear(lines, today) {
  const count = {};
  for (const l of lines) for (const m of l.text.matchAll(/\d{2}[\/.]\d{2}[\/.](20\d{2})/g)) count[m[1]] = (count[m[1]] || 0) + 1;
  const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  return best ? Number(best[0]) : today.getFullYear();
}
function toISO(m, year) {
  const day = Number(m[1]), mon = Number(m[2]);
  let y = m[3] ? Number(m[3]) : year;
  if (y < 100) y += 2000;
  if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
  return `${y}-${pad(mon)}-${pad(day)}`;
}
function cleanLabel(text) {
  return text.replace(DATE_ANY, " ").replace(new RegExp(AMOUNT_SRC, "g"), " ").replace(/€|EUR/g, " ")
    .replace(/\s+/g, " ").replace(/^[\s|:;\-–]+|[\s|:;\-–]+$/g, "").slice(0, 80);
}
function amountItemCenter(line) {
  const it = line.items.find(i => /^[-+−–]?\s?\d[\d .]*,\d{2}$/.test(i.str.trim()));
  return it ? (it.x + it.end) / 2 : null;
}

// ---------- Relevé bancaire ----------
export function parseStatement(lines, today = new Date()) {
  const cols = detectColumns(lines);
  const year = guessYear(lines, today);
  const out = [];
  let last = null, continued = false;
  for (const l of lines) {
    if (SKIP.test(l.text)) { last = null; continue; }
    const dm = l.text.match(DATE_START);
    const am = amounts(l.text);
    if (dm && am.length) {
      const date = toISO(dm, year);
      if (!date) { last = null; continue; }
      const a = parseAmount(am[0][0]);
      if (!(a.value > 0)) { last = null; continue; }
      let type;
      const cx = cols && amountItemCenter(l);
      if (cx !== null && cols && cx !== undefined) type = Math.abs(cx - cols.credit) < Math.abs(cx - cols.debit) ? "income" : "expense";
      else if (a.neg) type = "expense";
      else if (a.plus) type = "income";
      else type = INCOME_KW.test(l.text) ? "income" : "expense";
      last = { date, label: cleanLabel(l.text) || "Opération", amount: a.value, type };
      continued = false;
      out.push(last);
    } else if (!dm && !am.length && last && !continued && l.text.length < 60 && !NOISE.test(l.text)) {
      last.label = (last.label + " " + l.text).slice(0, 80);   // libellé sur deux lignes
      continued = true;
    } else {
      last = null;
    }
  }
  return out;
}

// ---------- Crédit en cours ----------
export function parseCredit(lines, today = new Date()) {
  const year = guessYear(lines, today);
  const todayISO = isoOf(today);
  let schedule = [];
  for (const l of lines) {
    const dm = l.text.match(DATE_START) || l.text.match(/\b(\d{2})[\/.](\d{2})[\/.](\d{4})\b/);
    const am = amounts(l.text);
    if (!dm || !am.length) continue;
    const date = toISO(dm, year);
    const vals = am.map(a => parseAmount(a[0]).value);
    if (!date || date < todayISO || !(vals[0] > 0)) continue;
    if (schedule.some(s => s.date === date)) continue;
    const row = { date, amount: vals[0] };
    // Tableau complet (échéance, capital, intérêts, capital restant dû) : le dernier montant est le capital restant dû.
    if (vals.length >= 4 && vals[vals.length - 1] >= vals[0]) row.rest = vals[vals.length - 1];
    schedule.push(row);
  }
  if (schedule.length < 2) schedule = [];     // une seule ligne : pas un tableau d'amortissement

  let monthly = null, remaining = null, capital = null, borrowed = null, totalDue = null, duration = null, rate = null;
  for (const l of lines) {
    const t = l.text, am = amounts(t);
    if (monthly === null && /(mensualit[ée]|montant de l.?[ée]ch[ée]ance|[ée]ch[ée]ance mensuelle)/i.test(t) && am.length) monthly = parseAmount(am[0][0]).value;
    const r = t.match(/(\d{1,3})\s*(?:mensualit[ée]s?|[ée]ch[ée]ances?)\s*restantes?/i) || t.match(/(?:restantes?|reste)\s*:?\s*(\d{1,3})\s*(?:mois|mensualit|[ée]ch[ée]ance)/i);
    if (remaining === null && r) remaining = Number(r[1]);
    if (capital === null && /capital restant d[ûu]/i.test(t) && am.length) capital = parseAmount(am[am.length - 1][0]).value;
    if (borrowed === null && /(montant (du (cr[ée]dit|pr[êe]t)|emprunt[ée]|financ[ée])|capital emprunt[ée])/i.test(t) && am.length) borrowed = parseAmount(am[0][0]).value;
    if (totalDue === null && /(montant total (d[ûu]|[àa] rembourser)|total [àa] rembourser)/i.test(t) && am.length) totalDue = parseAmount(am[am.length - 1][0]).value;
    const d = t.match(/dur[ée]e[^\d]{0,30}(\d{1,3})\s*mois/i);
    if (duration === null && d) duration = Number(d[1]);
    const tx = t.match(/taux\s+(?:d[ée]biteur|nominal|d.?int[ée]r[êe]ts?|fixe)[^\d]{0,25}(\d{1,2}(?:,\d{1,4})?)\s*%/i);
    if (rate === null && tx) rate = Number(tx[1].replace(",", "."));
  }
  if (monthly === null && schedule.length) {            // échéance la plus fréquente du tableau
    const freq = {};
    for (const s of schedule) freq[s.amount] = (freq[s.amount] || 0) + 1;
    monthly = Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
  }
  if (remaining === null && schedule.length) remaining = schedule.length;
  if (remaining === null && totalDue && monthly) remaining = Math.round(totalDue / monthly);
  if (remaining === null && duration) remaining = duration;
  return { schedule, monthly, remaining, capital: capital ?? borrowed, totalDue, duration, rate };
}

export function buildSchedule(monthly, months, firstDate) {
  const n = Math.min(480, Math.max(0, parseInt(months, 10) || 0));
  const out = [];
  for (let i = 0; i < n; i++) out.push({ date: addMonths(firstDate, i), amount: round(monthly) });
  return out;
}

// ---------- Évolution du capital restant dû ----------
// Taux mensuel qui relie capital, mensualité et durée (bisection). null = incohérent.
export function solveRate(capital, monthly, n) {
  if (!(capital > 0 && monthly > 0 && n > 0)) return null;
  if (monthly * n <= capital * 1.0000001) return monthly * n < capital * 0.999 ? null : 0;
  const f = i => monthly * (1 - Math.pow(1 + i, -n)) / i - capital;   // décroissante en i
  let lo = 1e-9, hi = 0.01;
  while (f(hi) > 0 && hi < 5) hi *= 2;
  for (let k = 0; k < 100; k++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

// Capital restant dû après chaque échéance. rate = taux annuel en % (sinon déduit du capital, de la mensualité et de la durée).
export function amortize({ capital, monthly, months, rate }) {
  if (!(capital > 0) || !(monthly > 0) || !(months > 0)) return null;
  const i = rate != null && rate >= 0 ? rate / 1200 : solveRate(capital, monthly, months);
  const out = [];
  let b = capital;
  for (let k = 1; k <= months; k++) {
    b = i === null ? capital * (months - k) / months : b * (1 + i) - monthly;   // sans taux exploitable : décroissance linéaire
    out.push(round(Math.max(0, b)));
  }
  if (out[out.length - 1] < monthly) out[out.length - 1] = 0;
  return out;
}
