import fs from "fs";
import path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

function loadJson(filename) {
  const filePath = path.join(__dirname, filename);
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

const translations = {
  en: loadJson("enCertificate.json"),
  am: loadJson("amCertificate.json"),
  or: loadJson("orCertificate.json"),
};

export function getCertificateDict(lang) {
  return translations[lang] || translations.en;
}