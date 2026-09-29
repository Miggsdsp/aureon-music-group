import {Readable} from 'node:stream';
import {NextResponse} from 'next/server';
import {adminFirestore, adminStorage} from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PREVIEW_SECONDS = 40;
const HEADER_SCAN_BYTES = 16 * 1024 * 1024;

type WavInfo = {
  formatOffset: number;
  formatSize: number;
  dataOffset: number;
  dataLength: number;
  sampleRate: number;
  blockAlign: number;
  frameCount: number;
};

function fourCC(buffer: Buffer, offset: number) {
  return buffer.toString('ascii', offset, offset + 4);
}

function parseWav(buffer: Buffer): WavInfo {
  if (buffer.length < 44 || fourCC(buffer, 0) !== 'RIFF' || fourCC(buffer, 8) !== 'WAVE') {
    throw new Error('UNSUPPORTED_WAV');
  }

  let offset = 12;
  let formatOffset = -1;
  let formatSize = 0;
  let sampleRate = 0;
  let blockAlign = 0;
  let dataOffset = -1;
  let dataLength = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = fourCC(buffer, offset);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkData = offset + 8;
    if (chunkData + chunkSize > buffer.length) break;

    if (chunkId === 'fmt ' && chunkSize >= 16) {
      formatOffset = chunkData;
      formatSize = chunkSize;
      sampleRate = buffer.readUInt32LE(chunkData + 4);
      blockAlign = buffer.readUInt16LE(chunkData + 12);
    } else if (chunkId === 'data') {
      dataOffset = chunkData;
      dataLength = chunkSize;
      break;
    }

    offset = chunkData + chunkSize + (chunkSize & 1);
  }

  if (formatOffset < 0 || !formatSize || dataOffset < 0 || !dataLength || !sampleRate || !blockAlign) {
    throw new Error('UNSUPPORTED_WAV');
  }

  return {
    formatOffset,
    formatSize,
    dataOffset,
    dataLength,
    sampleRate,
    blockAlign,
    frameCount: Math.floor(dataLength / blockAlign),
  };
}

function previewHeader(formatChunk: Buffer, dataSize: number) {
  const header = Buffer.alloc(12 + 8 + formatChunk.length + 8);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(header.length - 8 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(formatChunk.length, 16);
  formatChunk.copy(header, 20);
  const dataHeaderOffset = 20 + formatChunk.length;
  header.write('data', dataHeaderOffset, 'ascii');
  header.writeUInt32LE(dataSize, dataHeaderOffset + 4);
  return header;
}

function parseRange(value: string | null, size: number) {
  if (!value?.startsWith('bytes=')) return null;
  const [startValue, endValue] = value.slice(6).split('-', 2);
  const start = startValue ? Number(startValue) : 0;
  const end = endValue ? Number(endValue) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) return null;
  return {start, end: Math.min(end, size - 1)};
}

async function readFileRange(file: ReturnType<ReturnType<typeof adminStorage.bucket>['file']>, start: number, end: number) {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const stream = file.createReadStream({start, end, validation: false});
    stream.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return Buffer.concat(chunks);
}

function songMasterPath(data: Record<string, any>) {
  const details = data.details && typeof data.details === 'object' ? data.details : {};
  return String(data.privateFilePath || details.privateFilePath || data.fullTrackPath || details.fullTrackPath || '').trim();
}

function legacyPublicPreview(data: Record<string, any>) {
  const details = data.details && typeof data.details === 'object' ? data.details : {};
  const value = String(data.previewUrl || details.previewUrl || data.previewAudioUrl || details.previewAudioUrl || '').trim();
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
  } catch {
    return value.startsWith('/') && !value.startsWith('/api/member/') && !value.startsWith('/api/download/') ? value : '';
  }
}

export async function GET(request: Request, context: {params: Promise<{songId: string}>}) {
  try {
    const {songId} = await context.params;
    const song = await adminFirestore.collection('songs').doc(songId).get();
    if (!song.exists || song.data()?.status !== 'published') return NextResponse.json({error: 'Song not found.'}, {status: 404});
    const songData = song.data() || {};

    const path = songMasterPath(songData);
    if (!path.startsWith('private/full-tracks/')) return NextResponse.json({error: 'Preview unavailable.'}, {status: 404});

    const file = adminStorage.bucket().file(path);
    const [metadata] = await file.getMetadata();
    const fileSize = Number(metadata.size || 0);
    if (!fileSize) return NextResponse.json({error: 'Preview unavailable.'}, {status: 404});

    const scan = await readFileRange(file, 0, Math.min(fileSize - 1, HEADER_SCAN_BYTES - 1));
    let wav: WavInfo;
    try {
      wav = parseWav(scan);
    } catch (error) {
      const fallback = legacyPublicPreview(songData);
      if (fallback) return NextResponse.redirect(new URL(fallback, request.url), 307);
      throw error;
    }
    const frames = Math.min(wav.frameCount, Math.floor(wav.sampleRate * PREVIEW_SECONDS));
    const dataSize = frames * wav.blockAlign;
    const formatChunk = scan.subarray(wav.formatOffset, wav.formatOffset + wav.formatSize);
    const header = previewHeader(formatChunk, dataSize);
    const previewData = await readFileRange(file, wav.dataOffset, wav.dataOffset + dataSize - 1);
    const body = Buffer.concat([header, previewData]);
    const range = parseRange(request.headers.get('range'), body.length);
    const responseBody = range ? body.subarray(range.start, range.end + 1) : body;

    return new Response(Readable.toWeb(Readable.from(responseBody)) as ReadableStream, {
      status: range ? 206 : 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(responseBody.length),
        'Accept-Ranges': 'bytes',
        ...(range ? {'Content-Range': `bytes ${range.start}-${range.end}/${body.length}`} : {}),
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'Content-Disposition': `inline; filename="${encodeURIComponent(String(song.data()?.title || 'aureon-preview'))}-preview.wav"`,
        'X-Aureon-Preview-Seconds': String(PREVIEW_SECONDS),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Public preview failed:', error);
    return NextResponse.json({error: 'Preview unavailable.'}, {status: 500});
  }
}
