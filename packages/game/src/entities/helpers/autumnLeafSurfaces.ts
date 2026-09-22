/** Reviewed anchors in block-local world units, including each asset's runtime scale/offset.
 * Only named top surfaces opt in. Never infer eligibility from WeatheredEntityPart.
 */
export type AutumnLeafSurface = {
    id: string;
    position: readonly [number, number, number];
    gradientX?: number;
    gradientZ?: number;
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
