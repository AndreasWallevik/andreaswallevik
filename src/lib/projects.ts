import { getCollection, type CollectionEntry } from 'astro:content';

export type Project = CollectionEntry<'projects'>;

export async function publishedProjects() {
  const projects = await getCollection('projects', ({ data }) => !data.draft);
  return projects.sort((a, b) =>
    Number(b.data.featured) - Number(a.data.featured) ||
    (b.data.year ?? 0) - (a.data.year ?? 0) ||
    a.data.title.localeCompare(b.data.title)
  );
}

export async function selectedWork() {
  return (await publishedProjects()).filter((project) => project.data.featured);
}

export async function listedProjects() {
  return (await publishedProjects())
    .filter((project) => project.data.showInProjects)
    .sort((a, b) => Number(a.data.featured) - Number(b.data.featured) || a.data.title.localeCompare(b.data.title));
}

export async function visualWork() {
  return (await publishedProjects())
    .filter((project) => project.data.showInVisualWork)
    .sort((a, b) =>
      (a.data.visualOrder ?? Number.MAX_SAFE_INTEGER) - (b.data.visualOrder ?? Number.MAX_SAFE_INTEGER) ||
      a.data.title.localeCompare(b.data.title)
    );
}

export const categoryLabels = {
  music: 'Music',
  'film-visuals': 'Film & Visuals',
  'sound-for-visuals': 'Sound for Visuals',
  experiments: 'Experiments',
} as const;
