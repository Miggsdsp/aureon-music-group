'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_ARTWORK } from '@/lib/get-artwork';

type Props = Omit<ImageProps, 'src'> & { src?: string | null; fallbackSrc?: string };

function isOptimisable(source: string) {
  if (source.startsWith('/')) return true;
  try {
    const host = new URL(source).hostname;
    return host === 'firebasestorage.googleapis.com' || host === 'storage.googleapis.com' || host.endsWith('.googleusercontent.com');
  } catch {
    return false;
  }
}

export function ArtworkImage({ src, fallbackSrc = DEFAULT_ARTWORK, alt, onError, quality = 75, sizes = '(max-width: 640px) 44vw, (max-width: 1100px) 25vw, 320px', ...props }: Props) {
  const [currentSrc, setCurrentSrc] = useState(String(src || fallbackSrc));
  const unoptimized = useMemo(() => !isOptimisable(currentSrc), [currentSrc]);

  useEffect(() => setCurrentSrc(String(src || fallbackSrc)), [src, fallbackSrc]);

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt}
      quality={quality}
      sizes={sizes}
      unoptimized={unoptimized}
      onError={event => {
        onError?.(event);
        if (currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
      }}
    />
  );
}
