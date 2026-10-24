/** Reviewed anchors in block-local world units, including each asset's runtime scale/offset.
 * Only named top surfaces opt in. Never infer eligibility from WeatheredEntityPart.
 */
export type AutumnLeafSurface = {
    id: string;
    position: readonly [number, number, number];
    gradientX?: number;
    gradientZ?: number;
};

/** Part-local anchors are transformed by the rendered part, never by a second
 * copy of the block's animation. The optional scale keeps narrow slat clusters
 * inside their audited footprint after the bench root's 0.52 scale.
 */
export type AutumnPartLeafSurface = AutumnLeafSurface & {
    scale?: number;
};

export const autumnPartLeafSurfaces: Readonly<
    Record<string, readonly AutumnPartLeafSurface[]>
> = {
    WoodenBench_SeatSlatFront: [
        { id: 'left', position: [-0.4, 0.065, 0], scale: 0.45 },
        { id: 'right', position: [0.4, 0.065, 0], scale: 0.45 },
    ],
    WoodenBench_SeatSlatCenter: [
        { id: 'left', position: [-0.4, 0.065, 0], scale: 0.45 },
        { id: 'right', position: [0.4, 0.065, 0], scale: 0.45 },
    ],
    WoodenBench_SeatSlatBack: [
        { id: 'left', position: [-0.4, 0.065, 0], scale: 0.45 },
        { id: 'right', position: [0.4, 0.065, 0], scale: 0.45 },
    ],
    OutletDisplayTable_TopPlanks: [
        { id: 'nw', position: [-0.27, 0.67, -0.255] },
        { id: 'ne', position: [0.27, 0.67, -0.255] },
        { id: 'sw', position: [-0.27, 0.67, 0.255] },
        { id: 'se', position: [0.27, 0.67, 0.255] },
    ],
    GardenBox_Lid_HingeOrigin: [
        { id: 'left', position: [-0.23, 0.06, 0.3] },
        { id: 'right', position: [0.23, 0.06, 0.3] },
    ],
    FenceGate_Posts: [
        { id: 'left', position: [-0.43, 0.55, 0] },
        { id: 'right', position: [0.43, 0.55, 0] },
    ],
    StoneFenceGate_Posts_Mesh: [
        { id: 'left', position: [-0.43, 0.68, 0] },
        { id: 'right', position: [0.43, 0.68, 0] },
    ],
    PolishedStoneFenceGate_Posts: [
        { id: 'left', position: [-0.43, 0.68, 0] },
        { id: 'right', position: [0.43, 0.68, 0] },
    ],
};

const giftBoxSurfaces: readonly AutumnLeafSurface[] = [
    { id: 'GiftBox_Box:nw', position: [-0.13, 0.5, -0.13] },
    { id: 'GiftBox_Box:se', position: [0.13, 0.5, 0.13] },
    { id: 'GiftBox_Box:sw', position: [-0.13, 0.5, 0.13] },
    { id: 'GiftBox_Box:ne', position: [0.13, 0.5, -0.13] },
];

export const autumnLeafSurfaces: Readonly<
    Record<string, readonly AutumnLeafSurface[]>
> = {
    GiftBox_RedWhite: giftBoxSurfaces,
    GiftBox_GreenGold: giftBoxSurfaces,
    GiftBox_BlueWhite: giftBoxSurfaces,
    GiftBox_PurpleSilver: giftBoxSurfaces,
    GiftBox_GoldRed: giftBoxSurfaces,
    GiftBox_WhiteGreen: giftBoxSurfaces,
    Stool: [
        { id: 'Stool:seat-nw', position: [-0.13, 0.357412, -0.12] },
        { id: 'Stool:seat-se', position: [0.13, 0.357412, 0.12] },
        { id: 'Stool:seat-sw', position: [-0.13, 0.357412, 0.12] },
        { id: 'Stool:seat-ne', position: [0.13, 0.357412, -0.12] },
    ],
    StoneMedium: [
        {
            id: 'Stone_Medium:top-east',
            position: [0.08, 0.2843121, 0.06],
            gradientX: 0.094414,
            gradientZ: -0.202455,
        },
        {
            id: 'Stone_Medium:top-south',
            position: [0, 0.245439, 0.12],
            gradientX: 0.189321,
            gradientZ: -0.523459,
        },
    ],
    // Stone_Large is scaled [0.263, 0.426, 0.291] by both render paths.
    StoneLarge: [
        {
            id: 'Stone_Large:top-west',
            position: [-0.1035, 0.5867, -0.0574],
            gradientX: 0.081585,
            gradientZ: 0.329026,
        },
    ],
    // Each U segment is expanded by the same footprint helper as RaisedBedInstances.
    Raised_Bed: [
        { id: 'Raised_Bed_U_2:rim-north', position: [0, 0.3, -0.46] },
        { id: 'Raised_Bed_U_2:rim-south', position: [0, 0.3, 0.46] },
        { id: 'Raised_Bed_U_2:rim-west-north', position: [-0.46, 0.3, -0.22] },
        { id: 'Raised_Bed_U_2:rim-west-south', position: [-0.46, 0.3, 0.22] },
    ],
    // The central post cap is identical and rotation-invariant in all connected variants.
    Fence: [{ id: 'Fence:post-cap', position: [0, 0.55, 0] }],
};

export const autumnLeafEntityNames = Object.keys(autumnLeafSurfaces);
