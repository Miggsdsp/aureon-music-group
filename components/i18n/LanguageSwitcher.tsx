'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Globe2 } from 'lucide-react';
import { localeMeta, locales, localePath, stripLocale, type Locale } from '@/lib/i18n/config';
import { useI18n } from './I18nProvider';
import styles from './LanguageSwitcher.module.css';

export function LanguageSwitcher() {
  const pathname = usePathname();
  const search = useSearchParams();
  const { locale: current } = useI18n();

  function change(locale: Locale) {
    if (locale === current) return;

    document.cookie = `aureon_locale=${locale};path=/;max-age=31536000;samesite=lax`;
    const base = stripLocale(pathname);
    const query = search.toString();
    const target = `${localePath(base, locale)}${query ? `?${query}` : ''}`;

    window.location.href = target;
  }

  return (
    <label className={styles.wrap}>
      <Globe2 size={15} />
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        value={current}
        onChange={event => change(event.target.value as Locale)}
      >
        {locales.map(locale => (
          <option value={locale} key={locale}>
            {localeMeta[locale].label}
          </option>
        ))}
      </select>
    </label>
  );
}
