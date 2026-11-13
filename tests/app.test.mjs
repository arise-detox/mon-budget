// Tests de l'application dans jsdom, avec une date figée au 13/11/2026.
// Ils vérifient surtout que les données déjà enregistrées ne sont jamais modifiées ou perdues.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const NOW = "2026-11-13T12:00:00", TODAY = "2026-11-13", KEY = "budget-app-v1";

function boot(seed, { confirmAnswer = true } = {}) {
  const dom = new JSDOM(html, {
    url: "http://localhost/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w) {
      const R = w.Date, t = new R(NOW).getTime();
      w.Date = class extends R { constructor(...a) { if (a.length) super(...a); else super(t); } static now() { return t; } };
      if (seed != null) w.localStorage.setItem(KEY, seed);
      w.confirm = () => confirmAnswer; w.alert = () => {}; w.scrollTo = () => {};
    },
  });
  return dom.window;
}
const stored = w => JSON.parse(w.localStorage.getItem(KEY));
const tick = (ms = 20) => new Promise(r => setTimeout(r, ms));
const add = (d, n) => { const [y, m, j] = d.split("-").map(Number), t = new Date(y, m - 1 + n, j); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };

// Données comme les produisait l'ancienne version (récurrents planifiés 12 mois à l'avance).
function oldData() {
  const items = [], plans = [];
  const mk = (id, kind, label, amount, first, k) => {
    plans.push({ id, kind, label, amount, first, months: null, k, cat: "" });
    for (let i = 0; i < k; i++) { const date = add(first, i); items.push({ id: `${id}-${i}`, type: kind, label, amount, date, cat: "", paid: kind === "income" || date < TODAY, plan: id }); }
  };
  mk("p1", "debit", "Loyer", 650, "2026-01-05", 23);       // jusqu'au 05/11/2027
  mk("p2", "income", "Salaire", 2000, "2026-01-28", 23);
  items.push({ id: "e1", type: "expense", label: "Courses", amount: 54.3, date: "2026-11-10", cat: "Courses", paid: true });
  items.push({ id: "e2", type: "debit", label: "Impôt", amount: 120, date: "2026-10-15", cat: "", paid: false, manual: true });   // volontairement « à venir »
  return { start: 1234.56, items, plans, eq: { h: 3, buf: 100 }, auto: true, lastBackup: "2026-10-01" };
}

test("les données existantes ne sont ni modifiées ni supprimées", () => {
  const seed = JSON.stringify(oldData()), before = JSON.parse(seed);
  const after = stored(boot(seed));
  assert.equal(after.start, before.start);
  assert.deepEqual(after.eq, before.eq);
  assert.equal(after.lastBackup, before.lastBackup);
  const byId = new Map(after.items.map(i => [i.id, i]));
  for (const it of before.items) assert.deepEqual(byId.get(it.id), it, `ligne ${it.id} modifiée`);
  for (const p of before.plans) {
    const q = after.plans.find(x => x.id === p.id);
    assert.deepEqual({ ...q, k: 0 }, { ...p, k: 0 }, `récurrent ${p.id} modifié`);
  }
});

test("une copie de sécurité identique est faite, et jamais écrasée", () => {
  const seed = JSON.stringify(oldData());
  const w = boot(seed);
  assert.equal(w.localStorage.getItem(KEY + "-avant-maj"), seed);
  const mid = w.localStorage.getItem(KEY);
  const w2 = boot(mid); w2.localStorage.setItem(KEY + "-avant-maj", seed);
  const w3 = boot(w2.localStorage.getItem(KEY)); w3.localStorage.setItem(KEY + "-avant-maj", seed);
  assert.equal(w3.localStorage.getItem(KEY + "-avant-maj"), seed);
  assert.equal(boot(null).localStorage.getItem(KEY + "-avant-maj"), null, "rien à copier pour un nouvel utilisateur");
});

test("les récurrents sont planifiés 5 ans à l'avance, sans doublon", () => {
  const w = boot(JSON.stringify(oldData()));
  const loyers = stored(w).items.filter(i => i.plan === "p1").map(i => i.date).sort();
  assert.equal(loyers.at(-1), "2031-11-05");
  assert.equal(new Set(loyers).size, loyers.length);
  const again = stored(boot(w.localStorage.getItem(KEY)));
  assert.equal(again.items.length, stored(w).items.length, "deuxième ouverture : rien de plus");
});

test("on peut naviguer jusqu'en 2031 et voir les prélèvements", () => {
  const w = boot(JSON.stringify(oldData()));
  for (let i = 0; i < 59; i++) w.document.getElementById("next").click();
  assert.match(w.document.getElementById("month").textContent, /octobre 2031/i);
  assert.match(w.document.getElementById("list").textContent, /Loyer/);
});

test("vue de l'année : 12 mois + total, et clic pour aller au mois", () => {
  const w = boot(JSON.stringify(oldData())), d = w.document;
  assert.equal(d.querySelectorAll("#yr-body button[data-m]").length, 12);
  assert.equal(d.getElementById("yr-label").textContent, "2026");
  d.querySelector('#yr-body button[data-m="2026-03"]').click();
  assert.match(d.getElementById("month").textContent, /mars 2026/i);
  d.getElementById("yr-next").click();
  assert.equal(d.getElementById("yr-label").textContent, "2027");
});

test("ajout d'une dépense avec catégorie, et répartition du mois", async () => {
  const w = boot(JSON.stringify(oldData())), d = w.document;
  d.getElementById("label").value = "Cinéma"; d.getElementById("amount").value = "12.5"; d.getElementById("cat").value = "Loisirs";
  d.getElementById("form").dispatchEvent(new w.Event("submit", { cancelable: true }));
  await tick(250);                                              // l'écriture est différée
  assert.equal(stored(w).items.find(i => i.label === "Cinéma").cat, "Loisirs");
  assert.equal(d.getElementById("cats").hidden, false);
  assert.match(d.getElementById("cats-body").textContent, /Loisirs/);
  assert.match(d.getElementById("cats-body").textContent, /Courses/);
});

test("équilibre sur 5 ans", () => {
  const w = boot(JSON.stringify(oldData())), d = w.document, sel = d.getElementById("eq-h");
  sel.value = "60"; sel.dispatchEvent(new w.Event("change"));
  assert.equal(sel.value, "60");
  assert.ok(d.getElementById("eq-out").textContent.length > 10);
});

const importFile = async (w, json) => {
  const inp = w.document.getElementById("import");
  Object.defineProperty(inp, "files", { value: [{ text: async () => json }], configurable: true });
  inp.dispatchEvent(new w.Event("change")); await tick();
};

test("import refusé : aucune donnée touchée ; fichier invalide : idem", async () => {
  const seed = JSON.stringify(oldData());
  const w = boot(seed, { confirmAnswer: false }), before = w.localStorage.getItem(KEY);
  await importFile(w, JSON.stringify({ start: 1, items: [], plans: [] }));
  assert.equal(w.localStorage.getItem(KEY), before);
  const w2 = boot(seed), b2 = w2.localStorage.getItem(KEY);
  await importFile(w2, "pas du json");
  assert.equal(w2.localStorage.getItem(KEY), b2);
});

test("import accepté puis annulé : on retrouve tout", async () => {
  const w = boot(JSON.stringify(oldData()));
  const before = JSON.stringify(stored(w));
  await importFile(w, JSON.stringify({ start: 5, items: [{ id: "x", type: "expense", label: "Test", amount: 1, date: "2026-11-01" }], plans: [] }));
  await tick(200);
  assert.equal(stored(w).items.length, 1);
  w.document.getElementById("toast-u").click(); await tick(200);
  assert.equal(JSON.stringify(stored(w)), before);
});

test("export CSV : séparateur « ; », montants signés, pas d'injection de formule", async () => {
  const w = boot(JSON.stringify({ start: 0, items: [
    { id: "a", type: "expense", label: "=HYPERLINK(1)", amount: 10.5, date: "2026-11-02", cat: "Test", paid: true },
    { id: "b", type: "income", label: "Salaire", amount: 100, date: "2026-11-03", cat: "", paid: true }], plans: [] }));
  let blob; w.URL.createObjectURL = b => { blob = b; return "blob:x"; }; w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {};
  w.document.getElementById("export-csv").click();
  const text = await new Promise(r => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(blob); });
  assert.match(text, /Date;Type;Libellé;Catégorie;Montant;Statut/);
  assert.match(text, /2026-11-02;"Dépense";"'=HYPERLINK\(1\)";"Test";-10,5;/);
  assert.match(text, /2026-11-03;"Revenu";"Salaire";"";100;/);
});

// ---------- Devises ----------
const fill = (w, o) => {
  const d = w.document;
  for (const [id, v] of Object.entries(o)) { d.getElementById(id).value = v; d.getElementById(id).dispatchEvent(new w.Event("input")); }
  d.getElementById("form").dispatchEvent(new w.Event("submit", { cancelable: true }));
};

test("devise : saisie en THB convertie en euros avec le taux, taux mémorisé", async () => {
  const w = boot(JSON.stringify(oldData())), d = w.document;
  d.getElementById("cur").value = "thb"; d.getElementById("cur").dispatchEvent(new w.Event("input"));
  assert.equal(d.getElementById("rate").hidden, false);
  d.getElementById("rate").value = "38.5"; d.getElementById("amount").value = "1000";
  d.getElementById("amount").dispatchEvent(new w.Event("input"));
  assert.match(d.getElementById("cur-hint").textContent, /25,97/);
  fill(w, { label: "Massage" });
  await tick(250);
  const st = stored(w), it = st.items.find(i => i.label === "Massage");
  assert.deepEqual([it.amount, it.cur, it.orig, it.rate], [25.97, "THB", 1000, 38.5]);
  assert.equal(st.rates.THB, 38.5);
  assert.match(d.getElementById("list").textContent, /THB/);
  assert.equal(d.getElementById("cur").value, "EUR");                      // retour à l'euro après l'ajout
  d.getElementById("cur").value = "THB"; d.getElementById("cur").dispatchEvent(new w.Event("input"));
  assert.equal(d.getElementById("rate").value, "38.5");                    // taux prérempli
});

test("devise : code invalide ou taux manquant => rien n'est ajouté", async () => {
  const w = boot(JSON.stringify(oldData())), n = stored(w).items.length;
  fill(w, { cur: "TH", rate: "38", amount: "10", label: "A" });
  fill(w, { cur: "THB", rate: "", amount: "10", label: "B" });
  await tick(250);
  assert.equal(stored(w).items.length, n);
});

test("devise : modification d'une ligne en devise recalcule le montant en euros", async () => {
  const w = boot(JSON.stringify(oldData())), d = w.document;
  fill(w, { cur: "USD", rate: "1.1", amount: "110", label: "Hôtel" });
  const id = [...d.querySelectorAll("#list li[data-id]")].find(li => li.textContent.includes("Hôtel")).dataset.id;
  d.querySelector(`li[data-id="${id}"] button[data-a=edit]`).click();
  d.getElementById("ie-orig").value = "220"; d.getElementById("ie-rate").value = "1.1";
  d.querySelector("li.ed button[data-a=isave]").click();
  await tick(250);
  const it = stored(w).items.find(i => i.id === id);
  assert.deepEqual([it.amount, it.orig, it.cur], [200, 220, "USD"]);
});

test("devise : l'export puis l'import conservent la devise d'origine ; anciennes lignes inchangées", async () => {
  const w = boot(JSON.stringify(oldData()));
  fill(w, { cur: "GBP", rate: "0.85", amount: "85", label: "Train" });
  await tick(250);
  const json = w.localStorage.getItem(KEY);
  const w2 = boot(null);
  await importFile(w2, json); await tick(250);
  const a = stored(w), b = stored(w2);
  assert.deepEqual(b.items.find(i => i.label === "Train"), a.items.find(i => i.label === "Train"));
  assert.equal(b.rates.GBP, 0.85);
  const old = oldData().items;
  for (const it of old) assert.deepEqual(b.items.find(i => i.id === it.id), it);
});
