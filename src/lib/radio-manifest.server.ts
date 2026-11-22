import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { parseFile } from 'music-metadata';
import {
  radioChannelDetails,
  radioTrackOverrides,
  type RadioChannelId,
  type RadioManifest,
  type RadioTrack,
} from '../config/radio';

const audioDirectory = resolve(process.cwd(), 'public/radio/audio');
const audioExtensions = new Set(['.mp3', '.wav']);

function ordered(a: string, b: string) { return a < b ? -1 : a > b ? 1 : 0; }

function filenameFallback(filename: string) {
  const stem = basename(filename, extname(filename)).replace(/^\d{1,2}[._-]\s*/, '');
  const parts = stem.split(/\s+-\s+/);
  const readable = (part: string) => part.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (parts.length > 1) return { artist: readable(parts[0]), title: readable(parts.slice(1).join(' - ')) };
  const title = readable(stem);
  return { artist: '', title: title.charAt(0).toUpperCase() + title.slice(1) };
}

async function channelFiles(channelId: RadioChannelId) {
  const directory = channelId === 'radio' ? audioDirectory : join(audioDirectory, 'beats');
  const entries = await readdir(directory, { withFileTypes: true });
  if (channelId === 'radio') {
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name === 'beats') continue;
      if (!entry.isFile()) throw new Error(`Unexpected folder or link in public/radio/audio/: ${entry.name}. Keep only audio files and the beats/ folder here.`);
    }
  } else if (entries.some((entry) => !entry.isFile())) {
    throw new Error('Keep only MP3 or WAV files directly in public/radio/audio/beats/.');
  }

  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort(ordered);
  for (const name of files) {
    if (!audioExtensions.has(extname(name).toLowerCase())) {
      throw new Error(`Unsupported file in public/radio/audio/${channelId === 'beats' ? 'beats/' : ''}: ${name}. Use MP3 or WAV.`);
    }
  }
  return files.map((name) => ({
    absolute: join(directory, name),
    relative: channelId === 'beats' ? `beats/${name}` : name,
  }));
}

async function trackFromFile(absolute: string, relative: string): Promise<RadioTrack> {
  const override = radioTrackOverrides[relative] ?? {};
  const metadata = await parseFile(absolute, { duration: true, skipCovers: true });
  const fallback = filenameFallback(relative.split('/').at(-1)!);
  const rawDuration = override.durationSeconds ?? metadata.format.duration;
  if (!Number.isFinite(rawDuration) || !rawDuration || rawDuration <= 0) {
    throw new Error(`Duration unavailable for ${relative}. Add a durationSeconds override in src/config/radio.ts.`);
  }
  const durationSeconds = Math.round(rawDuration * 1000) / 1000;
  const playbackDurationSeconds = override.playbackDurationSeconds;
  if (playbackDurationSeconds !== undefined && (!Number.isFinite(playbackDurationSeconds) || playbackDurationSeconds <= 0 || playbackDurationSeconds > durationSeconds + .05)) {
    throw new Error(`Invalid playbackDurationSeconds override for ${relative}; it must be positive and no longer than the audio file.`);
  }
  const encodedPath = relative.split('/').map(encodeURIComponent).join('/');
  const metadataTitle = metadata.common.title?.trim();
  const metadataArtist = metadata.common.artist?.trim();
  return {
    id: relative,
    title: override.title ?? (metadataTitle || fallback.title),
    artist: override.artist ?? (metadataArtist || fallback.artist),
    audioSrc: `/radio/audio/${encodedPath}`,
    durationSeconds,
    ...(playbackDurationSeconds === undefined ? {} : { playbackDurationSeconds }),
    ...(override.artwork === undefined ? {} : { artwork: override.artwork }),
  };
}

export async function buildRadioManifest(): Promise<RadioManifest> {
  const channels = {} as RadioManifest['channels'];
  const audioHashes: string[] = [];
  for (const channelId of ['radio', 'beats'] as const) {
    const files = await channelFiles(channelId);
    if (files.length === 0) throw new Error(`No audio files in ${channelId === 'radio' ? 'public/radio/audio/' : 'public/radio/audio/beats/'}.`);
    const tracks: RadioTrack[] = [];
    for (const file of files) {
      tracks.push(await trackFromFile(file.absolute, file.relative));
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(file.absolute)) hash.update(chunk);
      audioHashes.push(`${file.relative}:${hash.digest('hex')}`);
    }
    channels[channelId] = { ...radioChannelDetails[channelId], tracks };
  }
  // No build timestamp: identical files and metadata keep the same schedule version.
  const version = createHash('sha256').update(JSON.stringify({ channels, audioHashes })).digest('hex').slice(0, 12);
  return { version, channels };
}
