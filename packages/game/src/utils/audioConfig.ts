type audioConfigData = {
    masterVolume?: number;
    masterIsMuted?: boolean;
    ambientVolume?: number;
    ambientIsMuted?: boolean;
    effectsVolume?: number;
    effectsIsMuted?: boolean;
};

export function audioConfig() {
    const stored = JSON.parse(
        localStorage.getItem('sound') ?? '{}',
    ) as audioConfigData;
    const config = {
        masterVolume: stored.masterVolume || 0.5,
        masterIsMuted: stored.masterIsMuted || false,
        ambientVolume: stored.ambientVolume || 0.25,
        ambientIsMuted: stored.ambientIsMuted || false,
        effectsVolume: stored.effectsVolume || 0.25,
        effectsIsMuted: stored.effectsIsMuted || false,
    };

    return {
        config,
        setConfig: (newConfig: audioConfigData) => {
            const merged = { ...config, ...newConfig };
            localStorage.setItem('sound', JSON.stringify(merged));
        },
    };
}
