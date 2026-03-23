import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import it from "./it.json";
import es from "./es.json";
import fr from "./fr.json";
import de from "./de.json";

export const i18nReady = i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    it: { translation: it },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export function setAppLanguage(lang: string) {
  i18n.changeLanguage(lang);
}

export default i18n;
