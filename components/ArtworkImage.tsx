'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_ARTWORK } from '@/lib/get-artwork';

type Props = Omit<ImageProps, 'src'> & { src?: string | null; fallbackSrc?: string };

function isRemote(source: string) {
  return /^https?:\/\//i.test(source);
}

export function ArtworkImage({ src, fallbackSrc = DEFAULT_ARTWORK, alt, onError, quality = 75, sizes = '(max-width: 640px) 44vw, (max-width: 1100px) 25vw, 320px', ...props }: Props) {
  const [currentSrc, setCurrentSrc] = useState(String(src || fallbackSrc));

  // CMS artwork is stored remotely (primarily Firebase Storage). Serve remote
  // URLs directly instead of proxying them through Next's image optimiser.
  // This keeps signed/tokenised Firebase URLs intact and prevents _next/image
  // failures while local Aureon assets still receive Next image optimisation.
  const unoptimized = useMemo(() => isRemote(currentSrc) || currentSrc.startsWith('data:') || currentSrc.startsWith('blob:'), [currentSrc]);

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
