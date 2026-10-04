import {
    defaultGameBackgroundPaletteKey,
    type GameBackgroundPaletteKey,
    isGameBackgroundPaletteKey,
} from '@gredice/js/gameBackground';

export type { GameBackgroundPaletteKey } from '@gredice/js/gameBackground';
export { defaultGameBackgroundPaletteKey } from '@gredice/js/gameBackground';

export type GameBackgroundPalette =
    | {
          kind: 'current';
          key: typeof defaultGameBackgroundPaletteKey;
          label: string;
      }
    | {
          dayColor: string;
          kind: 'color';
          key: Exclude<GameBackgroundPaletteKey, 'current'>;
          label: string;
          lightColor: string;
          nightColor: string;
      };

export const defaultGameBackgroundPaletteIndex = 0;

export const gameBackgroundPalettes: GameBackgroundPalette[] = [
    {
        kind: 'current',
        key: defaultGameBackgroundPaletteKey,
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

const gameBackgroundPaletteIndexByKey = new Map<
    GameBackgroundPaletteKey,
    number
>(gameBackgroundPalettes.map((palette, index) => [palette.key, index]));

export function normalizeGameBackgroundPaletteIndex(index: number) {
    const count = gameBackgroundPalettes.length;
    return ((Math.trunc(index) % count) + count) % count;
}

export function getGameBackgroundPaletteIndexByKey(
    key: string | null | undefined,
) {
    if (!isGameBackgroundPaletteKey(key)) {
        return defaultGameBackgroundPaletteIndex;
    }

    const index = gameBackgroundPaletteIndexByKey.get(key);
    return index ?? defaultGameBackgroundPaletteIndex;
}

export function getGameBackgroundPalette(index: number) {
    return gameBackgroundPalettes[normalizeGameBackgroundPaletteIndex(index)];
}

export function getGameBackgroundPaletteKey(index: number) {
    return getGameBackgroundPalette(index).key;
}

export function getNextGameBackgroundPaletteIndex(index: number) {
    return normalizeGameBackgroundPaletteIndex(index + 1);
}

export function getNextGameBackgroundPaletteKey(
    key: string | null | undefined,
) {
    return getGameBackgroundPaletteKey(
        getNextGameBackgroundPaletteIndex(
            getGameBackgroundPaletteIndexByKey(key),
        ),
    );
}
