import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import {
    type GameAudioChannelName,
    type GameAudioConfig,
    setAudioConfig,
} from '../utils/audioConfig';

type LoopAudioOptions = {
    loop?: boolean;
    volume?: number;
};

type SoundEffectOptions = {
    volume?: number;
    queueWhenLocked?: boolean;
};

type QueuedEffect = {
    channel: GameAudioChannelName;
    src: string;
    volume: number;
};

type LoopRequest = {
    id: string;
    channel: GameAudioChannelName;
    src: string;
    loop: boolean;
    volume: number;
    isRequested: boolean;
    source: AudioBufferSourceNode | null;
    gain: GainNode | null;
};

type ChannelState = {
    volume: number;
    isMuted: boolean;
};

export type GameAudioState = {
    isSuspended: boolean;
    isBackgrounded: boolean;
    master: ChannelState;
    ambient: ChannelState;
    effects: ChannelState;
    music: ChannelState;
};

const channels: GameAudioChannelName[] = ['ambient', 'effects', 'music'];
const unlockEvents = ['pointerdown', 'mousedown', 'touchstart', 'keydown'];
const maxQueuedEffects = 16;

function clampVolume(value: number) {
    return Math.min(1, Math.max(0, value));
}

function isPageVisible() {
    return typeof document === 'undefined' ? true : !document.hidden;
}

function getContextState(context: AudioContext | null) {
    return context?.state ?? 'suspended';
}

function createChannelController(
    manager: GameAudioManager,
    channel: GameAudioChannelName,
) {
    return {
        getState: () => manager.getChannelState(channel),
        setMuted: (muted: boolean) => manager.setChannelMuted(channel, muted),
        setVolume: (volume: number) =>
            manager.setChannelVolume(channel, volume),
        useMusic: (src: string, options?: LoopAudioOptions) =>
            useLoopingAudio(manager, channel, src, options),
        useSoundEffect: (src: string, options?: SoundEffectOptions) =>
            useSoundEffect(manager, channel, src, options),
    };
}

function useSoundEffect(
    manager: GameAudioManager,
    channel: GameAudioChannelName,
    src: string,
    options?: SoundEffectOptions,
) {
    const srcRef = useRef(src);
    const volume = options?.volume ?? 1;
    const queueWhenLocked = options?.queueWhenLocked ?? true;

    useEffect(() => {
        srcRef.current = src;
    }, [src]);

    const play = useCallback(
        () =>
            manager.playOneShot(channel, srcRef.current, {
                volume,
                queueWhenLocked,
            }),
        [channel, manager, queueWhenLocked, volume],
    );

    return useMemo(() => ({ play }), [play]);
}

function useLoopingAudio(
    manager: GameAudioManager,
    channel: GameAudioChannelName,
    src: string,
    options?: LoopAudioOptions,
) {
    const id = useId();
    const loop = options?.loop ?? true;
    const volume = options?.volume ?? 1;

    useEffect(() => {
        manager.registerLoop({
            id,
            channel,
            src,
            loop,
            volume,
        });

        return () => {
            manager.unregisterLoop(id);
        };
    }, [channel, id, loop, manager, src, volume]);

    const play = useCallback(() => manager.playLoop(id), [id, manager]);
    const stop = useCallback(() => manager.stopLoop(id), [id, manager]);

    return useMemo(() => ({ play, stop }), [play, stop]);
}

class GameAudioManager {
    private context: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private channelGains = new Map<GameAudioChannelName, GainNode>();
    private readonly bufferCache = new Map<string, Promise<AudioBuffer>>();
    private readonly loops = new Map<string, LoopRequest>();
    private readonly startingLoops = new Set<string>();
    private readonly queuedEffects: QueuedEffect[] = [];
    private readonly subscribers = new Set<() => void>();
    private resumePromise: Promise<void> | null = null;
    private hasUnlockedAudio = false;
    private config: GameAudioConfig;
    private stateSnapshot: GameAudioState;

    constructor(config: GameAudioConfig) {
        this.config = config;
        this.stateSnapshot = this.createStateSnapshot();
        this.attachBrowserListeners();
    }

    ambient = createChannelController(this, 'ambient');
    effects = createChannelController(this, 'effects');
    music = createChannelController(this, 'music');

    subscribe = (listener: () => void) => {
        this.subscribers.add(listener);
        return () => {
            this.subscribers.delete(listener);
        };
    };

    private createStateSnapshot(): GameAudioState {
        return {
            isSuspended: getContextState(this.context) !== 'running',
            isBackgrounded: !isPageVisible(),
            master: {
                volume: this.config.masterVolume,
                isMuted: this.config.masterIsMuted,
            },
            ambient: {
                volume: this.config.ambientVolume,
                isMuted: this.config.ambientIsMuted,
            },
            effects: {
                volume: this.config.effectsVolume,
                isMuted: this.config.effectsIsMuted,
            },
            music: {
                volume: this.config.musicVolume,
                isMuted: this.config.musicIsMuted,
            },
        };
    }

    getState = (): GameAudioState => this.stateSnapshot;

    getChannelState = (channel: GameAudioChannelName): ChannelState => {
        switch (channel) {
            case 'ambient':
                return {
                    volume: this.config.ambientVolume,
                    isMuted: this.config.ambientIsMuted,
                };
            case 'effects':
                return {
                    volume: this.config.effectsVolume,
                    isMuted: this.config.effectsIsMuted,
                };
            case 'music':
                return {
                    volume: this.config.musicVolume,
                    isMuted: this.config.musicIsMuted,
                };
        }
    };

    setMasterVolume = (volume: number) => {
        this.updateConfig({ masterVolume: clampVolume(volume) });
        void this.resume();
    };

    setMasterMuted = (isMuted: boolean) => {
        this.updateConfig({ masterIsMuted: isMuted });
        if (!isMuted) {
            void this.resume();
        }
    };

    setChannelVolume = (channel: GameAudioChannelName, volume: number) => {
        const nextVolume = clampVolume(volume);
        switch (channel) {
            case 'ambient':
                this.updateConfig({ ambientVolume: nextVolume });
                break;
            case 'effects':
                this.updateConfig({ effectsVolume: nextVolume });
                break;
            case 'music':
                this.updateConfig({ musicVolume: nextVolume });
                break;
        }
        void this.resume();
    };

    setChannelMuted = (channel: GameAudioChannelName, isMuted: boolean) => {
        switch (channel) {
            case 'ambient':
                this.updateConfig({ ambientIsMuted: isMuted });
                break;
            case 'effects':
                this.updateConfig({ effectsIsMuted: isMuted });
                break;
            case 'music':
                this.updateConfig({ musicIsMuted: isMuted });
                break;
        }
        if (!isMuted) {
            void this.resume();
        }
    };

    resume = async (options?: { userActivation?: boolean }) => {
        if (!isPageVisible()) {
            this.emit();
            return;
        }

        const context = this.ensureContext();
        if (!context || context.state === 'closed') {
            this.emit();
            return;
        }

        if (options?.userActivation) {
            this.hasUnlockedAudio = true;
        }

        if (this.resumePromise) {
            await this.resumePromise;
            return;
        }

        this.resumePromise = this.resumeContext(context);
        try {
            await this.resumePromise;
        } finally {
            this.resumePromise = null;
        }
    };

    playOneShot = async (
        channel: GameAudioChannelName,
        src: string,
        options?: SoundEffectOptions,
    ) => {
        if (!isPageVisible()) {
            return;
        }

        const context = this.ensureContext();
        if (!context || context.state === 'closed') {
            return;
        }

        if (context.state !== 'running') {
            await this.resume();
        }

        if (context.state !== 'running') {
            if (options?.queueWhenLocked ?? true) {
                this.queueEffect({
                    channel,
                    src,
                    volume: clampVolume(options?.volume ?? 1),
                });
            }
            return;
        }

        try {
            const buffer = await this.loadBuffer(src);
            if (context.state !== 'running' || !isPageVisible()) {
                return;
            }

            const source = context.createBufferSource();
            const gain = context.createGain();
            source.buffer = buffer;
            gain.gain.value = clampVolume(options?.volume ?? 1);
            source.connect(gain);
            gain.connect(this.getChannelGain(channel));
            source.addEventListener('ended', () => {
                source.disconnect();
                gain.disconnect();
            });
            source.start();
        } catch (error) {
            console.warn('Failed to play sound effect', src, error);
        }
    };

    registerLoop = ({
        id,
        channel,
        src,
        loop,
        volume,
    }: {
        id: string;
        channel: GameAudioChannelName;
        src: string;
        loop: boolean;
        volume: number;
    }) => {
        const existing = this.loops.get(id);
        if (existing) {
            const needsRestart =
                existing.src !== src ||
                existing.channel !== channel ||
                existing.loop !== loop;

            existing.src = src;
            existing.channel = channel;
            existing.loop = loop;
            existing.volume = clampVolume(volume);

            if (needsRestart && existing.isRequested) {
                this.stopLoopSource(existing);
                void this.startLoop(id);
            } else if (existing.gain) {
                existing.gain.gain.value = existing.volume;
            }
            return;
        }

        this.loops.set(id, {
            id,
            channel,
            src,
            loop,
            volume: clampVolume(volume),
            isRequested: false,
            source: null,
            gain: null,
        });
    };

    unregisterLoop = (id: string) => {
        const loop = this.loops.get(id);
        if (loop) {
            loop.isRequested = false;
            this.stopLoopSource(loop);
        }
        this.loops.delete(id);
        this.startingLoops.delete(id);
    };

    playLoop = async (id: string) => {
        const loop = this.loops.get(id);
        if (!loop) {
            return;
        }

        loop.isRequested = true;
        await this.startLoop(id);
    };

    stopLoop = (id: string) => {
        const loop = this.loops.get(id);
        if (!loop) {
            return;
        }

        loop.isRequested = false;
        this.stopLoopSource(loop);
    };

    dispose = () => {
        for (const loop of this.loops.values()) {
            this.stopLoopSource(loop);
        }
        this.loops.clear();
        this.bufferCache.clear();
        this.detachBrowserListeners();
        if (this.context && this.context.state !== 'closed') {
            void this.context.close();
        }
        this.context = null;
        this.masterGain = null;
        this.channelGains.clear();
        this.emit();
    };

    private async resumeContext(context: AudioContext) {
        try {
            if (context.state !== 'running') {
                await context.resume();
            }
        } catch {
            this.emit();
            return;
        }

        if (context.state === 'running') {
            this.hasUnlockedAudio = true;
            this.applyGains();
            this.drainQueuedEffects();
            this.startRequestedLoops();
        }
        this.emit();
    }

    private ensureContext() {
        if (this.context) {
            return this.context;
        }

        if (
            typeof window === 'undefined' ||
            typeof AudioContext === 'undefined'
        ) {
            return null;
        }

        const context = new AudioContext();
        this.context = context;
        this.masterGain = context.createGain();
        this.masterGain.connect(context.destination);

        for (const channel of channels) {
            const gain = context.createGain();
            gain.connect(this.masterGain);
            this.channelGains.set(channel, gain);
        }

        context.addEventListener('statechange', this.handleContextStateChange);
        this.applyGains();
        this.emit();
        return context;
    }

    private getChannelGain(channel: GameAudioChannelName) {
        const gain = this.channelGains.get(channel);
        if (gain) {
            return gain;
        }

        const context = this.ensureContext();
        if (!context || !this.masterGain) {
            throw new Error('Audio context is not available.');
        }

        const channelGain = context.createGain();
        channelGain.connect(this.masterGain);
        this.channelGains.set(channel, channelGain);
        this.applyGains();
        return channelGain;
    }

    private async loadBuffer(src: string) {
        const cached = this.bufferCache.get(src);
        if (cached) {
            return cached;
        }

        const context = this.ensureContext();
        if (!context) {
            throw new Error('Audio context is not available.');
        }

        const promise = fetch(src)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(
                        `Audio request failed with ${response.status}`,
                    );
                }
                return response.arrayBuffer();
            })
            .then((buffer) => context.decodeAudioData(buffer))
            .catch((error) => {
                this.bufferCache.delete(src);
                throw error;
            });

        this.bufferCache.set(src, promise);
        return promise;
    }

    private updateConfig(config: Partial<GameAudioConfig>) {
        this.config = {
            ...this.config,
            ...config,
            version: 2,
        };
        setAudioConfig(this.config);
        this.applyGains();
        this.emit();
    }

    private applyGains() {
        if (this.masterGain) {
            this.masterGain.gain.value = this.config.masterIsMuted
                ? 0
                : this.config.masterVolume;
        }

        for (const channel of channels) {
            const gain = this.channelGains.get(channel);
            if (!gain) {
                continue;
            }

            const state = this.getChannelState(channel);
            gain.gain.value = state.isMuted ? 0 : state.volume;
        }
    }

    private async startLoop(id: string) {
        const loop = this.loops.get(id);
        if (!loop?.isRequested || loop.source || !isPageVisible()) {
            return;
        }

        const context = this.ensureContext();
        if (!context || context.state === 'closed') {
            return;
        }

        if (context.state !== 'running') {
            await this.resume();
        }

        if (
            context.state !== 'running' ||
            !loop.isRequested ||
            this.startingLoops.has(id)
        ) {
            return;
        }

        this.startingLoops.add(id);
        try {
            const buffer = await this.loadBuffer(loop.src);
            if (
                context.state !== 'running' ||
                !isPageVisible() ||
                !loop.isRequested ||
                loop.source
            ) {
                return;
            }

            const source = context.createBufferSource();
            const gain = context.createGain();
            source.buffer = buffer;
            source.loop = loop.loop;
            gain.gain.value = loop.volume;
            source.connect(gain);
            gain.connect(this.getChannelGain(loop.channel));
            source.addEventListener('ended', () => {
                if (loop.source === source) {
                    source.disconnect();
                    gain.disconnect();
                    loop.source = null;
                    loop.gain = null;
                }
            });
            loop.source = source;
            loop.gain = gain;
            source.start();
        } catch (error) {
            console.warn('Failed to play looping audio', loop.src, error);
        } finally {
            this.startingLoops.delete(id);
        }
    }

    private stopLoopSource(loop: LoopRequest) {
        if (loop.source) {
            try {
                loop.source.stop();
            } catch {
                // Already stopped sources can throw in Web Audio.
            }
            loop.source.disconnect();
            loop.source = null;
        }

        if (loop.gain) {
            loop.gain.disconnect();
            loop.gain = null;
        }
    }

    private startRequestedLoops() {
        for (const loop of this.loops.values()) {
            if (loop.isRequested) {
                void this.startLoop(loop.id);
            }
        }
    }

    private queueEffect(effect: QueuedEffect) {
        this.queuedEffects.push(effect);
        while (this.queuedEffects.length > maxQueuedEffects) {
            this.queuedEffects.shift();
        }
    }

    private drainQueuedEffects() {
        if (!this.queuedEffects.length) {
            return;
        }

        const queued = this.queuedEffects.splice(0);
        for (const effect of queued) {
            void this.playOneShot(effect.channel, effect.src, {
                volume: effect.volume,
                queueWhenLocked: false,
            });
        }
    }

    private handleContextStateChange = () => {
        if (this.context?.state === 'running') {
            this.drainQueuedEffects();
            this.startRequestedLoops();
        }
        this.emit();
    };

    private handleUserActivation = () => {
        void this.resume({ userActivation: true });
    };

    private handlePageVisibility = () => {
        if (!isPageVisible()) {
            this.pauseForBackground();
            return;
        }

        if (this.hasUnlockedAudio) {
            void this.resume();
        } else {
            this.emit();
        }
    };

    private handlePageHide = () => {
        this.pauseForBackground();
    };

    private pauseForBackground() {
        for (const loop of this.loops.values()) {
            this.stopLoopSource(loop);
        }

        if (this.context?.state === 'running') {
            void this.context.suspend().finally(() => this.emit());
        } else {
            this.emit();
        }
    }

    private attachBrowserListeners() {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }

        for (const eventName of unlockEvents) {
            window.addEventListener(eventName, this.handleUserActivation, {
                passive: true,
            });
        }
        window.addEventListener('focus', this.handlePageVisibility);
        window.addEventListener('blur', this.handlePageVisibility);
        window.addEventListener('pageshow', this.handlePageVisibility);
        window.addEventListener('pagehide', this.handlePageHide);
        document.addEventListener(
            'visibilitychange',
            this.handlePageVisibility,
        );
    }

    private detachBrowserListeners() {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }

        for (const eventName of unlockEvents) {
            window.removeEventListener(eventName, this.handleUserActivation);
        }
        window.removeEventListener('focus', this.handlePageVisibility);
        window.removeEventListener('blur', this.handlePageVisibility);
        window.removeEventListener('pageshow', this.handlePageVisibility);
        window.removeEventListener('pagehide', this.handlePageHide);
        document.removeEventListener(
            'visibilitychange',
            this.handlePageVisibility,
        );

        this.context?.removeEventListener(
            'statechange',
            this.handleContextStateChange,
        );
    }

    private emit() {
        this.stateSnapshot = this.createStateSnapshot();
        for (const subscriber of this.subscribers) {
            subscriber();
        }
    }
}

export function createGameAudio(config: GameAudioConfig) {
    return new GameAudioManager(config);
}

export type GameAudio = ReturnType<typeof createGameAudio>;
