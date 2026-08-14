'use client';

import { useEffect } from 'react';
import { useI18n } from './I18nProvider';
import { interfaceTranslations } from '@/lib/i18n/interface-translations';

const ATTRIBUTES = ['placeholder', 'title', 'aria-label'] as const;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'OPTION', 'CODE', 'PRE']);

function translateText(value: string, phrases: Record<string, string>) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const translated = phrases[trimmed];
  if (!translated) return value;
  const leading = value.match(/^\s*/)?.[0] || '';
  const trailing = value.match(/\s*$/)?.[0] || '';
  return `${leading}${translated}${trailing}`;
}

function translateElement(root: ParentNode, phrases: Record<string, string>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || SKIP_TAGS.has(parent.tagName) || parent.closest('[data-i18n-skip="true"]')) continue;
    const next = translateText(node.nodeValue || '', phrases);
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  if ('querySelectorAll' in root) {
    const elements = (root as ParentNode).querySelectorAll<HTMLElement>('*');
    for (const element of elements) {
      if (element.closest('[data-i18n-skip="true"]')) continue;
      for (const attr of ATTRIBUTES) {
        const value = element.getAttribute(attr);
        if (!value) continue;
        const translated = phrases[value.trim()];
        if (translated) element.setAttribute(attr, translated);
      }
    }
  }
}

export function GlobalInterfaceTranslator() {
  const { locale } = useI18n();

  useEffect(() => {
    if (locale === 'en') return;
    const phrases = interfaceTranslations[locale];
    if (!phrases || !Object.keys(phrases).length) return;

    translateElement(document.body, phrases);

    let queued = false;
    const observer = new MutationObserver(mutations => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        for (const mutation of mutations) {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node.nodeType === Node.TEXT_NODE) {
              const text = node as Text;
              const parent = text.parentElement;
              if (!parent || SKIP_TAGS.has(parent.tagName) || parent.closest('[data-i18n-skip="true"]')) continue;
              const next = translateText(text.nodeValue || '', phrases);
              if (next !== text.nodeValue) text.nodeValue = next;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              translateElement(node as Element, phrases);
            }
          }
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [locale]);

  return null;
}
