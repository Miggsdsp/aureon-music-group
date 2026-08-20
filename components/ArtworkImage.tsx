'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_ARTWORK } from '@/lib/get-artwork';

type Props = Omit<ImageProps, 'src'> & { src?: string | null; fallbackSrc?: string };

function isRemote(source: string) {
  return /^https?:\/\//i.test(source);
}

function cleanSource(value: string | null | undefined) {
  const source = String(value || '').trim();
  if (!source) return '';
  if (source.startsWith('/') || source.startsWith('data:') || source.startsWith('blob:') || isRemote(source)) return source;
  return '';
}

export function ArtworkImage({ src, fallbackSrc = DEFAULT_ARTWORK, alt, onError, quality = 75, sizes = '(max-width: 640px) 44vw, (max-width: 1100px) 25vw, 320px', ...props }: Props) {
  const requestedSrc = cleanSource(src);
  const requestedFallback = cleanSource(fallbackSrc) || DEFAULT_ARTWORK;
  const [currentSrc, setCurrentSrc] = useState(requestedSrc || requestedFallback);
  const [failedCompletely, setFailedCompletely] = useState(false);

  const unoptimized = useMemo(() => isRemote(currentSrc) || currentSrc.startsWith('data:') || currentSrc.startsWith('blob:'), [currentSrc]);

  useEffect(() => {
    setCurrentSrc(requestedSrc || requestedFallback);
    setFailedCompletely(false);
  }, [requestedSrc, requestedFallback]);

  if (failedCompletely) return null;

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
        if (currentSrc !== requestedFallback) {
          setCurrentSrc(requestedFallback);
          return;
        }
        if (currentSrc !== DEFAULT_ARTWORK) {
          setCurrentSrc(DEFAULT_ARTWORK);
          return;
        }
        setFailedCompletely(true);
      }}
    />
  );
}
