'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase-client';
import { trackAnalytics } from '@/lib/track-analytics';
import styles from './PreviewGatedVideo.module.css';

const AUDIO_PREVIEW_SECONDS = 40;
type Props = { src: string; poster?: string; title?: string; className?: string; videoId?: string; artistId?: string; artistName?: string };

export function PreviewGatedVideo({ src, poster, title = 'Aureon video', className = '', videoId, artistId, artistName }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewTracked = useRef(false);
  const [hasFullAudio, setHasFullAudio] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [audioPreviewEnded, setAudioPreviewEnded] = useState(false);
  const eventBase = { entityType: 'video', entityId: videoId || src, title, artistId, artistName };

  useEffect(() => onAuthStateChanged(firebaseAuth, async user => {
    setAccessChecked(false);
    if (!user) { setHasFullAudio(false); setAccessChecked(true); return; }
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/member/access', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data = await response.json();
      setHasFullAudio(Boolean(response.ok && data.active));
    } catch { setHasFullAudio(false); } finally { setAccessChecked(true); }
  }), []);

  useEffect(() => { setAudioPreviewEnded(false); previewTracked.current = false; const video = videoRef.current; if (video) video.muted = false; }, [src]);
  useEffect(() => { if (!hasFullAudio || !audioPreviewEnded) return; setAudioPreviewEnded(false); const video = videoRef.current; if (video) video.muted = false; }, [hasFullAudio, audioPreviewEnded]);

  function enforceAudioPreview() {
    const video = videoRef.current;
    if (!video || hasFullAudio || !accessChecked) return;
    if (audioPreviewEnded || video.currentTime >= AUDIO_PREVIEW_SECONDS) {
      if (!audioPreviewEnded) setAudioPreviewEnded(true);
      if (!previewTracked.current) { previewTracked.current = true; trackAnalytics({ ...eventBase, eventType: 'video_preview_complete', listenedSeconds: AUDIO_PREVIEW_SECONDS, durationSeconds: video.duration || 0, progressPercent: video.duration ? AUDIO_PREVIEW_SECONDS / video.duration * 100 : 0 }); }
      if (!video.muted) video.muted = true;
    }
  }

  return <div className={styles.wrap}>
    <video ref={videoRef} className={`${styles.video} ${className}`.trim()} src={src} controls preload="none" poster={poster} playsInline aria-label={title}
      onPlay={() => trackAnalytics({ ...eventBase, eventType: 'video_play', listenedSeconds: videoRef.current?.currentTime || 0, durationSeconds: videoRef.current?.duration || 0 })}
      onPause={() => { const video = videoRef.current; if (video && !video.ended) trackAnalytics({ ...eventBase, eventType: 'video_pause', listenedSeconds: video.currentTime, durationSeconds: video.duration || 0 }); }}
      onEnded={() => trackAnalytics({ ...eventBase, eventType: 'video_complete', listenedSeconds: videoRef.current?.duration || 0, durationSeconds: videoRef.current?.duration || 0, progressPercent: 100 })}
      onTimeUpdate={enforceAudioPreview} onSeeking={enforceAudioPreview} onVolumeChange={enforceAudioPreview}/>
    {accessChecked && !hasFullAudio && !audioPreviewEnded && <div className={styles.previewLabel}>40-second audio preview</div>}
    {audioPreviewEnded && !hasFullAudio && <div className={styles.notice} role="status"><p><strong>Audio preview finished</strong>The video will continue playing without sound. Subscribe to hear the complete soundtrack.</p><Link href="/membership">Unlock full audio →</Link></div>}
  </div>;
}
