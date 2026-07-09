'use client';

import { useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

export function LatestPlayButton({ title, src }: { title: string; src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio || hasError) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setHasError(true);
      setIsPlaying(false);
    }
  }

  return (
    <button className="latest-release latest-release-button" type="button" onClick={togglePlay} disabled={hasError}>
      {isPlaying ? <Pause size={13} /> : <Play size={13} />}
      {hasError ? 'Upload song file' : `Latest: ${title}`}
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onEnded={() => setIsPlaying(false)}
        onError={() => setHasError(true)}
      />
    </button>
  );
}
