export type GameBackgroundPalette =
    | {
          kind: 'current';
          key: 'current';
          label: string;
      }
    | {
          dayColor: string;
          kind: 'color';
          key: string;
          label: string;
          lightColor: string;
          nightColor: string;
      };

export const defaultGameBackgroundPaletteIndex = 0;

export const gameBackgroundPalettes: GameBackgroundPalette[] = [
    {
        kind: 'current',
        key: 'current',
        label: 'Trenutna',
    },
    {
        dayColor: '#bfe8ff',
        kind: 'color',
        key: 'light-blue',
        label: 'Svijetloplava',
        lightColor: '#e7f8ff',
        nightColor: '#213b63',
    },
    {
        dayColor: '#cab8ff',
        kind: 'color',
        key: 'purple',
        label: 'Ljubicasta',
        lightColor: '#f1eaff',
        nightColor: '#35265a',
    },
    {
        dayColor: '#ff9a8a',
        kind: 'color',
        key: 'sunset-red',
        label: 'Zalazak',
        lightColor: '#ffe0bd',
        nightColor: '#57283b',
    },
    {
        dayColor: '#bfeecf',
        kind: 'color',
        key: 'mint',
        label: 'Menta',
        lightColor: '#edfff3',
        nightColor: '#1e4a3f',
    },
    {
        dayColor: '#f8d77a',
        kind: 'color',
        key: 'golden',
        label: 'Zlatna',
        lightColor: '#fff5c8',
        nightColor: '#4c3a22',
    },
    {
        dayColor: '#f8b8cf',
        kind: 'color',
        key: 'rose',
        label: 'Ruzicasta',
        lightColor: '#fff0f6',
        nightColor: '#4c2541',
    },
];

export function normalizeGameBackgroundPaletteIndex(index: number) {
    const count = gameBackgroundPalettes.length;
    return ((Math.trunc(index) % count) + count) % count;
}

export function getGameBackgroundPalette(index: number) {
    return gameBackgroundPalettes[normalizeGameBackgroundPaletteIndex(index)];
}

export function getNextGameBackgroundPaletteIndex(index: number) {
    return normalizeGameBackgroundPaletteIndex(index + 1);
}
