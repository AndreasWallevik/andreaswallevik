export const site = {
  name: 'Andreas Wallevik',
  title: 'Andreas Wallevik — Music & Creative Work',
  description:
    'Music, songwriting, sound and visual work by Andreas Wallevik, a Norwegian creative based in Tønsberg.',
  email: 'andreas.wallevik@gmail.com',
  social: [] as { label: string; url: string }[],
};

export function withBase(path: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}
