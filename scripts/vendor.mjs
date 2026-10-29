// Copie pdf.js (installé par npm) dans vendor/ pour que l'app le charge depuis son propre domaine.
import { cpSync, mkdirSync, existsSync } from "node:fs";

const src = "node_modules/pdfjs-dist/build";
if (!existsSync(src)) {
  console.error("pdfjs-dist introuvable : lance d'abord « npm install ».");
  process.exit(1);
}
mkdirSync("vendor", { recursive: true });
for (const f of ["pdf.min.mjs", "pdf.worker.min.mjs"]) cpSync(`${src}/${f}`, `vendor/${f}`);
cpSync("node_modules/pdfjs-dist/LICENSE", "vendor/LICENSE-pdfjs");
console.log("pdf.js copié dans vendor/");
