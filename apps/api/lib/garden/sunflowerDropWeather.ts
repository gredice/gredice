export const SUNFLOWER_DROP_MAX_RAIN_MM = 0.05;
export const SUNFLOWER_DROP_MAX_CLOUD_COVER = 0.33;

export type SunflowerDropWeatherConditions = {
    cloudy: number;
    foggy: number;
    rain: number;
    rainy: number;
    snowy: number;
    thundery: number;
};

export function isSunflowerDropWeatherEligible({
    cloudy,
    foggy,
    rain,
    rainy,
    snowy,
    thundery,
}: SunflowerDropWeatherConditions) {
    return (
        rain <= SUNFLOWER_DROP_MAX_RAIN_MM &&
        cloudy <= SUNFLOWER_DROP_MAX_CLOUD_COVER &&
        rainy <= 0 &&
        snowy <= 0 &&
        foggy <= 0 &&
        thundery <= 0
    );
}
