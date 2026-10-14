/** Display-only trail. These stable identities are never customer garden IDs. */
export const pumpkinTrailStops = [
    {
        id: 'pumpkin-trail-stop-1',
        number: 1,
        name: 'PumpkinLanternSmile',
        x: 0,
        z: 0,
    },
    {
        id: 'pumpkin-trail-stop-2',
        number: 2,
        name: 'PumpkinLanternWink',
        x: 0,
        z: 2,
    },
    {
        id: 'pumpkin-trail-stop-3',
        number: 3,
        name: 'PumpkinLanternSmile',
        x: 2,
        z: 4,
    },
    {
        id: 'pumpkin-trail-stop-4',
        number: 4,
        name: 'PumpkinLanternWink',
        x: 4,
        z: 2,
    },
    {
        id: 'pumpkin-trail-stop-5',
        number: 5,
        name: 'PumpkinLanternSmile',
        x: 4,
        z: 0,
    },
];
const path = [
    [1, 0],
    [1, 1],
    [1, 2],
    [1, 3],
    [2, 3],
    [3, 3],
    [3, 2],
    [3, 1],
    [3, 0],
];
const accents = [
    { name: 'FriendlyGhost', x: 0, z: 4, rotation: 0 },
    { name: 'SupportedCobweb', x: 2, z: 0, rotation: 0 },
    { name: 'BaleHey', x: 2, z: 2, rotation: 1 },
    { name: 'DeadTreeTall', x: 4, z: 4, rotation: 0 },
];
export function lightPumpkinTrailStop(lit: readonly string[], id: string) {
    if (!pumpkinTrailStops.some((stop) => stop.id === id) || lit.includes(id))
        return lit;
    return [...lit, id];
}
export function isPumpkinTrailComplete(lit: readonly string[]) {
    return pumpkinTrailStops.every((stop) => lit.includes(stop.id));
}
export function isPumpkinTrailPublicPath(pathname: string | null) {
    return pathname === '/staza-bundeva' || pathname === '/staza-bundeva/';
}
export function createPumpkinTrailStacks() {
    return Array.from({ length: 25 }, (_, i) => {
        const x = i % 5;
        const z = Math.floor(i / 5);
        const stop = pumpkinTrailStops.find(
            (item) => item.x === x && item.z === z,
        );
        const accent = accents.find((item) => item.x === x && item.z === z);
        return {
            x: x - 2,
            y: z - 2,
            blocks: [
                {
                    id: `pumpkin-trail-grass-${x}-${z}`,
                    name: 'Block_Grass',
                    rotation: 0,
                    variant: null,
                },
                ...(path.some(([px, pz]) => px === x && pz === z)
                    ? [
                          {
                              id: `pumpkin-trail-path-${x}-${z}`,
                              name: 'StoneWalkway',
                              rotation: 0,
                              variant: null,
                          },
                      ]
                    : []),
                ...(stop
                    ? [
                          {
                              id: stop.id,
                              name: stop.name,
                              rotation: 0,
                              variant: null,
                          },
                      ]
                    : []),
                ...(accent
                    ? [
                          {
                              id: `pumpkin-trail-${accent.name}`,
                              name: accent.name,
                              rotation: accent.rotation,
                              variant: null,
                          },
                      ]
                    : []),
            ],
        };
    });
}
