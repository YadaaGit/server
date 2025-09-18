import { useLanguage } from "./LanguageContext.jsx";
import en from "./enCertificate.json" assert { type: "json" };
import am from "./amCertificate.json" assert { type: "json" };
import or from "./orCertificate.json" assert { type: "json" };

const translations = { en, am, or };

export function getCertificateDict(lang) {
  return translations[lang] || translations.en;
}