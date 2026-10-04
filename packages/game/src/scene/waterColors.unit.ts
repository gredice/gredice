import assert from 'node:assert/strict';
import test from 'node:test';
import { Color } from 'three';
import { resolveWaterColors } from './waterColors';

const clearWeather = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowy: 0,
};

function brightness(hex: string) {
    const color = new Color(hex);
    return color.r + color.g + color.b;
}

function red(hex: string) {
    return new Color(hex).r;
}

function blue(hex: string) {
    return new Color(hex).b;
}

function colorDistance(hex: string, target: Color) {
    const color = new Color(hex);
    return Math.hypot(
        color.r - target.r,
        color.g - target.g,
        color.b - target.b,
    );
}

test('darkens water with the night sky', () => {
    const day = resolveWaterColors({
        skyColor: new Color('#e7e2cc'),
        timeOfDay: 0.5,
        weather: clearWeather,
    });
    const night = resolveWaterColors({
        skyColor: new Color('#2d3947'),
        timeOfDay: 0.97,
        weather: clearWeather,
    });

    assert.ok(brightness(night.shallow) < brightness(day.shallow) * 0.7);
    assert.ok(brightness(night.foam) < brightness(day.foam) * 0.8);
});

test('leans water toward warm twilight sky colors', () => {
    const day = resolveWaterColors({
        skyColor: new Color('#e7e2cc'),
        timeOfDay: 0.5,
        weather: clearWeather,
    });
    const sunset = resolveWaterColors({
        skyColor: new Color('#f8b195'),
        timeOfDay: 0.765,
        weather: clearWeather,
    });

    assert.ok(red(sunset.deep) > red(day.deep));
    assert.ok(blue(sunset.deep) < blue(day.deep));
});

test('pulls water toward gray overcast sky colors', () => {
    const overcastSky = new Color('#8a8f95');
    const clear = resolveWaterColors({
        skyColor: new Color('#e7e2cc'),
        timeOfDay: 0.5,
        weather: clearWeather,
    });
    const overcast = resolveWaterColors({
        skyColor: overcastSky,
        timeOfDay: 0.5,
        weather: {
            cloudy: 1,
            foggy: 0.4,
            rainy: 0,
            snowy: 0,
        },
    });

    assert.ok(
        colorDistance(overcast.shallow, overcastSky) <
            colorDistance(clear.shallow, overcastSky),
    );
});
