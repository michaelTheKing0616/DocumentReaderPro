import { useCallback, useMemo, useState } from 'react';
import en from './en.json';
import es from './es.json';

export type Locale = 'en' | 'es';

type TranslationTree = {
  [key: string]: string | TranslationTree;
};

const catalogs: Record<Locale, TranslationTree> = { en, es };

let currentLocale: Locale = 'en';

function resolveKey(tree: TranslationTree, key: string): string | undefined {
  const parts = key.split('.');
  let node: string | TranslationTree = tree;
  for (const part of parts) {
    if (typeof node === 'string' || node[part] === undefined) {
      return undefined;
    }
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(params[k] ?? ''));
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const localized = resolveKey(catalogs[currentLocale], key);
  const fallback = resolveKey(catalogs.en, key);
  return interpolate(localized ?? fallback ?? key, params);
}

export function useTranslation() {
  const [tick, setTick] = useState(0);
  const translate = useCallback(
    (key: string, params?: Record<string, string | number>) => t(key, params),
    [tick]
  );
  const changeLocale = useCallback((locale: Locale) => {
    setLocale(locale);
    setTick((n) => n + 1);
  }, []);
  const locale = useMemo(() => getLocale(), [tick]);
  return { t: translate, locale, setLocale: changeLocale };
}

export default { t, setLocale, getLocale, useTranslation };
