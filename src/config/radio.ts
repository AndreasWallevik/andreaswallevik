export type RadioArtwork = {
  src: string;
  alt: string;
  artist?: string;
};

export type RadioTrack = {
  id: string;
  title: string;
  artist: string;
  audioSrc: string;
  durationSeconds: number;
  playbackDurationSeconds?: number;
  artwork?: RadioArtwork;
};

export type RadioChannelId = 'radio' | 'beats';
export type RadioChannel = { name: string; description: string; tracks: RadioTrack[] };
export type RadioManifest = { version: string; channels: Record<RadioChannelId, RadioChannel> };

export const radioChannelDetails = {
  radio: { name: 'Radio', description: 'Music, demos and unexpected turns.' },
  beats: { name: 'Beat Station', description: 'Instrumentals, beats and space to freestyle.' },
} satisfies Record<RadioChannelId, Omit<RadioChannel, 'tracks'>>;

export const radioArtworkPool: RadioArtwork[] = [
  { src: '/radio/artwork/orbit.svg', alt: 'Abstract orange orbit on a dark background' },
  { src: '/radio/artwork/grid.svg', alt: 'Abstract green grid and radiating circles' },
];

// Optional exceptions, keyed by path relative to public/radio/audio/.
// Most new songs need no entry here. playbackDurationSeconds can shorten a song's radio slot.
export const radioTrackOverrides: Record<string, Partial<Pick<RadioTrack, 'title' | 'artist' | 'durationSeconds' | 'playbackDurationSeconds' | 'artwork'>>> = {
  'radio-test-01.wav': {
    title: 'Test Signal 01', artist: 'SKRRR CITY demo',
    artwork: { src: '/radio/artwork/signal.svg', alt: 'Orange starburst on a dark green background' },
  },
  'radio-test-02.wav': { title: 'Test Signal 02', artist: 'SKRRR CITY demo' },
  'beats/beat-test-01.wav': { title: 'Beat Test 01', artist: 'SKRRR CITY demo' },
  'beats/beat-test-02.wav': { title: 'Beat Test 02', artist: 'SKRRR CITY demo' },
};
