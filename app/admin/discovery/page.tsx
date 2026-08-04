'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Activity, Album, ArrowDown, BrainCircuit, Clock3, Disc3, ListMusic, MousePointerClick, Music2, Play, Sparkles, TrendingUp, Users } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { firestore } from '@/lib/firebase-client';
import styles from './discovery.module.css';

type Row = Record<string, any>;
type Period = '24h' | '7d' | '30d' | 'all';
type DiscoveryCounters = { impressions: number; clicks: number; plays: number; completes: number; playlistAdds: number; conversions: number };
type EntityMetric = {
  id: string; title: string; artist: string; album: string; genre: string;
  impressions: number; clicks: number; plays: number; completes: number; playlistAdds: number; conversions: number;
  listenedSeconds: number; repeatPlays: number; shares: number;
};

const asDate = (value: any) => value?.toDate?.() || new Date(value?.seconds ? value.seconds * 1000 : value || 0);
const pct = (part: number, total: number) => total > 0 ? `${(part / total * 100).toFixed(1)}%` : '0.0%';
const hours = (seconds: number) => `${(seconds / 3600).toFixed(seconds >= 36000 ? 0 : 1)}h`;
const number = (value: unknown) => Number(value || 0) || 0;
const clean = (value: unknown, fallback = 'Unknown') => String(value || '').trim() || fallback;
const metadata = (event: Row) => event.metadata && typeof event.metadata === 'object' ? event.metadata : {};
const emptyCounters = (): DiscoveryCounters => ({ impressions: 0, clicks: 0, plays: 0, completes: 0, playlistAdds: 0, conversions: 0 });

function startFor(period: Period) {
  if (period === 'all') return 0;
  const multiplier = period === '24h' ? 1 : period === '7d' ? 7 : 30;
  return Date.now() - multiplier * 24 * 60 * 60 * 1000;
}

function buildEntities(events: Row[]) {
  const map = new Map<string, EntityMetric>();
  for (const event of events) {
    const type = clean(event.eventType, 'unknown');
    const meta = metadata(event);
    const id = clean(event.entityId || event.songId || event.albumId || event.artistId || event.playlistId, clean(event.title, 'unknown'));
    if (!id || id === 'unknown') continue;
    const item = map.get(id) || {
      id, title: clean(event.title || event.playlistName || event.albumTitle, 'Untitled'), artist: clean(event.artistName, 'Aureon Music Group'),
      album: clean(event.albumTitle, 'Single'), genre: clean(meta.genre || event.genre, 'Uncategorised'),
      impressions: 0, clicks: 0, plays: 0, completes: 0, playlistAdds: 0, conversions: 0, listenedSeconds: 0, repeatPlays: 0, shares: 0,
    };
    if (type === 'recommendation_impression') item.impressions += 1;
    if (type === 'recommendation_click') item.clicks += 1;
    if (type === 'recommendation_play' || type === 'song_play') item.plays += 1;
    if (type === 'recommendation_complete' || type === 'song_complete' || type === 'preview_complete') item.completes += 1;
    if (type === 'recommendation_playlist_add' || type === 'playlist_song_added') item.playlistAdds += 1;
    if (type === 'recommendation_conversion' || type === 'song_purchase' || type === 'song_download') item.conversions += 1;
    if (type === 'song_shared') item.shares += 1;
    item.listenedSeconds += number(event.listenedSeconds);
    if (number(meta.repeatListen) || number(event.playCount) > 1) item.repeatPlays += 1;
    map.set(id, item);
  }
  return [...map.values()];
}

function rankBy<T>(items: T[], score: (item: T) => number, limit = 6) {
  return [...items].sort((a, b) => score(b) - score(a)).slice(0, limit);
}

export default function DiscoveryDashboardPage() {
  const { authorised, loading } = useAdminAuth();
  const [period, setPeriod] = useState<Period>('7d');
  const [events, setEvents] = useState<Row[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || !authorised) return;
    return onSnapshot(collection(firestore, 'analyticsEvents'), snapshot => {
      setEvents(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
      setError('');
    }, snapshotError => {
      console.error(snapshotError);
      setError('Unable to load discovery analytics. Confirm administrator analytics permissions.');
    });
  }, [authorised, loading]);

  const report = useMemo(() => {
    const threshold = startFor(period);
    const filtered = events.filter(event => asDate(event.createdAt || event.receivedAt).getTime() >= threshold);
    const recommendation = filtered.filter(event => clean(event.eventType).startsWith('recommendation_'));
    const count = (type: string) => recommendation.filter(event => event.eventType === type).length;
    const impressions = count('recommendation_impression');
    const clicks = count('recommendation_click');
    const plays = count('recommendation_play');
    const completes = count('recommendation_complete');
    const playlistAdds = count('recommendation_playlist_add');
    const conversions = count('recommendation_conversion');
    const listeningSeconds = recommendation.reduce((sum, event) => sum + number(event.listenedSeconds), 0);
    const entities = buildEntities(filtered);

    const sourceMap = new Map<string, DiscoveryCounters>();
    const algorithmMap = new Map<string, DiscoveryCounters>();
    const fieldByType: Record<string, keyof DiscoveryCounters> = {
      recommendation_impression: 'impressions', recommendation_click: 'clicks', recommendation_play: 'plays',
      recommendation_complete: 'completes', recommendation_playlist_add: 'playlistAdds', recommendation_conversion: 'conversions',
    };
    for (const event of recommendation) {
      const meta = metadata(event);
      const source = clean(meta.recommendationSource, 'unknown');
      const algorithm = clean(meta.recommendationAlgorithm, 'unknown');
      const field = fieldByType[clean(event.eventType)];
      if (!field) continue;
      for (const [key, map] of [[source, sourceMap], [algorithm, algorithmMap]] as const) {
        const row = map.get(key) || emptyCounters();
        row[field] += 1;
        map.set(key, row);
      }
    }

    const artists = new Map<string, { name: string; plays: number; completes: number; impressions: number; recent: number; previous: number }>();
    const now = Date.now();
    for (const event of filtered) {
      const name = clean(event.artistName, 'Unknown artist');
      if (name === 'Unknown artist') continue;
      const row = artists.get(name) || { name, plays: 0, completes: 0, impressions: 0, recent: 0, previous: 0 };
      if (['song_play', 'recommendation_play'].includes(event.eventType)) row.plays += 1;
      if (['song_complete', 'recommendation_complete', 'preview_complete'].includes(event.eventType)) row.completes += 1;
      if (event.eventType === 'recommendation_impression') row.impressions += 1;
      const age = now - asDate(event.createdAt || event.receivedAt).getTime();
      if (age <= 3.5 * 24 * 60 * 60 * 1000) row.recent += 1;
      else if (age <= 7 * 24 * 60 * 60 * 1000) row.previous += 1;
      artists.set(name, row);
    }

    const playlists = new Map<string, { name: string; plays: number; additions: number; seconds: number; shares: number }>();
    for (const event of filtered) {
      const name = clean(event.playlistName || metadata(event).playlistName, '');
      if (!name) continue;
      const row = playlists.get(name) || { name, plays: 0, additions: 0, seconds: 0, shares: 0 };
      if (event.eventType === 'playlist_played') row.plays += 1;
      if (['playlist_song_added', 'recommendation_playlist_add'].includes(event.eventType)) row.additions += 1;
      if (event.eventType === 'referral_shared' || event.eventType === 'song_shared') row.shares += 1;
      row.seconds += number(event.listenedSeconds);
      playlists.set(name, row);
    }

    const genres = new Map<string, { name: string; plays: number; completes: number; recent: number; previous: number }>();
    for (const event of filtered) {
      const name = clean(metadata(event).genre || event.genre, '');
      if (!name) continue;
      const row = genres.get(name) || { name, plays: 0, completes: 0, recent: 0, previous: 0 };
      if (['song_play', 'recommendation_play'].includes(event.eventType)) row.plays += 1;
      if (['song_complete', 'recommendation_complete'].includes(event.eventType)) row.completes += 1;
      const age = now - asDate(event.createdAt || event.receivedAt).getTime();
      if (age <= 3.5 * 24 * 60 * 60 * 1000) row.recent += 1;
      else if (age <= 7 * 24 * 60 * 60 * 1000) row.previous += 1;
      genres.set(name, row);
    }

    const sourceRows = [...sourceMap.entries()].map(([name, values]) => ({ name, ...values }));
    const algorithmRows = [...algorithmMap.entries()].map(([name, values]) => ({ name, ...values }));
    const artistRows = [...artists.values()];
    const playlistRows = [...playlists.values()];
    const genreRows = [...genres.values()];

    const insights: Array<{ tone: 'hot' | 'positive' | 'warning'; title: string; detail: string; action: string }> = [];
    const completionWinner = rankBy(entities.filter(item => item.plays >= 3), item => item.completes / Math.max(1, item.plays), 1)[0];
    if (completionWinner) insights.push({ tone: 'positive', title: `${completionWinner.title} has an unusually strong completion rate`, detail: `${pct(completionWinner.completes, completionWinner.plays)} completion from ${completionWinner.plays} tracked plays.`, action: 'Increase placement in Similar Songs and homepage discovery.' });
    const momentumArtist = rankBy(artistRows, item => (item.recent + 1) / (item.previous + 1), 1)[0];
    if (momentumArtist && momentumArtist.recent > momentumArtist.previous) insights.push({ tone: 'hot', title: `${momentumArtist.name} is gaining momentum`, detail: `${Math.round(((momentumArtist.recent + 1) / (momentumArtist.previous + 1) - 1) * 100)}% growth versus the previous comparison window.`, action: 'Consider featuring the artist in Trending and New Releases.' });
    const replayAlbum = rankBy(entities.filter(item => item.album !== 'Single'), item => item.repeatPlays * 4 + item.completes, 1)[0];
    if (replayAlbum && replayAlbum.repeatPlays > 0) insights.push({ tone: 'positive', title: `${replayAlbum.album} is showing replay behaviour`, detail: `${replayAlbum.repeatPlays} repeat-listen signals with ${replayAlbum.completes} completions.`, action: 'Test a dedicated album recommendation placement.' });
    const risingGenre = rankBy(genreRows, item => (item.recent + 1) / (item.previous + 1), 1)[0];
    if (risingGenre && risingGenre.recent > risingGenre.previous) insights.push({ tone: 'hot', title: `${risingGenre.name} is increasing in popularity`, detail: `${risingGenre.recent} recent discovery interactions versus ${risingGenre.previous} previously.`, action: 'Increase genre visibility in playlists and Discover.' });
    const playlistWinner = rankBy(playlistRows, item => item.seconds + item.plays * 60, 1)[0];
    if (playlistWinner) insights.push({ tone: 'positive', title: `${playlistWinner.name} is driving listening time`, detail: `${hours(playlistWinner.seconds)} generated with ${playlistWinner.plays} playlist starts.`, action: 'Keep this playlist prominent and refresh it regularly.' });
    if (!insights.length) insights.push({ tone: 'warning', title: 'More discovery activity is needed', detail: 'The dashboard is active, but there is not yet enough volume to identify statistically useful outliers.', action: 'Continue collecting recommendation impressions, plays and completions.' });

    return {
      impressions, clicks, plays, completes, playlistAdds, conversions, listeningSeconds,
      topSongs: rankBy(entities, item => item.plays * 2 + item.completes * 3 + item.clicks + item.shares * 4),
      topArtists: rankBy(artistRows, item => item.plays * 2 + item.completes * 3 + item.recent),
      fastestReleases: rankBy(entities, item => item.clicks * 2 + item.plays * 3 + item.completes * 4 + item.repeatPlays * 5),
      viralPlaylists: rankBy(playlistRows, item => item.shares * 8 + item.additions * 5 + item.plays * 2 + item.seconds / 60),
      sourceRows: rankBy(sourceRows, item => item.plays + item.clicks + item.conversions * 4, 12),
      algorithmRows: rankBy(algorithmRows, item => item.plays + item.clicks + item.conversions * 4, 12), insights,
    };
  }, [events, period]);

  const funnel = [
    ['Recommendation Shown', report.impressions, Sparkles], ['Recommendation Clicked', report.clicks, MousePointerClick],
    ['Song Played', report.plays, Play], ['Song Completed', report.completes, Music2],
    ['Playlist Added', report.playlistAdds, ListMusic], ['Downloaded / Purchased', report.conversions, Disc3],
  ] as const;
  const kpis = [
    ['Recommendation CTR', pct(report.clicks, report.impressions), MousePointerClick], ['Plays generated', report.plays.toLocaleString(), Play],
    ['Listening hours generated', hours(report.listeningSeconds), Clock3], ['Playlist additions', report.playlistAdds.toLocaleString(), ListMusic],
    ['Conversion rate', pct(report.conversions, report.impressions), Activity],
  ] as const;
  const ranking = (title: string, icon: ReactNode, rows: any[], render: (row: any, index: number) => ReactNode) => (
    <article className={styles.panel}><div className={styles.panelTitle}>{icon}<h2>{title}</h2></div><div className={styles.rankList}>{rows.length ? rows.map(render) : <p className={styles.empty}>No discovery data for this period.</p>}</div></article>
  );

  return <AdminShell>
    <div className="admin-page-heading"><p className="admin-kicker">Recommendation intelligence</p><h1>Music Discovery</h1><p>Measure recommendation performance, identify catalogue momentum and understand how discovery converts into deeper listening and revenue.</p></div>
    {error && <div className="admin-cms-message">{error}</div>}
    <div className="admin-toolbar"><label>Reporting period <select value={period} onChange={event => setPeriod(event.target.value as Period)}><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="all">All recorded data</option></select></label><span className={styles.live}><span/> Live Firestore analytics</span></div>
    <section className={styles.kpis} aria-label="Recommendation performance">{kpis.map(([label, value, Icon]) => <article key={label}><Icon/><span>{label}</span><strong>{value}</strong></article>)}</section>
    <section className={styles.dashboardGrid}>
      {ranking('Top trending songs', <Music2/>, report.topSongs, (row, index) => <div className={styles.rank} key={row.id}><b>#{index + 1}</b><div><strong>{row.title}</strong><span>{row.artist}</span></div><em>{row.plays} plays · {pct(row.completes, row.plays)} complete</em></div>)}
      {ranking('Top trending artists', <Users/>, report.topArtists, (row, index) => <div className={styles.rank} key={row.name}><b>#{index + 1}</b><div><strong>{row.name}</strong><span>{row.plays} plays</span></div><em>{pct(row.completes, row.plays)} complete</em></div>)}
      {ranking('Fastest growing releases', <TrendingUp/>, report.fastestReleases, (row, index) => <div className={styles.rank} key={row.id}><b>#{index + 1}</b><div><strong>{row.title}</strong><span>{row.album}</span></div><em>{row.clicks} clicks · {row.repeatPlays} repeats</em></div>)}
      {ranking('Viral playlists', <ListMusic/>, report.viralPlaylists, (row, index) => <div className={styles.rank} key={row.name}><b>#{index + 1}</b><div><strong>{row.name}</strong><span>{row.additions} additions</span></div><em>{hours(row.seconds)} listening</em></div>)}
    </section>
    <section className={styles.panel}><div className={styles.panelTitle}><Activity/><h2>Discovery Funnel</h2></div><div className={styles.funnel}>{funnel.map(([label, value, Icon], index) => <div className={styles.funnelStep} key={label}><div><Icon/><span>{label}</span><strong>{value.toLocaleString()}</strong><small>{index === 0 ? '100% of shown recommendations' : `${pct(value, funnel[index - 1][1])} from previous stage`}</small></div>{index < funnel.length - 1 && <ArrowDown/>}</div>)}</div></section>
    <section className={styles.panel}><div className={styles.panelTitle}><BrainCircuit/><h2>AI Insights</h2></div><div className={styles.insights}>{report.insights.map((insight, index) => <article className={styles[insight.tone]} key={`${insight.title}-${index}`}><Sparkles/><div><h3>{insight.title}</h3><p>{insight.detail}</p><strong>{insight.action}</strong></div></article>)}</div></section>
    <section className={styles.tables}>
      <article className={styles.panel}><div className={styles.panelTitle}><Sparkles/><h2>Recommendation Sources</h2></div><div className="admin-table-wrap"><table><thead><tr><th>Source</th><th>Impressions</th><th>CTR</th><th>Plays</th><th>Completion</th><th>Conversions</th></tr></thead><tbody>{report.sourceRows.length ? report.sourceRows.map(row => <tr key={row.name}><td>{row.name}</td><td>{row.impressions}</td><td>{pct(row.clicks, row.impressions)}</td><td>{row.plays}</td><td>{pct(row.completes, row.plays)}</td><td>{row.conversions}</td></tr>) : <tr><td colSpan={6}>No source data yet.</td></tr>}</tbody></table></div></article>
      <article className={styles.panel}><div className={styles.panelTitle}><Album/><h2>Recommendation Algorithms</h2></div><div className="admin-table-wrap"><table><thead><tr><th>Algorithm</th><th>Impressions</th><th>CTR</th><th>Play rate</th><th>Completion</th><th>Conversion</th></tr></thead><tbody>{report.algorithmRows.length ? report.algorithmRows.map(row => <tr key={row.name}><td>{row.name}</td><td>{row.impressions}</td><td>{pct(row.clicks, row.impressions)}</td><td>{pct(row.plays, row.impressions)}</td><td>{pct(row.completes, row.plays)}</td><td>{pct(row.conversions, row.impressions)}</td></tr>) : <tr><td colSpan={6}>No algorithm data yet.</td></tr>}</tbody></table></div></article>
    </section>
  </AdminShell>;
}
