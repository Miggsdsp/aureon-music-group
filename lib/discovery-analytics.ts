'use client';

import { useEffect } from 'react';
import { trackAnalytics } from '@/lib/track-analytics';

export type DiscoveryAction = 'impression' | 'click' | 'play' | 'complete' | 'playlist_add' | 'conversion';
export type DiscoveryEntity = {
  id: string;
  type: 'song' | 'artist' | 'album' | 'playlist' | 'video';
  title?: string;
  artistId?: string;
  artistName?: string;
  albumId?: string;
  albumTitle?: string;
  playlistId?: string;
  playlistName?: string;
};
export type DiscoveryContext = {
  source: string;
  algorithm: string;
  position: number;
  confidence?: number;
  interaction?: string;
  conversionType?: string;
};

const EVENT_BY_ACTION = {
  impression: 'recommendation_impression',
  click: 'recommendation_click',
  play: 'recommendation_play',
  complete: 'recommendation_complete',
  playlist_add: 'recommendation_playlist_add',
  conversion: 'recommendation_conversion',
} as const;

function impressionKey(entity: DiscoveryEntity, context: DiscoveryContext) {
  return `aureon-discovery:${context.source}:${context.algorithm}:${entity.type}:${entity.id}:${context.position}`;
}

export function trackDiscovery(action: DiscoveryAction, entity: DiscoveryEntity, context: DiscoveryContext, extra?: Record<string, string | number | boolean | null | undefined>) {
  trackAnalytics({
    eventType: EVENT_BY_ACTION[action],
    entityType: entity.type,
    entityId: entity.id,
    title: entity.title,
    artistId: entity.artistId,
    artistName: entity.artistName,
    albumId: entity.albumId,
    albumTitle: entity.albumTitle,
    playlistId: entity.playlistId,
    playlistName: entity.playlistName,
    metadata: {
      recommendationSource: context.source,
      recommendationAlgorithm: context.algorithm,
      recommendationPosition: context.position,
      recommendationConfidence: context.confidence ?? null,
      interaction: context.interaction ?? null,
      conversionType: context.conversionType ?? null,
      ...extra,
    },
  });
}

export function useDiscoveryImpressions(items: Array<{ entity: DiscoveryEntity; context: DiscoveryContext }>) {
  useEffect(() => {
    if (typeof window === 'undefined' || !items.length) return;
    for (const item of items) {
      const key = impressionKey(item.entity, item.context);
      if (sessionStorage.getItem(key)) continue;
      sessionStorage.setItem(key, '1');
      trackDiscovery('impression', item.entity, item.context);
    }
  }, [items]);
}
