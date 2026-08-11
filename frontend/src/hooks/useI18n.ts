import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import { isBackendAvailable } from "../utils/backendStatus";
import React from "react";

type I18nStrings = Record<string, unknown>;

interface I18nContextValue {
  t: (key: string, fallback?: string) => string;
  lang: string;
  setLang: (lang: string) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// Module-level cache to avoid reloading on remount
let cachedLang = "";
let cachedStrings: I18nStrings = {};

const LANG_KEY = "topos.lang";

/**
 * The catalogs, bundled at build time from backend/config/i18n/*.yaml
 * (see scripts/generate_i18n_catalogs.py). Without them the static PWA
 * has no strings at all: every label falls back to its inline German
 * default and switching the language changes nothing. Loaded lazily, so
 * a session only ever downloads the language it actually shows.
 */
const BUNDLED_CATALOGS = import.meta.glob<{ default: I18nStrings }>(
  "../i18n/catalogs/*.json",
);

async function loadBundledCatalog(lang: string): Promise<I18nStrings | null> {
  const loader = BUNDLED_CATALOGS[`../i18n/catalogs/${lang}.json`];
  if (!loader) return null;
  try {
    return (await loader()).default;
  } catch {
    return null;
  }
}

/** The language the user picked last, if any. */
function readStoredLang(): string | null {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null; // private mode
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [strings, setStrings] = useState<I18nStrings>(cachedStrings);
  const [lang, setLangState] = useState(cachedLang || readStoredLang() || "de");

  // The user's own choice wins over the backend default; only ask the
  // backend when nothing was picked yet (and only when one answers).
  useEffect(() => {
    if (cachedLang || readStoredLang()) return;
    void isBackendAvailable().then((available) => {
      if (!available) return;
      api.settings
        .getApp()
        .then((config) => {
          const appLang =
            ((config.app as Record<string, unknown>)
              ?.default_language as string) || "de";
          setLangState(appLang);
        })
        .catch(() => {});
    });
  }, []);

  // Load the catalog whenever the language changes. The bundled copy is
  // the baseline (works offline); a reachable backend may then override
  // it, which is what keeps plugin-provided strings available.
  useEffect(() => {
    let cancelled = false;
    if (lang === cachedLang && Object.keys(cachedStrings).length > 0) {
      setStrings(cachedStrings);
      return;
    }
    void (async () => {
      const bundled = await loadBundledCatalog(lang);
      if (cancelled) return;
      if (bundled) {
        cachedLang = lang;
        cachedStrings = bundled;
        setStrings(bundled);
      }
      if (!(await isBackendAvailable())) return;
      try {
        const fromBackend = await api.i18n.get(lang);
        if (cancelled || !fromBackend) return;
        cachedLang = lang;
        cachedStrings = fromBackend;
        setStrings(fromBackend);
      } catch {
        /* Keep the bundled catalog. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const setLang = useCallback((newLang: string) => {
    try {
      localStorage.setItem(LANG_KEY, newLang);
    } catch {
      /* private mode: the choice just does not survive a reload */
    }
    setLangState(newLang);
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const parts = key.split(".");
      let current: unknown = strings;
      for (const part of parts) {
        if (
          current &&
          typeof current === "object" &&
          part in (current as Record<string, unknown>)
        ) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return fallback || key;
        }
      }
      return typeof current === "string" ? current : fallback || key;
    },
    [strings],
  );

  const value: I18nContextValue = { t, lang, setLang };

  return React.createElement(I18nContext.Provider, { value }, children);
}

/**
 * Hook to access i18n translations.
 * Returns {t, lang, setLang} - setLang triggers live language switch.
 */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback for components rendered outside provider (e.g. tests)
    return {
      t: (key: string, fallback?: string) => fallback || key,
      lang: "de",
      setLang: () => {},
    };
  }
  return ctx;
}
