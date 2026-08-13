export const waterBlockName = 'Block_Water';
export const swampWaterBlockName = 'Block_Swamp_Water';

export const waterBlockNames = [waterBlockName, swampWaterBlockName] as const;
export const waterBlockStyles = ['standard', 'swamp'] as const;

export type WaterBlockName = (typeof waterBlockNames)[number];
export type WaterBlockStyle = (typeof waterBlockStyles)[number];

export function isWaterBlockName(name: string): name is WaterBlockName {
    return waterBlockNames.some((waterName) => waterName === name);
}

export function getWaterBlockStyle(name: string): WaterBlockStyle | null {
    if (!isWaterBlockName(name)) {
        return null;
    }

    return name === swampWaterBlockName ? 'swamp' : 'standard';
}
