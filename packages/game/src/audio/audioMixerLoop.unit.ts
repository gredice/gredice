import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { DEFAULT_AUDIO_CONFIG } from '../utils/audioConfig';
import { createGameAudio } from './audioMixer';

class Parameter {
    value = 1;
    target = 1;
    start = 0;
    constant = 0;
    sample(time: number): number {
        return this.constant
            ? this.target +
                  (this.value - this.target) *
                      Math.exp(-(time - this.start) / this.constant)
            : this.value;
    }
    cancelAndHoldAtTime(time: number) {
        this.value = this.sample(time);
        this.constant = 0;
    }
    setValueAtTime(value: number, time: number) {
        this.value = value;
        this.target = value;
        this.start = time;
        this.constant = 0;
    }
    setTargetAtTime(value: number, time: number, constant: number) {
        this.target = value;
        this.start = time;
        this.constant = constant;
    }
}
class Gain {
    gain = new Parameter();
    connected: unknown;
    connect(value: unknown) {
        this.connected = value;
    }
    disconnect() {}
}
class Source extends EventTarget {
    starts = 0;
    stops = 0;
    connect() {}
    disconnect() {}
    start() {
        this.starts++;
    }
    stop() {
        this.stops++;
        this.dispatchEvent(new Event('ended'));
    }
}

function harness(t: TestContext, missing = false) {
    const gains: Gain[] = [];
    const sources: Source[] = [];
    const documentValue = Object.assign(new EventTarget(), { hidden: false });
    const context = { currentTime: 0 };
    class Context extends EventTarget {
        state = 'running';
        get currentTime() {
            return context.currentTime;
        }
        destination = {};
        createGain() {
            const gain = new Gain();
            gains.push(gain);
            return gain;
        }
        createBufferSource() {
            const source = new Source();
            sources.push(source);
            return source;
        }
        async decodeAudioData() {
            return { duration: 6 };
        }
        async resume() {
            this.state = 'running';
        }
        async suspend() {
            this.state = 'suspended';
        }
        async close() {
            this.state = 'closed';
        }
    }
    const globals = {
        window: new EventTarget(),
        document: documentValue,
        AudioContext: Context,
    };
    const descriptors = Object.keys(globals).map(
        (key) =>
            [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
    );
    for (const [key, value] of Object.entries(globals))
        Object.defineProperty(globalThis, key, { value, configurable: true });
    const fetch = t.mock.method(
        globalThis,
        'fetch',
        async () =>
            new Response(new Uint8Array(4), { status: missing ? 404 : 200 }),
    );
    const audio = createGameAudio({ ...DEFAULT_AUDIO_CONFIG });
    audio.registerLoop({
        id: 'rustle',
        channel: 'ambient',
        src: '/rustle.wav',
        loop: true,
        volume: 0,
        silentFailure: true,
    });
    t.after(() => {
        audio.dispose();
        for (const [key, descriptor] of descriptors) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        }
    });
    return { audio, context, gains, sources, fetch, document: documentValue };
}

test('gain changes converge continuously while keeping one cached loop source', async (t) => {
    const { audio, context, gains, sources, fetch } = harness(t);
    audio.setLoopTargetVolume('rustle', 0.12, 0.3);
    await setImmediate();
    assert.equal(sources.length, 1);
    assert.equal(sources[0].starts, 1);
    assert.equal(fetch.mock.callCount(), 1);
    const parameter = gains[4].gain;
    assert.equal(parameter.value, 0);
    assert(Math.abs(parameter.sample(1.5) - 0.12) < 0.001);
    context.currentTime = 0.1;
    const before = parameter.sample(0.1);
    audio.setLoopTargetVolume('rustle', 0.06, 0.3);
    assert.equal(parameter.value, before);
    for (const target of [0.1, 0.02, 0.14, 0.07])
        audio.setLoopTargetVolume('rustle', target);
    await setImmediate();
    assert.equal(sources.length, 1);
    assert.equal(sources[0].stops, 0);
    assert.equal(fetch.mock.callCount(), 1);
    assert.equal(gains[4].connected, gains[1]); // ambient channel
});
test('fade-to-zero stops inaudible loops and rapid reactivation cancels the pending stop', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { audio, sources, fetch } = harness(t);
    audio.setLoopTargetVolume('rustle', 0.1);
    await setImmediate();
    audio.setLoopTargetVolume('rustle', 0);
    t.mock.timers.tick(500);
    audio.setLoopTargetVolume('rustle', 0.08);
    t.mock.timers.tick(2000);
    assert.equal(sources.length, 1);
    assert.equal(sources[0].stops, 0);
    audio.setLoopTargetVolume('rustle', 0);
    t.mock.timers.tick(1500);
    assert.equal(sources[0].stops, 1);
    audio.setLoopTargetVolume('rustle', 0.1);
    await setImmediate();
    assert.equal(sources.length, 2);
    assert.equal(fetch.mock.callCount(), 1);
});
test('master/ambient mute and background lifecycle use existing mixer controls', async (t) => {
    const { audio, gains, sources, document } = harness(t);
    audio.setLoopTargetVolume('rustle', 0.1);
    await setImmediate();
    audio.setMasterMuted(true);
    assert.equal(gains[0].gain.value, 0);
    audio.setChannelMuted('ambient', true);
    assert.equal(gains[1].gain.value, 0);
    audio.setMasterMuted(false);
    audio.setChannelMuted('ambient', false);
    await setImmediate();
    assert.equal(sources.length, 1);
    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await setImmediate();
    assert.equal(sources[0].stops, 1);
    document.hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await setImmediate();
    assert.equal(sources.length, 2);
    audio.unregisterLoop('rustle');
    assert.equal(sources[1].stops, 1);
});
test('missing rustle asset stays silent without repeated weather-driven fetches', async (t) => {
    const { audio, sources, fetch } = harness(t, true);
    const warn = t.mock.method(console, 'warn', () => {});
    for (const target of [0.1, 0.08, 0.12]) {
        audio.setLoopTargetVolume('rustle', target);
        await setImmediate();
    }
    assert.equal(sources.length, 0);
    assert.equal(fetch.mock.callCount(), 1);
    assert.equal(warn.mock.callCount(), 0);
});
test('unregister while loading cannot leave an orphaned audible source', async (t) => {
    const { audio, sources } = harness(t);
    audio.setLoopTargetVolume('rustle', 0.1);
    audio.unregisterLoop('rustle');
    await setImmediate();
    assert.equal(sources.length, 0);
});
