import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";

export const i18nReady = i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
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
