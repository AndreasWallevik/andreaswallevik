export type MusicProvider = 'spotify' | 'soundcloud';

export function isOfficialMusicEmbedUrl(provider: MusicProvider, value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return false;

    const autoplay = url.searchParams.get('autoplay') || url.searchParams.get('auto_play');
    if (autoplay && /^(1|true)$/i.test(autoplay)) return false;

    if (provider === 'spotify') {
      return url.hostname === 'open.spotify.com' && /^\/embed\/(album|playlist|track|artist)\/[A-Za-z0-9]+\/?$/.test(url.pathname);
    }

    if (url.hostname !== 'w.soundcloud.com' || !/^\/player\/?$/.test(url.pathname)) return false;
    const source = new URL(url.searchParams.get('url') || '');
    return source.protocol === 'https:' && source.hostname === 'api.soundcloud.com' &&
      !source.username && !source.password && !source.port && !source.hash &&
      /^\/(playlists|tracks)\/\d+\/?$/.test(source.pathname);
  } catch {
    return false;
  }
}

export function musicPlayerHeight(provider: MusicProvider, embedUrl: string): number {
  const url = new URL(embedUrl);
  if (provider === 'spotify') return url.pathname.startsWith('/embed/track/') ? 152 : 352;
  if (url.searchParams.get('visual') === 'true') return 450;
  const source = new URL(url.searchParams.get('url') || '');
  return source.pathname.startsWith('/playlists/') ? 450 : 166;
}
