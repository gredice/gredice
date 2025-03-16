import { useEffect, useId, useRef } from "react";

function fromAudio(context: AudioContext, buffer: AudioBuffer) {
    return new AudioBufferSourceNode(context, {
        buffer
    });
}

// TODO: Option to overlap multiple play calls, queue or play one at a time
// TODO: Preload effect data to reduce latency
function useSoundEffect(handler: mixerManagerData, context: AudioContext, src: string) {
    const audioCache = useRef<AudioBuffer>(null);

    // TODO: Use shared cache for audio data (if measured browser disk cache is slower)

    return {
        async play() {
            // Load audio data if not already loaded
            if (!audioCache.current) {
                audioCache.current = await fetch(src).then(r => r.arrayBuffer()).then(b => context.decodeAudioData(b))
            }

            // Ignore if unable to load
            const audioBuffer = audioCache.current;
            if (!audioBuffer) {
                console.warn('Failed to load sound effect', src);
                return;
            }

            const sourceNode = fromAudio(context, audioBuffer);
            const gainNode = context.createGain();
            sourceNode.connect(gainNode);
            gainNode.gain.value = handler.getVolume();
            gainNode.connect(context.destination);
            sourceNode.start();
            sourceNode.addEventListener('ended', () => {
                sourceNode.disconnect();
            });
        }
    };
}

type mixerManagerData = {
    getVolume: () => number
}

type mixerManagerHandler = {
    register: (id: string, operations: mixerManagementOperations) => void,
    unregister: (id: string) => void,
    queue: (id: string) => void,
    getVolume: () => number
}

type mixerManagementOperations = {
    updateVolume: () => void
    play: () => Promise<void>
}

// TODO: Use shared gain node from context
function useMusic(handler: mixerManagerHandler, context: AudioContext, config: { allowParallel?: boolean, loop?: boolean }, src: string) {
    const id = useId();
    const node = useRef<AudioBufferSourceNode>(null);
    const audioCache = useRef<AudioBuffer>(null);
    const gainNode = useRef<GainNode>(context.createGain());

    // TODO: Implement switching to another track and cross-fade them
    // TODO: Use shared cache for audio data
    const operations = {
        updateVolume() {
            if (gainNode.current) {
                gainNode.current.gain.value = handler.getVolume();
            }
        },
        async play() {
            handler.register(id, operations);
            if (context.state === 'suspended') {
                handler.queue(id);
                return;
            }

            // Load audio data if not already loaded
            if (!audioCache.current) {
                audioCache.current = await fetch(src).then(r => r.arrayBuffer()).then(b => context.decodeAudioData(b))
            }

            // Ignore if unable to load
            const audioBuffer = audioCache.current;
            if (!audioBuffer) {
                console.warn('Failed to load sound effect', src);
                return;
            }

            // Don't start new if already playing and parallel is not allowed
            if (!config.allowParallel && node.current) {
                return;
            }

            node.current = fromAudio(context, audioBuffer);
            node.current.loop = config.loop ?? false;
            node.current.connect(gainNode.current);
            gainNode.current.gain.value = handler.getVolume();
            gainNode.current.connect(context.destination);
            node.current.start();
        },
        stop() {
            const current = node.current;
            if (current) {
                current.stop();
                current.disconnect();
                node.current = null;
            }
        }
    };

    useEffect(() => {
        return () => {
            handler.unregister(id);
            if (gainNode.current) {
                gainNode.current.disconnect();
            }
            if (node.current) {
                node.current.stop();
            }
        };
    }, []);

    return {
        play: operations.play,
        stop: operations.stop
    };
}

export function audioMixer(defaultVolume: number, defaultMuted: boolean) {
    const audioContext = new AudioContext();
    const instances = new Map<string, mixerManagementOperations>();
    const playQueue = new Set<string>();
    let isMuted = defaultMuted;
    let volume = defaultVolume;

    function emptyQueue() {
        if (!playQueue.size) {
            return;
        }

        console.debug('Emptying audio queue (', playQueue.size, ')');
        for (const id of playQueue) {
            const instance = instances.get(id);
            if (instance) {
                instance.play();
            }
        }
        playQueue.clear();
    }

    async function resumeContextIfNeeded() {
        if (audioContext.state !== 'running') {
            console.debug('Resuming audio context');
            await audioContext.resume();
            if (audioContext.state !== 'suspended') {
                emptyQueue();
            }
        }
    }

    function setMuted(muted: boolean) {
        isMuted = muted;
        instances.forEach(i => i.updateVolume());
        resumeContextIfNeeded();
    }

    function setVolume(gain: number) {
        volume = gain;
        instances.forEach(i => i.updateVolume());
        resumeContextIfNeeded();
    }

    function register(id: string, operations: mixerManagementOperations) {
        console.debug('Registering audio source', id);
        instances.set(id, operations);
    }

    function unregister(id: string) {
        console.debug('Unregistering audio source', id);
        instances.delete(id);
    }

    function queue(id: string) {
        console.debug('Queuing audio source', id);
        playQueue.add(id);
    }

    function getVolume() {
        return isMuted ? 0 : volume;
    }

    // const availableOutputDevices = (await navigator.mediaDevices.enumerateDevices())
    //     .filter(d => d.kind === 'audiooutput');

    return {
        // outputDevices: availableOutputDevices.map(d => ({ id: d.deviceId, label: d.label })),
        getState: () => ({ isMuted, volume, isSuspended: audioContext.state === 'suspended' }),
        useMusic: useMusic.bind(null, { register, unregister, queue, getVolume }, audioContext, { allowParallel: false, loop: true }),
        useSoundEffect: useSoundEffect.bind(null, { getVolume }, audioContext),
        setMuted,
        setVolume,
        resumeContextIfNeeded
    };
}