import { NextResponse } from 'next/server';
import { getTrendingSongs, type TrendingWindow } from '@/lib/trending';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOWS = new Set<TrendingWindow>(['1h', '24h', '7d', '30d']);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requested = String(url.searchParams.get('window') || '24h') as TrendingWindow;
    const window = WINDOWS.has(requested) ? requested : '24h';
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || 12)));
    const songs = await getTrendingSongs(window, limit);
    return NextResponse.json({ window, songs }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
    });
  } catch (error) {
    console.error('Trending songs failed:', error);
    return NextResponse.json({ window: '24h', songs: [] }, { status: 200, headers: { 'Cache-Control': 'public, s-maxage=60' } });
  }
}
