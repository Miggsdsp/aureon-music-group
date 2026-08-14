'use client';

import { useEffect } from 'react';
import { useI18n } from './I18nProvider';
import { interfaceTranslations } from '@/lib/i18n/interface-translations';
import { commonUiTranslations } from '@/lib/i18n/common-ui-translations';
import { pageUiTranslations } from '@/lib/i18n/page-ui-translations';
import { memberAreaTranslations } from '@/lib/i18n/member-area-translations';

const ATTRIBUTES = ['placeholder', 'title', 'aria-label'] as const;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'OPTION', 'CODE', 'PRE']);
const ARROW_RE = /\s*([→↗›»]+)\s*$/;

function buildLookup(phrases: Record<string, string>) {
  const lower = new Map<string, string>();
  for (const [key, value] of Object.entries(phrases)) lower.set(key.toLocaleLowerCase(), value);
  return lower;
}

function preserveCase(source: string, translated: string) {
  if (source.length > 1 && source === source.toLocaleUpperCase()) return translated.toLocaleUpperCase();
  return translated;
}

function findPhrase(source: string, phrases: Record<string, string>, lower: Map<string, string>) {
  const exact = phrases[source];
  if (exact) return exact;
  const insensitive = lower.get(source.toLocaleLowerCase());
  return insensitive ? preserveCase(source, insensitive) : null;
}

function translateCore(source: string, phrases: Record<string, string>, lower: Map<string, string>) {
  const direct = findPhrase(source, phrases, lower);
  if (direct) return direct;

  const arrow = source.match(ARROW_RE);
  if (arrow) {
    const base = source.slice(0, arrow.index).trim();
    const translated = findPhrase(base, phrases, lower);
    if (translated) return `${translated} ${arrow[1]}`;
  }

  const patterns = [
    { re: /^(40s preview)\s*:\s*(.+)$/i, key: '40s Preview', join: ': ' },
    { re: /^(buy full song)\s+(.+)$/i, key: 'Buy full song', join: ' ' },
    { re: /^(digital download)\s+(.+)$/i, key: 'Digital download', join: ' ' },
    { re: /^(secure payment)\s*[·•|-]\s*(instant ownership)$/i, key: 'Secure payment', second: 'Instant ownership', join: ' · ' },
    { re: /^(\d+)\s+tracks$/i, key: 'tracks', countFirst: true },
    { re: /^(\d+)\s+songs$/i, key: 'songs', countFirst: true },
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern.re);
    if (!match) continue;
    if (pattern.countFirst) {
      const translated = findPhrase(pattern.key, phrases, lower) || pattern.key;
      return `${match[1]} ${translated}`;
    }
    const first = findPhrase(pattern.key, phrases, lower) || pattern.key;
    if (pattern.second) {
      const second = findPhrase(pattern.second, phrases, lower) || pattern.second;
      return `${first}${pattern.join}${second}`;
    }
    return `${first}${pattern.join}${match[2]}`;
  }

  return source;
}

function translateText(value: string, phrases: Record<string, string>, lower: Map<string, string>) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const translated = translateCore(trimmed, phrases, lower);
  if (translated === trimmed) return value;
  const leading = value.match(/^\s*/)?.[0] || '';
  const trailing = value.match(/\s*$/)?.[0] || '';
  return `${leading}${translated}${trailing}`;
}

function translateTextNode(node: Text, phrases: Record<string, string>, lower: Map<string, string>) {
  const parent = node.parentElement;
  if (!parent || SKIP_TAGS.has(parent.tagName) || parent.closest('[data-i18n-skip="true"]')) return;
  const next = translateText(node.nodeValue || '', phrases, lower);
  if (next !== node.nodeValue) node.nodeValue = next;
}

function translateElement(root: ParentNode, phrases: Record<string, string>, lower: Map<string, string>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    translateTextNode(current as Text, phrases, lower);
    current = walker.nextNode();
  }

  if ('querySelectorAll' in root) {
    const elements = (root as ParentNode).querySelectorAll<HTMLElement>('*');
    for (const element of elements) {
      if (element.closest('[data-i18n-skip="true"]')) continue;
      for (const attr of ATTRIBUTES) {
        const value = element.getAttribute(attr);
        if (!value) continue;
        const translated = translateCore(value.trim(), phrases, lower);
        if (translated !== value.trim()) element.setAttribute(attr, translated);
      }
    }
  }
}

export function GlobalInterfaceTranslator() {
  const { locale } = useI18n();

  useEffect(() => {
    if (locale === 'en') return;
    const phrases = {
      ...(interfaceTranslations[locale] || {}),
      ...(commonUiTranslations[locale] || {}),
      ...(pageUiTranslations[locale] || {}),
      ...(memberAreaTranslations[locale] || {}),
    };
    if (!Object.keys(phrases).length) return;
    const lower = buildLookup(phrases);

    const apply = () => translateElement(document.body, phrases, lower);
    apply();

    const frame = requestAnimationFrame(apply);
    const delayed = window.setTimeout(apply, 250);
    const delayed2 = window.setTimeout(apply, 1000);

    let queued = false;
    const observer = new MutationObserver(mutations => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        for (const mutation of mutations) {
          if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
            translateTextNode(mutation.target as Text, phrases, lower);
            continue;
          }
          if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
            translateElement(mutation.target as Element, phrases, lower);
            continue;
          }
          for (const node of Array.from(mutation.addedNodes)) {
            if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text, phrases, lower);
            else if (node.nodeType === Node.ELEMENT_NODE) translateElement(node as Element, phrases, lower);
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES],
    });

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(delayed);
      window.clearTimeout(delayed2);
      observer.disconnect();
    };
  }, [locale]);

  return null;
}
