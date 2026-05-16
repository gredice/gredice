export type GameAudioChannelName = 'ambient' | 'effects' | 'music';

export type GameAudioConfig = {
    version: 2;
    masterVolume: number;
    masterIsMuted: boolean;
    ambientVolume: number;
    ambientIsMuted: boolean;
    effectsVolume: number;
    effectsIsMuted: boolean;
    musicVolume: number;
    musicIsMuted: boolean;
};

export const DEFAULT_AUDIO_CONFIG: GameAudioConfig = {
    version: 2,
    masterVolume: 0.5,
    masterIsMuted: false,
    ambientVolume: 0.5,
    ambientIsMuted: false,
    effectsVolume: 0.5,
    effectsIsMuted: false,
    musicVolume: 0.5,
    musicIsMuted: false,
};

const AUDIO_CONFIG_STORAGE_KEY = 'sound';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function clampVolume(value: number) {
    return Math.min(1, Math.max(0, value));
}

function readVolume(
    source: Record<string, unknown>,
    key: keyof GameAudioConfig,
    fallback: number,
) {
    const value = source[key];
    return typeof value === 'number' && Number.isFinite(value)
        ? clampVolume(value)
        : fallback;
}

function readBoolean(
    source: Record<string, unknown>,
    key: keyof GameAudioConfig,
    fallback: boolean,
) {
    const value = source[key];
    return typeof value === 'boolean' ? value : fallback;
}

function readLegacyChannelVolume(
    source: Record<string, unknown>,
    key: keyof GameAudioConfig,
    masterVolume: number,
    fallback: number,
) {
    const value = source[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return clampVolume(masterVolume > 0 ? value / masterVolume : value);
}

function readStoredConfig() {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const stored = window.localStorage.getItem(AUDIO_CONFIG_STORAGE_KEY);
        if (!stored) {
            return null;
        }

        const parsed: unknown = JSON.parse(stored);
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function getAudioConfig(): GameAudioConfig {
    const stored = readStoredConfig();
    if (!stored) {
        return DEFAULT_AUDIO_CONFIG;
    }

    const masterVolume = readVolume(
        stored,
        'masterVolume',
        DEFAULT_AUDIO_CONFIG.masterVolume,
    );
    const version = stored.version;
    const isCurrentVersion = version === DEFAULT_AUDIO_CONFIG.version;

    return {
        version: DEFAULT_AUDIO_CONFIG.version,
        masterVolume,
        masterIsMuted: readBoolean(
            stored,
            'masterIsMuted',
            DEFAULT_AUDIO_CONFIG.masterIsMuted,
        ),
        ambientVolume: isCurrentVersion
            ? readVolume(
                  stored,
                  'ambientVolume',
                  DEFAULT_AUDIO_CONFIG.ambientVolume,
              )
            : readLegacyChannelVolume(
                  stored,
                  'ambientVolume',
                  masterVolume,
                  DEFAULT_AUDIO_CONFIG.ambientVolume,
              ),
        ambientIsMuted: readBoolean(
            stored,
            'ambientIsMuted',
            DEFAULT_AUDIO_CONFIG.ambientIsMuted,
        ),
        effectsVolume: isCurrentVersion
            ? readVolume(
                  stored,
                  'effectsVolume',
                  DEFAULT_AUDIO_CONFIG.effectsVolume,
              )
            : readLegacyChannelVolume(
                  stored,
                  'effectsVolume',
                  masterVolume,
                  DEFAULT_AUDIO_CONFIG.effectsVolume,
              ),
        effectsIsMuted: readBoolean(
            stored,
            'effectsIsMuted',
            DEFAULT_AUDIO_CONFIG.effectsIsMuted,
        ),
        musicVolume: readVolume(
            stored,
            'musicVolume',
            DEFAULT_AUDIO_CONFIG.musicVolume,
        ),
        musicIsMuted: readBoolean(
            stored,
            'musicIsMuted',
            DEFAULT_AUDIO_CONFIG.musicIsMuted,
        ),
    };
}

export function setAudioConfig(config: GameAudioConfig) {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(
            AUDIO_CONFIG_STORAGE_KEY,
            JSON.stringify(config),
        );
    } catch {
        // Audio settings are optional; private browsing storage failures should
        // not break the game.
    }
}

export function audioConfig() {
    const config = getAudioConfig();

    return {
        config,
        setConfig: (newConfig: Partial<GameAudioConfig>) => {
            setAudioConfig({
                ...getAudioConfig(),
                ...newConfig,
                version: DEFAULT_AUDIO_CONFIG.version,
            });
        },
    };
}
