export const listeningNotice = 'Unreleased material is shared privately for professional evaluation only.';

export const listeningPlaylists = {
  productions: {
    slug: 'productions',
    title: 'Selected Productions',
    pageTitle: 'SELECTED PRODUCTIONS – ANDREAS WALLEVIK',
    introduction: 'A selection of productions and collaborations showcasing my work as a music producer, songwriter and arranger.',
    overviewDescription: 'Music productions, songwriting and collaborations.',
    embedUrl: 'https://samply.app/embed/48xBamI4pk97rvoSPiAw',
    creditGroups: [
      {
        heading: 'UNRELEASED',
        entries: [
          {
            title: 'More To Miss – Chelcee Grimes',
            contribution: 'Production & arrangement',
            collaborators: ['Christian Wallevik', 'Peter Wallevik', 'Wayne Hector', 'Chelcee Grimes'],
          },
          {
            title: 'Drop The Love – Knightlybird',
            contribution: 'Production & arrangement',
            collaborators: ['Espen Andersen', 'Ruby Spiro'],
          },
          {
            title: 'Rock Bottom – Knightlybird',
            contribution: 'Production & arrangement',
            collaborators: ['Espen Andersen', 'Peter Wallevik', 'Ruby Spiro'],
          },
        ],
      },
      {
        heading: 'RELEASED',
        entries: [
          {
            title: 'Drones – Dreamlag',
            contribution: 'Artist & producer',
          },
        ],
      },
    ],
  },
  compositions: {
    slug: 'compositions',
    title: 'Selected Compositions',
    pageTitle: 'SELECTED COMPOSITIONS – ANDREAS WALLEVIK',
    introduction: 'A selection of electronic, ambient and cinematic compositions showcasing my work as a composer and producer.',
    overviewDescription: 'Electronic, ambient and cinematic compositions.',
    embedUrl: 'https://samply.app/embed/K0ScknQw7bFSKc5C1eY0',
    creditGroups: [],
  },
} as const;

export type ListeningPlaylist = typeof listeningPlaylists[keyof typeof listeningPlaylists];
