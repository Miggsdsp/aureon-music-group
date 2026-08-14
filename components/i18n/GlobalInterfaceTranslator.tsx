'use client';

import { useEffect } from 'react';
import { useI18n } from './I18nProvider';
import { interfaceTranslations } from '@/lib/i18n/interface-translations';
import { commonUiTranslations } from '@/lib/i18n/common-ui-translations';
import { pageUiTranslations } from '@/lib/i18n/page-ui-translations';
import { memberAreaTranslations } from '@/lib/i18n/member-area-translations';
import { memberAreaExtraTranslations } from '@/lib/i18n/member-area-extra-translations';

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

function normaliseVisibleText(value: string) {
  return value
    .replace(/([.!?])(?=[A-ZÀ-ÖØ-Þ])/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findPhrase(source: string, phrases: Record<string, string>, lower: Map<string, string>) {
  const normalised = normaliseVisibleText(source);
  const exact = phrases[normalised];
  if (exact) return exact;
  const insensitive = lower.get(normalised.toLocaleLowerCase());
  return insensitive ? preserveCase(normalised, insensitive) : null;
}

function translateCore(source: string, phrases: Record<string, string>, lower: Map<string, string>) {
  const normalised = normaliseVisibleText(source);
  const direct = findPhrase(normalised, phrases, lower);
  if (direct) return direct;

  const arrow = normalised.match(ARROW_RE);
  if (arrow) {
    const base = normalised.slice(0, arrow.index).trim();
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
    const match = normalised.match(pattern.re);
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

  return normalised;
}

function translateText(value: string, phrases: Record<string, string>, lower: Map<string, string>) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const translated = translateCore(trimmed, phrases, lower);
  if (translated === normaliseVisibleText(trimmed)) return value;
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

function translateWholeElement(element: HTMLElement, phrases: Record<string, string>, lower: Map<string, string>) {
  if (element.closest('[data-i18n-skip="true"]')) return;
  const children = Array.from(element.childNodes);
  if (children.length < 2 || !children.some(node => node.nodeType === Node.ELEMENT_NODE)) return;
  const source = normaliseVisibleText(element.innerText || element.textContent || '');
  if (!source) return;
  const translated = translateCore(source, phrases, lower);
  if (translated === source) return;
  element.textContent = translated;
}

function translateElement(root: ParentNode, phrases: Record<string, string>, lower: Map<string, string>) {
  if (root instanceof HTMLElement) translateWholeElement(root, phrases, lower);
  if ('querySelectorAll' in root) {
    const compoundElements = (root as ParentNode).querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,span,strong,button,a,label,li,small');
    for (const element of compoundElements) translateWholeElement(element, phrases, lower);
  }

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
        if (translated !== normaliseVisibleText(value)) element.setAttribute(attr, translated);
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
      ...(memberAreaExtraTranslations[locale] || {}),
    };
    if (!Object.keys(phrases).length) return;
    const lower = buildLookup(phrases);

    const apply = () => translateElement(document.body, phrases, lower);
    apply();

    const frame = requestAnimationFrame(apply);
    const delayed = window.setTimeout(apply, 150);
    const delayed2 = window.setTimeout(apply, 500);
    const delayed3 = window.setTimeout(apply, 1500);

    let queued = false;
    const observer = new MutationObserver(mutations => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        for (const mutation of mutations) {
          if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
            translateTextNode(mutation.target as Text, phrases, lower);
            const parent = (mutation.target as Text).parentElement;
            if (parent) translateWholeElement(parent, phrases, lower);
            continue;
          }
          if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
            translateElement(mutation.target as Element, phrases, lower);
            continue;
          }
          for (const node of Array.from(mutation.addedNodes)) {
            if (node.nodeType === Node.TEXT_NODE) {
              translateTextNode(node as Text, phrases, lower);
              const parent = (node as Text).parentElement;
              if (parent) translateWholeElement(parent, phrases, lower);
            } else if (node.nodeType === Node.ELEMENT_NODE) translateElement(node as Element, phrases, lower);
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
      window.clearTimeout(delayed3);
      observer.disconnect();
    };
  }, [locale]);

  return null;
}