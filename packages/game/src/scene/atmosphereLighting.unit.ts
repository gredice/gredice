import assert from 'node:assert/strict';
import test from 'node:test';
import { Color, Vector3 } from 'three';
import {
    type AtmosphereLighting,
    type AtmosphereWeather,
    foldLightTowardCamera,
    getAtmosphereDayAmount,
    getAtmosphereTwilightAmount,
    getCameraHorizontalDirection,
    getCameraQuarterTurns,
    liftLightDirection,
    resolveAtmosphereFog,
    resolveAtmosphereLighting,
    resolveCoverDimmingShare,
    resolveIslandFoggy,
    resolveIslandOvercast,
    resolveOvercast,
    resolveWeatherCoverDimming,
} from './atmosphereLighting';
import {
    gameLightFrames,
    gameLightRig,
    gameShadeVeil,
    gameWeatherLightRig,
} from './gameArtStyle';
import { resolveEnvironmentSkyBackgroundColors } from './skyGradient';
import { smoothstep } from './visualDayNight';

// Albedos of three colour roles (`PALETTE` in generate-party-core.py).
const grass = new Color().setRGB(0.085, 0.215, 0.022);
const path = new Color().setRGB(0.262, 0.138, 0.046);
const stone = new Color().setRGB(0.149, 0.166, 0.209);

const up = new Vector3(0, 1, 0);
/** The two block sides the default camera sees. */
const leftSide = new Vector3(0, 0, -1);
const rightSide = new Vector3(-1, 0, 0);

/** A midday sun south of the garden, as `altAzToScenePosition` places it. */
const middaySun = new Vector3(0.11, 0.97, -0.2).multiplyScalar(20);
/** A sunset sun behind the garden, as the default camera sees it. */
const sunsetSun = new Vector3(0.3, 0.2, 0.93).multiplyScalar(20);

function lightAt(
    timeOfDay: number,
    {
        coverShare,
        moonlight = 0,
        sunPosition = middaySun,
        weather,
        worldRotation,
    }: {
        coverShare?: number;
        moonlight?: number;
        sunPosition?: Vector3;
        weather?: AtmosphereWeather;
        worldRotation?: number;
    } = {},
) {
    const sky = resolveEnvironmentSkyBackgroundColors({
        backgroundPaletteIndex: 0,
        timeOfDay,
    });
    const toColor = ([red = 0, green = 0, blue = 0]: number[]) =>
        new Color().setRGB(red / 255, green / 255, blue / 255, 'srgb');
    return resolveAtmosphereLighting({
        backgroundColor: toColor(sky.background),
        hemisphereSkyColor: toColor(sky.hemisphereSkyColor),
        moonlight,
        moonPosition: null,
        solarEclipseScales: { ambient: 1, direct: 1 },
        sunPosition,
        timeOfDay,
        weather,
        worldRotation,
        coverShare,
    });
}

/** The light rig as it was before the cover curve: every weather term in full. */
const fullWeatherLight = 1;

/** Linear light a Lambert surface sends back, as three.js lights it. */
function shade(
    lighting: AtmosphereLighting,
    albedo: Color,
    normal: Vector3,
    { inShadow = false }: { inShadow?: boolean } = {},
) {
    const keyDirection = lighting.key.position.clone().normalize();
    const shadowKeep = inShadow
        ? 1 - lighting.key.shadowVisibility * gameLightRig.shadowIntensity
        : 1;
    const hemisphere = lighting.hemisphere.groundColor
        .clone()
        .lerp(lighting.hemisphere.color, normal.y * 0.5 + 0.5)
        .multiplyScalar(lighting.hemisphere.intensity);
    const irradiance = lighting.key.color
        .clone()
        .multiplyScalar(
            lighting.key.intensity *
                Math.max(0, normal.dot(keyDirection)) *
                shadowKeep,
        )
        .add(hemisphere)
        .add(
            lighting.ambient.color
                .clone()
                .multiplyScalar(lighting.ambient.intensity),
        );
    return albedo
        .clone()
        .multiply(irradiance)
        .multiplyScalar(1 / Math.PI);
}

function luminance(color: Color) {
    return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

function hueDegrees(color: Color) {
    const hsl = { h: 0, l: 0, s: 0 };
    color.getHSL(hsl);
    return hsl.h * 360;
}

const times = {
    dawn: 0.2,
    sunrise: 0.23,
    morning: 0.3,
    midday: 0.47,
    sunset: 0.78,
    dusk: 0.8,
    lilacDusk: 0.835,
    night: 0.95,
} as const;

test('the light frames are sorted and the night wraps around midnight', () => {
    for (let index = 1; index < gameLightFrames.length; index += 1) {
        const previous = gameLightFrames[index - 1];
        const frame = gameLightFrames[index];
        assert.ok(previous && frame && previous.at < frame.at);
    }
    const first = gameLightFrames[0];
    const last = gameLightFrames[gameLightFrames.length - 1];
    assert.equal(first?.at, 0);
    assert.equal(last?.at, 1);
    assert.deepEqual({ ...first, at: 0 }, { ...last, at: 0 });
});

test('day and twilight amounts ease between night and day', () => {
    assert.equal(getAtmosphereDayAmount(0), 0);
    assert.equal(getAtmosphereDayAmount(times.midday), 1);
    assert.equal(getAtmosphereDayAmount(times.night), 0);
    assert.equal(getAtmosphereTwilightAmount(times.midday), 0);
    assert.equal(getAtmosphereTwilightAmount(times.night), 0);
    assert.ok(getAtmosphereTwilightAmount(0.215) > 0.9);
    assert.ok(getAtmosphereTwilightAmount(times.dusk) > 0.9);
});

test('midday shows a lit top, a lit side near 0.6 and a cool shaded side near 0.4', () => {
    const midday = lightAt(times.midday);
    const neutral = new Color(1, 1, 1);
    const top = luminance(shade(midday, neutral, up));
    const lit = luminance(shade(midday, neutral, leftSide));
    const shaded = shade(midday, neutral, rightSide);

    assert.ok(lit / top > 0.55 && lit / top < 0.75, `lit ${lit / top}`);
    assert.ok(
        luminance(shaded) / top > 0.3 && luminance(shaded) / top < 0.5,
        `shaded ${luminance(shaded) / top}`,
    );
    assert.ok(shaded.b > shaded.r, 'the shaded side is tinted cool');
});

test('no time of day dims the tops much below midday', () => {
    const midday = luminance(shade(lightAt(times.midday), grass, up));
    for (const [name, timeOfDay] of Object.entries(times)) {
        const ratio = luminance(shade(lightAt(timeOfDay), grass, up)) / midday;
        const minimum = name === 'night' ? 0.6 : 0.8;
        assert.ok(ratio > minimum, `${name} grass top is ${ratio} of midday`);
        assert.ok(ratio < 1.25, `${name} grass top is ${ratio} of midday`);
    }
});

test('colours keep their hue at every time of day, including night', () => {
    for (const [name, timeOfDay] of Object.entries(times)) {
        const lighting = lightAt(timeOfDay);
        const grassHue = hueDegrees(shade(lighting, grass, up));
        const pathHue = hueDegrees(shade(lighting, path, up));
        assert.ok(grassHue > 75 && grassHue < 125, `${name} grass ${grassHue}`);
        assert.ok(pathHue > 12 && pathHue < 40, `${name} path ${pathHue}`);
    }
});

test('night is a light blue-violet that tints neutrals without turning them deep blue', () => {
    const night = lightAt(times.night);
    const midday = lightAt(times.midday);
    const nightStone = shade(night, stone, up);
    const hsl = { h: 0, l: 0, s: 0 };
    nightStone.getHSL(hsl);

    assert.ok(nightStone.b > nightStone.r && nightStone.b > nightStone.g);
    // The night key is a pale lavender: blue leads, red and green follow.
    assert.ok(night.key.color.r / night.key.color.b > 0.7);
    // Linear light; after tone mapping the stone top keeps about 0.9 of
    // its midday value.
    assert.ok(
        luminance(nightStone) > luminance(shade(midday, stone, up)) * 0.55,
    );
    assert.ok(hsl.s < 0.6, `night stone saturation ${hsl.s}`);
    // The blue-violet sits in the fill: a shaded side of a warm path is
    // clearly bluer at night than at midday.
    const nightSide = shade(night, path, rightSide);
    const middaySide = shade(midday, path, rightSide);
    assert.ok(
        nightSide.b / nightSide.r > (middaySide.b / middaySide.r) * 1.5,
        'the night fill tints shaded sides blue-violet',
    );
});

test('the night veil turns on only under the blue night ground bounce', () => {
    // As `buildShadeVeilShaderChunk` reads it: the share of the ground
    // bounce's blue that leads red and green.
    const blueLead = (lighting: AtmosphereLighting) => {
        const { b, g, r } = lighting.hemisphere.groundColor;
        return (b - Math.max(r, g)) / b;
    };
    assert.ok(blueLead(lightAt(times.night)) >= gameShadeVeil.blueEnd);
    for (const [name, timeOfDay] of Object.entries(times)) {
        if (name === 'night') continue;
        assert.ok(
            blueLead(lightAt(timeOfDay)) <= gameShadeVeil.blueStart,
            `${name} would take the night veil`,
        );
    }
    for (const weather of [
        { cloudy: 1 },
        { cloudy: 0.75, foggy: 0.2, snowy: 0.7 },
        { cloudy: 0.6, foggy: 1 },
        { cloudy: 1, foggy: 0.35, rainy: 1, thundery: 1 },
    ]) {
        assert.ok(
            blueLead(lightAt(times.midday, { weather })) <=
                gameShadeVeil.blueStart,
            `${JSON.stringify(weather)} would take the night veil`,
        );
    }
    assert.ok(
        gameShadeVeil.night.strength > gameShadeVeil.day.strength &&
            gameShadeVeil.day.strength > 0,
        'the veil is stronger at night than by day',
    );
});

test('the day shade veil follows a clear key and fades under cloud and fog', () => {
    // As `buildShadeVeilShaderChunk` reads it: key light over sky fill.
    const keyShare = (lighting: AtmosphereLighting) =>
        (luminance(lighting.key.color) * lighting.key.intensity) /
        (luminance(lighting.hemisphere.color) * lighting.hemisphere.intensity);
    for (const name of ['sunrise', 'morning', 'midday', 'sunset'] as const) {
        assert.ok(
            keyShare(lightAt(times[name])) >= gameShadeVeil.keyShareEnd,
            `${name} would lose the day veil`,
        );
    }
    for (const weather of [
        { cloudy: 1 },
        { cloudy: 0.6, foggy: 1 },
        { cloudy: 1, foggy: 0.35, rainy: 1, thundery: 1 },
    ]) {
        assert.ok(
            keyShare(lightAt(times.midday, { weather })) <=
                gameShadeVeil.keyShareStart,
            `${JSON.stringify(weather)} would take the day veil`,
        );
    }
    // Snowfall under broken cloud and fog under light cover keep part of
    // the key (fog takes 40% of it, like the target), so they keep part of
    // the veil too, never the full clear-day one.
    for (const weather of [
        { cloudy: 0.75, foggy: 0.2, snowy: 0.7 },
        { cloudy: 0.2, foggy: 1 },
    ]) {
        assert.ok(
            keyShare(lightAt(times.midday, { weather })) <
                gameShadeVeil.keyShareEnd,
            `${JSON.stringify(weather)} would take the full day veil`,
        );
    }
});

test('cast shadows stay soft, softest at twilight and firm enough at night to show the fill', () => {
    const midday = lightAt(times.midday);
    const dusk = lightAt(times.dusk, { sunPosition: sunsetSun });
    const night = lightAt(times.night);

    assert.equal(midday.key.shadowVisibility, 1);
    assert.ok(dusk.key.shadowVisibility < midday.key.shadowVisibility);
    assert.ok(night.key.shadowVisibility < midday.key.shadowVisibility);
    assert.ok(night.key.shadowVisibility > dusk.key.shadowVisibility);
    const nightShadowed = luminance(
        shade(night, grass, up, { inShadow: true }),
    );
    assert.ok(nightShadowed < luminance(shade(night, grass, up)) * 0.8);
    const shadowed = luminance(shade(midday, grass, up, { inShadow: true }));
    assert.ok(shadowed > luminance(shade(midday, grass, up)) * 0.3);
});

test('the key light never comes from behind the garden or outside its height range', () => {
    for (const worldRotation of [0, 1, 2, 3]) {
        const camera = getCameraHorizontalDirection(worldRotation);
        for (const sunPosition of [middaySun, sunsetSun]) {
            const key = lightAt(times.sunset, {
                sunPosition,
                worldRotation,
            }).key.position.normalize();
            assert.ok(key.x * camera.x + key.z * camera.z >= -1e-9);
            assert.ok(key.y >= gameLightRig.keyMinElevation - 1e-9);
            assert.ok(key.y <= gameLightRig.keyMaxElevation + 1e-9);
        }
    }
});

test('the camera direction follows the quarter turns of the camera rig', () => {
    const half = Math.SQRT1_2;
    const expected = [
        [-half, -half],
        [-half, half],
        [half, half],
        [half, -half],
    ];
    expected.forEach(([x = 0, z = 0], worldRotation) => {
        const direction = getCameraHorizontalDirection(worldRotation);
        assert.ok(Math.abs(direction.x - x) < 1e-9);
        assert.ok(Math.abs(direction.z - z) < 1e-9);
    });
});

test('the quarter turns come back from the direction the camera looks in', () => {
    for (const worldRotation of [0, 1, 2, 3]) {
        const toCamera = getCameraHorizontalDirection(worldRotation);
        // The camera looks down at the garden, away from its own side.
        const view = new Vector3(-toCamera.x, -1.2, -toCamera.z).normalize();
        assert.equal(getCameraQuarterTurns(view), worldRotation);
        // A view a little off the quarter turn still counts as it.
        const turned = view
            .clone()
            .applyAxisAngle(new Vector3(0, 1, 0), 0.3)
            .normalize();
        assert.equal(getCameraQuarterTurns(turned), worldRotation);
    }
    assert.equal(getCameraQuarterTurns(new Vector3(0, -1, 0)), null);
});

test('folding mirrors only lights behind the garden and keeps their height', () => {
    const camera = getCameraHorizontalDirection(0);
    const front = new Vector3(-0.3, 0.8, -0.5);
    assert.deepEqual(
        foldLightTowardCamera(front, camera).toArray(),
        front.toArray(),
    );

    const behind = new Vector3(0.4, 0.6, 0.6);
    const folded = foldLightTowardCamera(behind, camera);
    assert.equal(folded.y, behind.y);
    assert.ok(Math.abs(folded.length() - behind.length()) < 1e-9);
    assert.ok(folded.x * camera.x + folded.z * camera.z > 0);
    // The light stays on the same side of the view, left or right.
    const lateral = new Vector3(-camera.z, 0, camera.x);
    assert.ok(Math.abs(folded.dot(lateral) - behind.dot(lateral)) < 1e-9);

    const lifted = liftLightDirection(new Vector3(1, 0.1, 0), 0.8);
    assert.ok(Math.abs(lifted.y - 0.8) < 1e-9);
    assert.ok(Math.abs(lifted.length() - 1) < 1e-9);

    // A noon sun almost straight up is lowered, keeping its compass
    // direction, so one visible side of a block stays lit.
    const noon = new Vector3(0.1, 0.98, -0.2);
    const lowered = liftLightDirection(noon, 0.8, 0.9);
    assert.ok(Math.abs(lowered.y - 0.9) < 1e-9);
    assert.ok(Math.abs(lowered.length() - 1) < 1e-9);
    assert.ok(Math.abs(lowered.x / lowered.z - noon.x / noon.z) < 1e-9);
    const overhead = liftLightDirection(new Vector3(0, 1, 0), 0.8, 0.9);
    assert.ok(Math.abs(overhead.y - 0.9) < 1e-9);
    assert.ok(Math.abs(overhead.length() - 1) < 1e-9);
});

test('weather keeps the garden light and colourful', () => {
    const midday = luminance(shade(lightAt(times.midday), grass, up));
    for (const weather of [
        { cloudy: 1 },
        { cloudy: 0.85, rainy: 1, foggy: 0.12 },
        { cloudy: 0.6, foggy: 1 },
        // mode=fog: the fog weather itself, light cover.
        { cloudy: 0.2, foggy: 1 },
        { cloudy: 1, rainy: 1, foggy: 0.35, thundery: 1 },
    ]) {
        const lighting = lightAt(times.midday, { weather });
        const top = shade(lighting, grass, up);
        const pathTop = shade(lighting, path, up);
        const hsl = { h: 0, l: 0, s: 0 };
        pathTop.getHSL(hsl);
        assert.ok(luminance(top) > midday * 0.75, JSON.stringify(weather));
        assert.ok(hsl.s > 0.5, `path saturation ${hsl.s}`);
    }
});

test('night cloud keeps the garden colourful instead of washing it pink', () => {
    const clear = lightAt(times.night);
    const pathHsl = { h: 0, l: 0, s: 0 };
    shade(clear, path, up).getHSL(pathHsl);
    for (const weather of [
        { cloudy: 0.85, foggy: 0.06 },
        { cloudy: 0.85, rainy: 1, foggy: 0.12 },
    ]) {
        const lighting = lightAt(times.night, { weather });
        // Cloud takes only part of the night key, so the fill does not
        // take over and turn orange soil pink and grass mint.
        assert.ok(
            lighting.key.intensity / clear.key.intensity > 0.75,
            `night key ${lighting.key.intensity / clear.key.intensity}`,
        );
        const hsl = { h: 0, l: 0, s: 0 };
        shade(lighting, path, up).getHSL(hsl);
        assert.ok(
            Math.abs(hsl.h - pathHsl.h) < 0.03,
            `path hue ${hsl.h} vs ${pathHsl.h}`,
        );
        assert.ok(hsl.s > pathHsl.s * 0.85, `path saturation ${hsl.s}`);
    }
});

test('fog keeps most of the key light, like the target', () => {
    const clear = lightAt(times.midday);
    const fog = lightAt(times.midday, { weather: { cloudy: 0.2, foggy: 1 } });
    const keyShare = fog.key.intensity / clear.key.intensity;
    assert.ok(keyShare >= 0.4, `fog key ${keyShare}`);
    const midday = luminance(shade(clear, grass, up));
    assert.ok(luminance(shade(fog, grass, up)) > midday * 0.82);
});

test('fog takes the horizon colour and stays light at the garden', () => {
    assert.equal(
        resolveAtmosphereFog({ foggy: 0, horizonColor: new Color() }),
        null,
    );
    const horizon = new Color('#c8d8ec');
    const fog = resolveAtmosphereFog({
        cameraDistance: 100,
        foggy: 1,
        horizonColor: horizon,
    });
    assert.ok(fog);
    const hsl = { h: 0, l: 0, s: 0 };
    fog.color.getHSL(hsl);
    assert.ok(hsl.s > 0.2, 'fog is tinted, not grey');
    // At the garden centre fog covers only a small share of the colour.
    const centre = (100 - fog.near) / (fog.far - fog.near);
    assert.ok(centre > 0 && centre < 0.25, `centre fog ${centre}`);
});

// User decision 2026-11-25: lower cloud cover keeps the island brighter, full
// cover stays as dark as before (`gameWeatherLightRig.coverDimming`).
const storm = (cloudy: number) => ({
    cloudy,
    rainy: 1,
    foggy: 0.35,
    thundery: 1,
});
const heavyRain = (cloudy: number) => ({ cloudy, rainy: 1, foggy: 0.12 });
const overcast = (cloudy: number) => ({ cloudy, foggy: 0.06 });

/** `mode=lightrain` at its cover. */
const lightRain = (cloudy: number) => ({ cloudy, rainy: 0.6, foggy: 0.08 });
/** `mode=snow` at its cover. */
const snowfall = (cloudy: number) => ({ cloudy, snowy: 0.7, foggy: 0.2 });
/**
 * Cloud covers the island meets: the live weather symbols
 * (`populateWeatherFromSymbol`: 0.2, 0.33, 0.4, 0.6, 0.66 and 1) and the
 * debug presets (partly 0.4, snow 0.75, cloudy, light rain and rain 0.85).
 */
const usualCovers = [0.2, 0.33, 0.4, 0.6, 0.66, 0.75, 0.85, 1];

test('the cover curve rises smoothly and is exactly 1 from cover 0.75 up', () => {
    let previous = -1;
    for (let step = 0; step <= 100; step += 1) {
        const share = resolveCoverDimmingShare(step / 100);
        assert.ok(share >= previous, `not monotonic at ${step / 100}`);
        assert.ok(share >= 0 && share <= 1);
        previous = share;
    }
    assert.equal(resolveCoverDimmingShare(0), 0);
    // High cover is as dark as before, the presets' 0.75 (snow) and 0.85
    // (cloudy, light rain, rain) included.
    for (const cloudy of [0.75, 0.8, 0.85, 0.9, 0.95, 1]) {
        assert.equal(resolveCoverDimmingShare(cloudy), 1);
    }
    // The user's "in between": about half at 0.6, at most a quarter at 0.4.
    assert.ok(resolveCoverDimmingShare(0.4) <= 0.25);
    const half = resolveCoverDimmingShare(0.6);
    assert.ok(half > 0.4 && half < 0.6, `0.6 keeps ${half}`);
    // Control points are hit exactly.
    for (const [cover, share] of gameWeatherLightRig.coverDimming.points) {
        assert.ok(
            Math.abs(resolveCoverDimmingShare(cover) - share) < 1e-12,
            `point ${cover}`,
        );
    }
});

/**
 * The rig before the cover curve, dumped from the code as it was with the
 * inputs of `lightAt` (midday sun at every hour), to 8 digits: key, ambient
 * and hemisphere intensities, hemisphere sky and ground colours. A full
 * share must give it back, at full cover and at broken cover alike, so
 * `coverShare: 1` is a true "as before" reference for the tests below.
 */
const rigBeforeCurve = [
    ['midday', storm(1), 1.1620938, 3.02, 7.9275, 'd2d4f8', 'd2c1c6'],
    ['midday', heavyRain(1), 1.1620938, 2.928, 7.686, 'd2d4f8', 'd2c1c6'],
    ['midday', overcast(1), 1.2085775, 2.904, 7.623, 'd2d4f8', 'd2c1c6'],
    ['midday', storm(0.4), 4.1215593, 2.252, 5.9115, 'cfd2f8', 'd5c2c5'],
    ['midday', overcast(0.6), 3.7496893, 2.392, 6.279, 'c6cefa', 'dbc7c1'],
    ['sunset', storm(1), 1.267227, 3.02, 8.0565283, 'd3d2f8', 'd7bcbf'],
    ['sunset', heavyRain(1), 1.267227, 2.928, 7.8110977, 'd3d2f8', 'd7bcbf'],
    ['sunset', overcast(1), 1.317916, 2.904, 7.7470723, 'd3d2f8', 'd7bcbf'],
    ['sunset', storm(0.4), 4.4944316, 2.252, 6.0077158, 'cfd0f8', 'dbbdbc'],
    ['sunset', overcast(0.6), 4.088919, 2.392, 6.3811973, 'c8cafa', 'e2c0b4'],
    ['night', storm(1), 2.7587594, 2.3175, 5.15, 'd7d6f6', 'aeafde'],
    ['night', heavyRain(1), 3.1462493, 2.214, 4.92, 'd7d6f6', 'aeafde'],
    ['night', overcast(1), 3.2473336, 2.187, 4.86, 'd7d6f6', 'aeafde'],
    ['night', storm(0.4), 3.2768166, 2.1015, 4.67, 'd5d4f6', 'abafe0'],
    ['night', overcast(0.6), 3.5927051, 2.043, 4.54, 'd1d1f7', 'a4ade4'],
] as const;

test('a full share gives back the rig from before the cover curve', () => {
    for (const [
        name,
        weather,
        key,
        ambient,
        hemisphere,
        sky,
        ground,
    ] of rigBeforeCurve) {
        const label = `${name} ${JSON.stringify(weather)}`;
        const lighting = lightAt(times[name], {
            weather,
            coverShare: fullWeatherLight,
        });
        assert.ok(Math.abs(lighting.key.intensity - key) < 1e-6, label);
        assert.ok(Math.abs(lighting.ambient.intensity - ambient) < 1e-6, label);
        assert.ok(
            Math.abs(lighting.hemisphere.intensity - hemisphere) < 1e-6,
            label,
        );
        assert.equal(lighting.hemisphere.color.getHexString(), sky, label);
        assert.equal(
            lighting.hemisphere.groundColor.getHexString(),
            ground,
            label,
        );
    }
});

test('high cover keeps the island light exactly as before', () => {
    const highCover = [
        storm(1),
        storm(0.85),
        storm(0.75),
        heavyRain(1),
        heavyRain(0.85),
        lightRain(0.85),
        overcast(1),
        overcast(0.85),
        snowfall(0.75),
        { cloudy: 1, rainy: 0.33, foggy: 0.66 },
    ];
    for (const weather of highCover) {
        assert.equal(resolveWeatherCoverDimming(weather), fullWeatherLight);
        for (const [name, timeOfDay] of Object.entries(times)) {
            assert.deepEqual(
                lightAt(timeOfDay, { weather }),
                lightAt(timeOfDay, {
                    weather,
                    coverShare: fullWeatherLight,
                }),
                `${name} ${JSON.stringify(weather)}`,
            );
        }
    }
});

test('fog and clear days keep exactly their light', () => {
    // mode=fog and mode=mist, and the live fog symbols without rain: fog is
    // the weather, not the cover.
    for (const weather of [
        { cloudy: 0.2, foggy: 1 },
        { cloudy: 0.6, foggy: 1 },
        { cloudy: 0.33, foggy: 0.66 },
        { foggy: 1 },
    ]) {
        assert.equal(resolveWeatherCoverDimming(weather), fullWeatherLight);
    }
    for (const weather of [
        {},
        { cloudy: 0 },
        { cloudy: 0.2, foggy: 1 },
        { cloudy: 0.6, foggy: 1 },
        { cloudy: 0.33, foggy: 0.66 },
        { foggy: 1 },
    ]) {
        for (const timeOfDay of [times.midday, times.sunset, times.night]) {
            assert.deepEqual(
                lightAt(timeOfDay, { weather }),
                lightAt(timeOfDay, {
                    weather,
                    coverShare: fullWeatherLight,
                }),
                JSON.stringify(weather),
            );
        }
    }
    // A clear sky has no weather term to scale: same as no weather at all.
    assert.deepEqual(
        lightAt(times.midday, { weather: { cloudy: 0 } }),
        lightAt(times.midday),
    );
});

test('a storm brings fog that follows the cover; fog of its own does not', () => {
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-12;
    const lowShare = resolveCoverDimmingShare(0.4);
    // Rain, snow and thunder bring their fog: the cover rules all of it.
    for (const weather of [
        storm(0.4),
        heavyRain(0.4),
        { cloudy: 0.4, foggy: 0.35, storm: 1 },
        snowfall(0.4),
        // Overcast's thin haze (0.06) is under the hold.
        overcast(0.4),
    ]) {
        assert.ok(
            near(resolveWeatherCoverDimming(weather), lowShare),
            JSON.stringify(weather),
        );
    }
    // Fog of its own between the hold's ends keeps part of its light.
    const ownFog = resolveWeatherCoverDimming({ cloudy: 0.4, foggy: 0.35 });
    assert.ok(ownFog > lowShare && ownFog < 1, `own fog ${ownFog}`);
    // The island's overcast tint takes the same share.
    const weather = storm(0.6);
    const share = resolveWeatherCoverDimming(weather);
    assert.ok(resolveIslandOvercast(weather, share) < resolveOvercast(weather));
    assert.equal(
        resolveIslandOvercast(weather, fullWeatherLight),
        resolveOvercast(weather),
    );
});

test('ground mist and mist rolls read one island fog amount', () => {
    // `FogLayer` (ground mist, back haze) and `MistRolls` (and the sky the
    // rolls reserve) all read `resolveIslandFoggy`, so a low-cover storm
    // never keeps storm-fog rolls at the rim once its ground mist is gone.
    const lowStorm = storm(0.4);
    assert.equal(
        resolveIslandFoggy(lowStorm),
        (lowStorm.foggy ?? 0) * resolveWeatherCoverDimming(lowStorm),
    );
    assert.ok(resolveIslandFoggy(lowStorm) < (lowStorm.foggy ?? 0) * 0.2);
    // Full cover, fog days and clear days keep their fog exactly.
    for (const weather of [
        storm(1),
        storm(0.75),
        { cloudy: 0.4, foggy: 0.8 },
        { cloudy: 0, foggy: 0 },
    ]) {
        assert.equal(
            resolveIslandFoggy(weather),
            weather.foggy ?? 0,
            JSON.stringify(weather),
        );
    }
});

test('lower cover keeps more of the clear key, in the shares of the curve', () => {
    for (const [name, timeOfDay] of [
        ['midday', times.midday],
        ['night', times.night],
    ] as const) {
        const clear = lightAt(timeOfDay).key.intensity;
        for (const weather of [storm, heavyRain, overcast]) {
            for (const cloudy of [0.4, 0.6, 0.66]) {
                const today = lightAt(timeOfDay, {
                    weather: weather(cloudy),
                    coverShare: fullWeatherLight,
                }).key.intensity;
                const now = lightAt(timeOfDay, {
                    weather: weather(cloudy),
                }).key.intensity;
                const share = (clear - now) / (clear - today);
                const label = `${name} ${JSON.stringify(weather(cloudy))}: ${share}`;
                assert.ok(now >= today, label);
                if (cloudy === 0.4) assert.ok(share <= 0.25, label);
                if (cloudy === 0.6)
                    assert.ok(share > 0.35 && share < 0.65, label);
                // The live "cloudy medium" and showers under "sunny, medium
                // clouds" symbols: about 60%.
                if (cloudy === 0.66)
                    assert.ok(share > 0.45 && share < 0.75, label);
            }
        }
    }
});

test('lower cover never darkens the night: the cloud fill stays, the key comes back', () => {
    const clear = lightAt(times.night);
    for (const weather of [storm, heavyRain, overcast]) {
        for (const cloudy of [0.4, 0.6, 0.66]) {
            const label = JSON.stringify(weather(cloudy));
            const today = lightAt(times.night, {
                weather: weather(cloudy),
                coverShare: fullWeatherLight,
            });
            const now = lightAt(times.night, { weather: weather(cloudy) });
            // `coverDimming.nightFillHold`: the fill of a cloudy night stays.
            assert.equal(
                now.hemisphere.intensity,
                today.hemisphere.intensity,
                label,
            );
            assert.equal(now.ambient.intensity, today.ambient.intensity, label);
            assert.ok(now.key.intensity >= today.key.intensity, label);
            // So a cloudier night is never darker than a clear one.
            assert.ok(
                luminance(shade(now, grass, up)) >=
                    luminance(shade(clear, grass, up)),
                label,
            );
        }
    }
    // By day the fill follows the curve: lower cover, less fill boost.
    const middayToday = lightAt(times.midday, {
        weather: storm(0.6),
        coverShare: fullWeatherLight,
    });
    const middayNow = lightAt(times.midday, { weather: storm(0.6) });
    assert.ok(
        middayNow.hemisphere.intensity < middayToday.hemisphere.intensity,
    );
});

test('lit sides stay out of the day shade veil at every usual cover', () => {
    // As `buildShadeVeilShaderChunk` lights a side: the day veil opens with
    // the key against the sky fill, and covers the faces whose diffuse light
    // comes from the key by less than `directEnd`. A key that came back only
    // in part opened the gate while the lit sides still got too little
    // direct light, so both sides took the veil and orange soil and cream
    // walls turned pink (mode=snow with the first curve).
    const litSoilWarmth = (lighting: AtmosphereLighting, side: Vector3) => {
        const keyDirection = lighting.key.position.clone().normalize();
        const direct = lighting.key.color
            .clone()
            .multiplyScalar(
                lighting.key.intensity * Math.max(0, side.dot(keyDirection)),
            )
            .multiply(path)
            .multiplyScalar(1 / Math.PI);
        const indirect = lighting.hemisphere.groundColor
            .clone()
            .lerp(lighting.hemisphere.color, 0.5)
            .multiplyScalar(lighting.hemisphere.intensity)
            .add(
                lighting.ambient.color
                    .clone()
                    .multiplyScalar(lighting.ambient.intensity),
            )
            .multiply(path)
            .multiplyScalar(1 / Math.PI);
        // The added periwinkle is light on top of the colour: no albedo and
        // no Lambert 1/π, so it weighs most on dark, fill-lit faces.
        const sky =
            luminance(lighting.hemisphere.color) *
            lighting.hemisphere.intensity;
        const gate = smoothstep(
            gameShadeVeil.keyShareStart,
            gameShadeVeil.keyShareEnd,
            (luminance(lighting.key.color) * lighting.key.intensity) / sky,
        );
        const veil =
            gate *
            (1 -
                smoothstep(
                    gameShadeVeil.directStart,
                    gameShadeVeil.directEnd,
                    luminance(direct) /
                        (luminance(direct) + luminance(indirect)),
                ));
        const [tintRed, tintGreen, tintBlue] = gameShadeVeil.day.tint;
        const tintLuma = luminance(new Color(tintRed, tintGreen, tintBlue));
        const tint = gameShadeVeil.day.tint.map(
            (value) =>
                1 + ((value / tintLuma) * gameShadeVeil.day.lift - 1) * veil,
        );
        const color = direct
            .clone()
            .add(
                new Color(
                    indirect.r * (tint[0] ?? 1),
                    indirect.g * (tint[1] ?? 1),
                    indirect.b * (tint[2] ?? 1),
                ),
            )
            .add(
                new Color(gameShadeVeil.color).multiplyScalar(
                    sky * gameShadeVeil.day.strength * veil,
                ),
            );
        // Warmth: how far red leads blue, against the brightness.
        return (color.r - color.b) / luminance(color);
    };
    for (const [name, timeOfDay, sunPosition] of [
        ['midday', times.midday, middaySun],
        ['sunset', times.sunset, sunsetSun],
    ] as const) {
        const clear = lightAt(timeOfDay, { sunPosition });
        const keyDirection = clear.key.position.clone().normalize();
        const [litSide] = [leftSide, rightSide].sort(
            (a, b) => b.dot(keyDirection) - a.dot(keyDirection),
        );
        assert.ok(litSide);
        const clearWarmth = litSoilWarmth(clear, litSide);
        for (const weather of [
            storm,
            heavyRain,
            lightRain,
            overcast,
            snowfall,
        ]) {
            for (const cloudy of usualCovers) {
                const warmth = litSoilWarmth(
                    lightAt(timeOfDay, {
                        sunPosition,
                        weather: weather(cloudy),
                    }),
                    litSide,
                );
                // Measured in the game at midday: lit soil reads pink at 0.70
                // of the clear warmth (mode=snow with the first curve, pixel
                // 195/114/116) and orange at 0.77 (storm at 0.66, pixel
                // 196/115/96).
                assert.ok(
                    warmth >= clearWarmth * 0.74,
                    `${name} ${JSON.stringify(weather(cloudy))}: ${warmth / clearWarmth}`,
                );
            }
        }
    }
});

test('snow under broken cloud moves toward the clear look, never greyer or bluer', () => {
    const snow = new Color().setRGB(0.82, 0.86, 0.95);
    // The live snow symbols under "sunny, medium clouds".
    const weather = { cloudy: 0.66, snowy: 0.66 };
    for (const [name, timeOfDay] of [
        ['midday', times.midday],
        ['sunset', times.sunset],
        ['night', times.night],
    ] as const) {
        const clear = shade(lightAt(timeOfDay), snow, up);
        const before = shade(
            lightAt(timeOfDay, { weather, coverShare: fullWeatherLight }),
            snow,
            up,
        );
        const now = shade(lightAt(timeOfDay, { weather }), snow, up);
        const blueLead = (color: Color) => color.b / color.r;
        // By day and at sunset it is lighter and less blue than before; at
        // night it moves part of the way toward the clear night's blue.
        assert.ok(
            luminance(now) >=
                Math.min(luminance(before), luminance(clear)) * 0.99,
            `${name} snow luminance ${luminance(now)}`,
        );
        assert.ok(
            blueLead(now) <= Math.max(blueLead(before), blueLead(clear)) * 1.01,
            `${name} snow blue lead ${blueLead(now)}`,
        );
        if (name !== 'night') {
            assert.ok(luminance(now) >= luminance(before), name);
            assert.ok(blueLead(now) <= blueLead(before), name);
        }
    }
});
