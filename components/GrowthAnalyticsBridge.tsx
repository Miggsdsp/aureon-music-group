'use client';

import { useEffect } from 'react';
import { trackAnalytics } from '@/lib/track-analytics';

export default function GrowthAnalyticsBridge() {
  useEffect(() => {
    let searchTimer: number | undefined;
    const onInput = (event: Event) => {
      const input = event.target as HTMLInputElement;
      if (!(input instanceof HTMLInputElement)) return;
      const context = `${input.placeholder} ${input.getAttribute('aria-label') || ''}`.toLowerCase();
      if (!context.includes('search')) return;
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        const query = input.value.trim();
        if (query.length >= 2) trackAnalytics({ eventType: 'search_used', entityType: 'search', searchQuery: query });
      }, 700);
    };

    const onClick = (event: MouseEvent) => {
      const element = (event.target as HTMLElement)?.closest('button,a');
      if (!element) return;
      const label = String(element.textContent || element.getAttribute('aria-label') || '').trim().toLowerCase();
      const href = element instanceof HTMLAnchorElement ? element.href : '';
      const playlistCard = element.closest('[class*="playlistCard"]');
      const playlistName = String(playlistCard?.querySelector('h3')?.textContent || '').trim();
      if (label.includes('play playlist')) trackAnalytics({ eventType: 'playlist_played', entityType: 'playlist', playlistName });
      else if (label === 'remove' && playlistCard) trackAnalytics({ eventType: 'playlist_song_removed', entityType: 'playlist', playlistName });
      else if (label === 'add' && element.closest('[class*="addRow"]')) trackAnalytics({ eventType: 'playlist_song_added', entityType: 'playlist' });
      else if (label.includes('delete') && playlistCard) trackAnalytics({ eventType: 'playlist_deleted', entityType: 'playlist', playlistName });
      else if (label.includes('share') && (href.includes('ref=') || href.includes('referral'))) trackAnalytics({ eventType: 'referral_shared', entityType: 'referral', referralCode: new URL(href, window.location.href).searchParams.get('ref') || '' });
      else if (href.includes('/membership')) trackAnalytics({ eventType: 'membership_checkout_started', entityType: 'membership', metadata: { source: window.location.pathname } });
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      if (!(form instanceof HTMLFormElement)) return;
      const playlistInput = form.querySelector<HTMLInputElement>('input[placeholder*="playlist" i]');
      if (playlistInput?.value.trim()) trackAnalytics({ eventType: 'playlist_created', entityType: 'playlist', playlistName: playlistInput.value.trim() });
    };

    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.eventType) trackAnalytics(detail);
    };

    document.addEventListener('input', onInput, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    window.addEventListener('aureon-analytics', onCustom);
    return () => {
      window.clearTimeout(searchTimer);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      window.removeEventListener('aureon-analytics', onCustom);
    };
  }, []);
  return null;
}
