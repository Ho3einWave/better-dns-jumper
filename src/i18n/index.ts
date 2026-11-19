import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import tr from "./tr.json";

const getStoredLang = (): string => {
    try {
        const stored = localStorage.getItem("better-dns-jumper-lang");
        if (stored === "tr" || stored === "en") return stored;
    } catch {}
    const browserLang = navigator.language?.toLowerCase() ?? "en";
    return browserLang.startsWith("tr") ? "tr" : "en";
};

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        tr: { translation: tr },
    },
    lng: getStoredLang(),
    fallbackLng: "en",
    interpolation: {
        escapeValue: false,
    },
});

export default i18n;
