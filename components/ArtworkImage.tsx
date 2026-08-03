'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useState } from 'react';
import { DEFAULT_ARTWORK } from '@/lib/get-artwork';

type Props = Omit<ImageProps, 'src'> & { src?: string | null; fallbackSrc?: string };

export function ArtworkImage({ src, fallbackSrc = DEFAULT_ARTWORK, alt, ...props }: Props) {
  const [currentSrc, setCurrentSrc] = useState(String(src || fallbackSrc));

  useEffect(() => setCurrentSrc(String(src || fallbackSrc)), [src, fallbackSrc]);

  return <Image {...props} src={currentSrc} alt={alt} onError={() => {
    if (currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
  }} />;
}
