import { radioArtworkPool, type RadioChannelId, type RadioManifest, type RadioTrack } from '../config/radio';
import { initRadioVisualizer } from './radio-visualizer';

const anchorSeconds = Date.UTC(2026, 0, 1) / 1000;
const assetUrl = (path: string) => /^https?:\/\//.test(path)
  ? path
  : `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

type OnAir = { track: RadioTrack; offset: number; rotation: number };

export function getOnAir(manifest: RadioManifest, channelId: RadioChannelId, nowSeconds = Date.now() / 1000): OnAir {
  const tracks = manifest.channels[channelId].tracks;
  const slotLength = (track: RadioTrack) => track.playbackDurationSeconds ?? track.durationSeconds;
  const cycle = tracks.reduce((seconds, track) => seconds + slotLength(track), 0);
  if (!tracks.length || cycle <= 0) throw new Error(`Channel ${channelId} has no playable tracks`);

  const elapsed = nowSeconds - anchorSeconds;
  let position = ((elapsed % cycle) + cycle) % cycle;
  const cycleNumber = Math.floor(elapsed / cycle);
  for (let index = 0; index < tracks.length; index += 1) {
    const track = tracks[index];
    if (position < slotLength(track) || index === tracks.length - 1) {
      return { track, offset: position, rotation: cycleNumber };
    }
    position -= slotLength(track);
  }
  throw new Error('Could not resolve the current track');
}

function fallbackArtwork(trackId: string, rotation: number) {
  let hash = rotation;
  for (const letter of trackId) hash = (hash * 31 + letter.charCodeAt(0)) | 0;
  return radioArtworkPool[(hash >>> 0) % radioArtworkPool.length];
}

export function initRadioPlayer() {
  const root = document.querySelector<HTMLElement>('[data-radio]');
  if (!root) return;
  const manifest = JSON.parse(root.dataset.radioManifest ?? '') as RadioManifest;
  const radioChannels = manifest.channels;

  const audio = root.querySelector<HTMLAudioElement>('audio')!;
  const visualizer = initRadioVisualizer(audio, root);
  const toggle = root.querySelector<HTMLButtonElement>('[data-play-toggle]')!;
  const toggleIcon = toggle.querySelector<HTMLElement>('[data-play-icon]')!;
  const toggleLabel = toggle.querySelector<HTMLElement>('[data-play-label]')!;
  const channelButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-channel]')];
  const title = root.querySelector<HTMLElement>('[data-track-title]')!;
  const artist = root.querySelector<HTMLElement>('[data-track-artist]')!;
  const art = root.querySelector<HTMLImageElement>('[data-artwork]')!;
  const artCredit = root.querySelector<HTMLElement>('[data-art-credit]')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const progress = root.querySelector<HTMLProgressElement>('[data-progress]')!;
  const channelDescription = root.querySelector<HTMLElement>('[data-channel-description]')!;

  let channelId: RadioChannelId = 'radio';
  let wantsPlayback = false;
  let loadedTrackId: string | null = null;
  let shownArtSrc = '';
  let pendingOffset = 0;
  let playbackError: string | null = null;
  let playbackRequest = 0;
  let currentTrackId: string | null = null;

  const setStatus = (message: string) => { status.textContent = message; };
  const updateToggle = () => {
    toggleIcon.textContent = wantsPlayback ? 'Ⅱ' : '▶';
    toggleLabel.textContent = wantsPlayback ? 'Pause' : 'Play';
    toggle.setAttribute('aria-label', `${wantsPlayback ? 'Pause' : 'Play'} ${radioChannels[channelId].name}`);
  };

  function startAudio(onAir: OnAir) {
    const src = assetUrl(onAir.track.audioSrc);
    const changed = loadedTrackId !== onAir.track.id || audio.getAttribute('src') !== src;
    pendingOffset = onAir.offset;
    if (changed) {
      loadedTrackId = onAir.track.id;
      audio.src = src;
      audio.load();
    }
    try {
      if (changed || Math.abs(audio.currentTime - onAir.offset) > 0.8) audio.currentTime = onAir.offset;
    } catch {
      // loadedmetadata applies the same offset if the browser cannot seek yet.
    }
    if (audio.paused) {
      const request = ++playbackRequest;
      void audio.play().catch(() => {
        if (request !== playbackRequest || !wantsPlayback) return;
        wantsPlayback = false;
        playbackError = 'Playback could not start. Try pressing Play again.';
        updateToggle();
        setStatus(playbackError);
      });
    }
  }

  function sync() {
    const onAir = getOnAir(manifest, channelId);
    title.textContent = onAir.track.title;
    artist.textContent = onAir.track.artist;
    artist.hidden = !onAir.track.artist;
    progress.max = onAir.track.playbackDurationSeconds ?? onAir.track.durationSeconds;
    progress.value = onAir.offset;
    const artwork = onAir.track.artwork ?? fallbackArtwork(onAir.track.id, onAir.rotation);
    const artworkSrc = assetUrl(artwork.src);
    if (shownArtSrc !== artworkSrc) {
      art.src = artworkSrc;
      shownArtSrc = artworkSrc;
    }
    art.alt = artwork.alt;
    artCredit.textContent = artwork.artist ? `Artwork: ${artwork.artist}` : '';
    artCredit.hidden = !artwork.artist;

    if (wantsPlayback) startAudio(onAir);
    setStatus(playbackError ?? (wantsPlayback ? 'ON AIR · SHARED SIGNAL' : 'PAUSED · THE STATION KEEPS MOVING'));
    if (currentTrackId !== onAir.track.id) {
      currentTrackId = onAir.track.id;
      root?.dispatchEvent(new CustomEvent('radio:trackchange', { detail: { id: onAir.track.id, title: onAir.track.title } }));
    }
  }

  audio.addEventListener('loadedmetadata', () => {
    try { audio.currentTime = pendingOffset; } catch { /* A later sync will retry. */ }
  });
  audio.addEventListener('ended', sync);
  audio.addEventListener('error', () => {
    wantsPlayback = false;
    playbackError = 'Audio unavailable. Reload for the latest playlist or check the file.';
    updateToggle();
    setStatus(playbackError);
  });

  toggle.addEventListener('click', () => {
    wantsPlayback = !wantsPlayback;
    playbackError = null;
    if (!wantsPlayback) { playbackRequest += 1; audio.pause(); }
    else visualizer.prepareForPlayback();
    updateToggle();
    sync();
  });

  for (const button of channelButtons) button.addEventListener('click', () => {
    const next = button.dataset.channel as RadioChannelId;
    if (!(next in radioChannels) || next === channelId) return;
    channelId = next;
    playbackError = null;
    playbackRequest += 1;
    channelButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    channelDescription.textContent = radioChannels[channelId].description;
    audio.pause();
    loadedTrackId = null;
    updateToggle();
    sync();
  });

  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  window.addEventListener('pageshow', sync);
  window.setInterval(sync, 1000);
  updateToggle();
  sync();
}
