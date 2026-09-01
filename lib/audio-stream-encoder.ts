'use client';

const AAC_BITRATE = 256_000;
const AAC_CODEC = 'mp4a.40.2';
const AAC_FRAME_SIZE = 1024;
const MAX_ENCODER_QUEUE = 12;
const RESUME_ENCODER_QUEUE = 6;
const QUEUE_DRAIN_TIMEOUT_MS = 20_000;
const FLUSH_TIMEOUT_MS = 120_000;
const SAMPLE_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

type WebCodecsWindow = Window & {
  AudioEncoder?: any;
  AudioData?: any;
};

function adtsHeader(payloadLength: number, sampleRate: number, channels: number) {
  const frequencyIndex = SAMPLE_RATES.indexOf(sampleRate);
  if (frequencyIndex < 0) throw new Error(`AAC streaming does not support ${sampleRate} Hz audio.`);
  const frameLength = payloadLength + 7;
  const profile = 1; // AAC-LC (Audio Object Type 2 minus 1)
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
    await delay(4);
  }
}

async function decode(file: File) {
  const AudioContextClass = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error('This browser cannot process WAV audio.');
  const context = new AudioContextClass();
  try {
    return await context.decodeAudioData(await file.arrayBuffer());
  } finally {
    await context.close();
  }
}

export async function buildAacStreamingFile(file: File, slug: string) {
  const codecs = window as WebCodecsWindow;
  if (!codecs.AudioEncoder || !codecs.AudioData) {
    throw new Error('This browser cannot create Aureon AAC streaming files. Please use the latest Safari or Chrome on desktop.');
  }

  const buffer = await decode(file);
  const channels = Math.min(buffer.numberOfChannels, 2);
  const sampleRate = buffer.sampleRate;
  const config = { codec: AAC_CODEC, sampleRate, numberOfChannels: channels, bitrate: AAC_BITRATE };
  const support = await codecs.AudioEncoder.isConfigSupported(config).catch(() => null);
  if (!support?.supported) {
    throw new Error(`This browser cannot encode Aureon AAC at ${sampleRate} Hz. Please use the latest Safari or Chrome on desktop.`);
  }

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
    const sourceChannels = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
    let frameIndex = 0;

    for (let offset = 0; offset < buffer.length; offset += AAC_FRAME_SIZE) {
      if (encoderError) throw encoderError;
      await waitForEncoderCapacity(encoder, () => encoderError);

      const frames = Math.min(AAC_FRAME_SIZE, buffer.length - offset);
      const planar = new Float32Array(frames * channels);
      for (let channel = 0; channel < channels; channel += 1) {
        planar.set(sourceChannels[channel].subarray(offset, offset + frames), channel * frames);
      }
      const timestamp = Math.round((offset / sampleRate) * 1_000_000);
      const audioData = new codecs.AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: frames,
        numberOfChannels: channels,
        timestamp,
        data: planar,
      });
      encoder.encode(audioData);
      audioData.close();

      frameIndex += 1;
      // Give Safari/WebKit regular main-thread time to deliver encoded chunks and
      // keep the admin UI responsive while processing full-length WAV masters.
      if (frameIndex % 32 === 0) await delay(0);
    }

    await withTimeout(
      encoder.flush(),
      FLUSH_TIMEOUT_MS,
      'AAC encoding took too long to finish. Refresh the admin page and try the WAV upload again.',
    );
    if (encoderError) throw encoderError;
    if (!output.length) throw new Error('Aureon could not create the AAC streaming file.');

    return new File(output as BlobPart[], `${slug}-stream.aac`, { type: 'audio/aac' });
  } finally {
    try { encoder.close(); } catch { /* Encoder may already be closed after a codec failure. */ }
  }
}

export const AUREON_STREAM_FORMAT = 'AAC-LC 256 kbps';
