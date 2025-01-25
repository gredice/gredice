import { useEffect, useRef } from "react";

function fromAudio(context: AudioContext, buffer: AudioBuffer) {
    return new AudioBufferSourceNode(context, {
        buffer
    });
}

// TODO: Option to overlap multiple play calls, queue or play one at a time
// TODO: Preload effect data to reduce latency
// TODO: Use shared gain node from context
function useSoundEffect(context: AudioContext, src: string, volume: number = 0.5) {
    const audioCache = useRef<AudioBuffer>(null);

    // TODO: Use shared cache for audio data

    return {
        async play() {
            // Load audio data if not already loaded
            if (!audioCache.current) {
                audioCache.current = await fetch(src).then(r => r.arrayBuffer()).then(b => context.decodeAudioData(b))
            }
            if (!audioCache.current) {
                return;
            }

            const sourceNode = fromAudio(context, audioCache.current);
            const gainNode = context.createGain();
            gainNode.gain.value = volume;
            sourceNode.connect(gainNode);
            gainNode.connect(context.destination);
            sourceNode.start();
            sourceNode.addEventListener('ended', () => {
                sourceNode.disconnect();
            });
        }
    };
}

// TODO: Use shared gain node from context
function useMusic(context: AudioContext, src: string, volume: number = 1) {
    const node = useRef<AudioBufferSourceNode>(null);
    const audioCache = useRef<AudioBuffer>(null);
    const gainNode = useRef<GainNode>(context.createGain());

    // Set the initial volume
    gainNode.current.gain.value = volume;

    // TODO: Implement switching to another track and cross-fade them

    useEffect(() => {
        return () => {
            if (gainNode.current) {
                gainNode.current.disconnect();
            }
            if (node.current) {
                node.current.stop();
            }
        };
    }, []);

    // TODO: Use shared cache for audio data

    return {
        async play() {
            // Load audio data if not already loaded
            if (!audioCache.current) {
                audioCache.current = await fetch(src).then(r => r.arrayBuffer()).then(b => context.decodeAudioData(b))
            }

            const audioBuffer = audioCache.current;
            if (!audioBuffer) {
                return;
            }

            if (node.current) {
                return;
            }

            node.current = fromAudio(context, audioBuffer);
            node.current.loop = true;
            node.current.connect(gainNode.current);
            gainNode.current.connect(context.destination);
            node.current.start();
        }
    };
}

export function audioMixer() {
    const audioContext = new AudioContext();

    // const availableOutputDevices = (await navigator.mediaDevices.enumerateDevices())
    //     .filter(d => d.kind === 'audiooutput');

    return {
        // outputDevices: availableOutputDevices.map(d => ({ id: d.deviceId, label: d.label })),
        useMusic: useMusic.bind(null, audioContext),
        useSoundEffect: useSoundEffect.bind(null, audioContext)
    };
}