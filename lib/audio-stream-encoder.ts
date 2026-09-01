'use client';

const AAC_BITRATE = 256_000;
const AAC_CODEC = 'mp4a.40.2';
const AAC_FRAME_SIZE = 1024;
const MAX_ENCODER_QUEUE = 8;
const RESUME_ENCODER_QUEUE = 3;
const QUEUE_DRAIN_TIMEOUT_MS = 20_000;
const FLUSH_TIMEOUT_MS = 120_000;
const SAMPLE_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

type WebCodecsWindow = Window & {
  AudioEncoder?: any;
  AudioData?: any;
};

type ParsedWav = {
  bytes: ArrayBuffer;
  dataOffset: number;
  dataLength: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  formatTag: number;
  blockAlign: number;
  frameCount: number;
};

type ProgressCallback = (percent: number) => void;

function adtsHeader(payloadLength: number, sampleRate: number, channels: number) {
  const frequencyIndex = SAMPLE_RATES.indexOf(sampleRate);
  if (frequencyIndex < 0) throw new Error(`AAC streaming does not support ${sampleRate} Hz audio.`);
  const frameLength = payloadLength + 7;
  const profile = 1;
  const header = new Uint8Array(7);
  header[0] = 0xff;
  header[1] = 0xf1;
  header[2] = (profile << 6) | (frequencyIndex << 2) | (channels >> 2);
  header[3] = ((channels & 3) << 6) | (frameLength >> 11);
  header[4] = (frameLength >> 3) & 0xff;
  header[5] = ((frameLength & 7) << 5) | 0x1f;
  header[6] = 0xfc;
  return header;
}

function hasAdtsHeader(bytes: Uint8Array) {
  return bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0;
}

function delay(ms = 0) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function waitForEncoderCapacity(encoder: any, getError: () => Error | null) {
  if (encoder.encodeQueueSize <= MAX_ENCODER_QUEUE) return;
  const started = Date.now();
  while (encoder.encodeQueueSize > RESUME_ENCODER_QUEUE) {
    const error = getError();
    if (error) throw error;
    if (Date.now() - started > QUEUE_DRAIN_TIMEOUT_MS) {
      throw new Error('AAC encoding stalled in this browser. Refresh the admin page and try the WAV upload again.');
    }
    await delay(8);
  }
}

function fourCC(view: DataView, offset: number) {
  return String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
}

function parseWav(bytes: ArrayBuffer): ParsedWav {
  const view = new DataView(bytes);
  if (bytes.byteLength < 44 || fourCC(view, 0) !== 'RIFF' || fourCC(view, 8) !== 'WAVE') {
    throw new Error('The selected file is not a valid RIFF/WAV master.');
  }

  let offset = 12;
  let formatTag = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let blockAlign = 0;
  let dataOffset = -1;
  let dataLength = 0;

  while (offset + 8 <= bytes.byteLength) {
    const chunkId = fourCC(view, offset);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkData = offset + 8;
    if (chunkData + chunkSize > bytes.byteLength) break;

    if (chunkId === 'fmt ' && chunkSize >= 16) {
      formatTag = view.getUint16(chunkData, true);
      channels = view.getUint16(chunkData + 2, true);
      sampleRate = view.getUint32(chunkData + 4, true);
      blockAlign = view.getUint16(chunkData + 12, true);
      bitsPerSample = view.getUint16(chunkData + 14, true);
      if (formatTag === 0xfffe && chunkSize >= 40) formatTag = view.getUint16(chunkData + 24, true);
    } else if (chunkId === 'data') {
      dataOffset = chunkData;
      dataLength = chunkSize;
    }

    offset = chunkData + chunkSize + (chunkSize & 1);
  }

  if (!channels || !sampleRate || !blockAlign || dataOffset < 0 || !dataLength) throw new Error('Aureon could not read the WAV audio data.');
  if (channels > 2) throw new Error('Aureon supports mono or stereo WAV masters only.');
  if (formatTag !== 1 && formatTag !== 3) throw new Error('This WAV uses an unsupported compression format. Export it as PCM WAV or IEEE-float WAV.');
  if (formatTag === 1 && ![16, 24, 32].includes(bitsPerSample)) throw new Error(`Unsupported PCM WAV bit depth: ${bitsPerSample}-bit. Use 16, 24 or 32-bit PCM WAV.`);
  if (formatTag === 3 && bitsPerSample !== 32) throw new Error(`Unsupported float WAV bit depth: ${bitsPerSample}-bit. Use 32-bit float WAV.`);

  return { bytes, dataOffset, dataLength, channels, sampleRate, bitsPerSample, formatTag, blockAlign, frameCount: Math.floor(dataLength / blockAlign) };
}

function readPcmSample(view: DataView, offset: number, formatTag: number, bitsPerSample: number) {
  if (formatTag === 3) return Math.max(-1, Math.min(1, view.getFloat32(offset, true)));
  if (bitsPerSample === 16) return view.getInt16(offset, true) / 32768;
  if (bitsPerSample === 24) {
    let value = view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
    if (value & 0x800000) value |= 0xff000000;
    return value / 8388608;
  }
  return view.getInt32(offset, true) / 2147483648;
}

function makePlanarChunk(wav: ParsedWav, startFrame: number, frames: number) {
  const view = new DataView(wav.bytes);
  const bytesPerSample = wav.bitsPerSample / 8;
  const planar = new Float32Array(frames * wav.channels);
  for (let frame = 0; frame < frames; frame += 1) {
    const frameOffset = wav.dataOffset + (startFrame + frame) * wav.blockAlign;
    for (let channel = 0; channel < wav.channels; channel += 1) {
      const sampleOffset = frameOffset + channel * bytesPerSample;
      planar[channel * frames + frame] = readPcmSample(view, sampleOffset, wav.formatTag, wav.bitsPerSample);
    }
  }
  return planar;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

export async function buildWavPreviewFile(file: File, slug: string, seconds = 40) {
  const wav = parseWav(await file.arrayBuffer());
  const frames = Math.min(wav.frameCount, Math.floor(wav.sampleRate * seconds));
  const channels = wav.channels;
  const dataSize = frames * channels * 2;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, wav.sampleRate, true);
  view.setUint32(28, wav.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  const source = new DataView(wav.bytes);
  const bytesPerSample = wav.bitsPerSample / 8;
  let targetOffset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    const sourceFrameOffset = wav.dataOffset + frame * wav.blockAlign;
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = readPcmSample(source, sourceFrameOffset + channel * bytesPerSample, wav.formatTag, wav.bitsPerSample);
      view.setInt16(targetOffset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      targetOffset += 2;
    }
  }
  return new File([out], `${slug}-preview.wav`, { type: 'audio/wav' });
}

export async function buildAacStreamingFile(file: File, slug: string, onProgress?: ProgressCallback) {
  const codecs = window as WebCodecsWindow;
  if (!codecs.AudioEncoder || !codecs.AudioData) throw new Error('This browser cannot create Aureon AAC streaming files. Please use the latest Safari or Chrome on desktop.');

  onProgress?.(1);
  const wav = parseWav(await file.arrayBuffer());
  const channels = wav.channels;
  const sampleRate = wav.sampleRate;
  const config = { codec: AAC_CODEC, sampleRate, numberOfChannels: channels, bitrate: AAC_BITRATE };
  const support = await codecs.AudioEncoder.isConfigSupported(config).catch(() => null);
  if (!support?.supported) throw new Error(`This browser cannot encode Aureon AAC at ${sampleRate} Hz. Export the WAV at 44.1 kHz or 48 kHz and try again.`);

  const output: Uint8Array[] = [];
  let encoderError: Error | null = null;
  const encoder = new codecs.AudioEncoder({
    output: (chunk: any) => {
      const payload = new Uint8Array(chunk.byteLength);
      chunk.copyTo(payload);
      if (hasAdtsHeader(payload)) output.push(payload);
      else output.push(adtsHeader(payload.byteLength, sampleRate, channels), payload);
    },
    error: (error: DOMException) => { encoderError = new Error(error.message || 'AAC encoding failed.'); },
  });

  try {
    encoder.configure(config);
    let frameIndex = 0;
    for (let offset = 0; offset < wav.frameCount; offset += AAC_FRAME_SIZE) {
      if (encoderError) throw encoderError;
      await waitForEncoderCapacity(encoder, () => encoderError);
      const frames = Math.min(AAC_FRAME_SIZE, wav.frameCount - offset);
      const planar = makePlanarChunk(wav, offset, frames);
      const audioData = new codecs.AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: frames,
        numberOfChannels: channels,
        timestamp: Math.round((offset / sampleRate) * 1_000_000),
        data: planar,
      });
      encoder.encode(audioData);
      audioData.close();
      frameIndex += 1;
      if (frameIndex % 24 === 0) {
        onProgress?.(Math.max(2, Math.min(96, Math.round((offset / wav.frameCount) * 96))));
        await delay(0);
      }
    }

    onProgress?.(97);
    await withTimeout(encoder.flush(), FLUSH_TIMEOUT_MS, 'AAC encoding took too long to finish. Refresh the admin page and try the WAV upload again.');
    if (encoderError) throw encoderError;
    if (!output.length) throw new Error('Aureon could not create the AAC streaming file.');
    onProgress?.(100);
    return new File(output as BlobPart[], `${slug}-stream.aac`, { type: 'audio/aac' });
  } finally {
    try { encoder.close(); } catch { /* Encoder may already be closed after a codec failure. */ }
  }
}

export const AUREON_STREAM_FORMAT = 'AAC-LC 256 kbps';
