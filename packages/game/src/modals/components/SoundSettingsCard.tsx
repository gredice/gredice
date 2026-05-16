import { Alert } from '@signalco/ui/Alert';
import { Leaf, Play, Reset } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useGameAudio } from '../../hooks/useGameAudio';
import { SoundSlider } from './SoundSlider';

const DEFAULT_VOLUMES = {
    master: 0.5,
    ambient: 0.5,
    music: 0.5,
    effects: 0.5,
};

export function SoundSettingsCard() {
    const {
        isSuspended,
        resumeIfNeeded,
        isMuted: isMasterMuted,
        setMuted: setMasterMuted,
        volume: masterVolume,
        setVolume: setMasterVolume,
        ambient: {
            isMuted: ambientMuted,
            volume: ambientVolume,
            setMuted: setAmbientMuted,
            setVolume: setAmbientVolume,
        },
        music: {
            isMuted: musicMuted,
            volume: musicVolume,
            setMuted: setMusicMuted,
            setVolume: setMusicVolume,
        },
        effects: {
            isMuted: effectsMuted,
            volume: effectsVolume,
            setMuted: setEffectsMuted,
            setVolume: setEffectsVolume,
        },
    } = useGameAudio();

    function handleMasterVolumeChange(newVolume: number) {
        setMasterVolume(newVolume);
        setMasterMuted(newVolume === 0);
    }

    function handleChannelVolumeChange(
        newVolume: number,
        setVolume: (volume: number) => Promise<void>,
        setMuted: (muted: boolean) => Promise<void>,
    ) {
        setVolume(newVolume);
        if (newVolume > 0) {
            setMuted(false);
        }
    }

    function handleReset() {
        setMasterVolume(DEFAULT_VOLUMES.master);
        setAmbientVolume(DEFAULT_VOLUMES.ambient);
        setMusicVolume(DEFAULT_VOLUMES.music);
        setEffectsVolume(DEFAULT_VOLUMES.effects);
        setMasterMuted(false);
        setAmbientMuted(false);
        setMusicMuted(false);
        setEffectsMuted(false);
    }

    const masterOff = isMasterMuted || masterVolume === 0;

    return (
        <Card>
            <CardContent className="pt-6">
                <Stack spacing={6}>
                    {isSuspended && (
                        <Alert
                            color="success"
                            className="text-green-950 dark:text-green-50"
                            startDecorator={<Leaf />}
                            endDecorator={
                                <Button
                                    onClick={resumeIfNeeded}
                                    variant="soft"
                                    size="sm"
                                    className="!p-4"
                                    startDecorator={<Play className="size-5" />}
                                >
                                    Nastavi
                                </Button>
                            }
                        >
                            <Typography>
                                Zvuk je privremeno pauziran.
                            </Typography>
                        </Alert>
                    )}
                    <Stack spacing={4}>
                        <SoundSlider
                            value={Math.round(masterVolume * 100)}
                            muted={isMasterMuted}
                            onChange={(value) =>
                                handleMasterVolumeChange(value / 100)
                            }
                            onMuteToggle={() => setMasterMuted(!isMasterMuted)}
                            label="Glavno"
                        />
                        <SoundSlider
                            value={Math.round(ambientVolume * 100)}
                            muted={masterOff || ambientMuted}
                            onChange={(value) =>
                                handleChannelVolumeChange(
                                    value / 100,
                                    setAmbientVolume,
                                    setAmbientMuted,
                                )
                            }
                            onMuteToggle={() => setAmbientMuted(!ambientMuted)}
                            label="Ambientalno"
                        />
                        <SoundSlider
                            value={Math.round(musicVolume * 100)}
                            muted={masterOff || musicMuted}
                            onChange={(value) =>
                                handleChannelVolumeChange(
                                    value / 100,
                                    setMusicVolume,
                                    setMusicMuted,
                                )
                            }
                            onMuteToggle={() => setMusicMuted(!musicMuted)}
                            label="Glazba"
                        />
                        <SoundSlider
                            value={Math.round(effectsVolume * 100)}
                            muted={masterOff || effectsMuted}
                            onChange={(value) =>
                                handleChannelVolumeChange(
                                    value / 100,
                                    setEffectsVolume,
                                    setEffectsMuted,
                                )
                            }
                            onMuteToggle={() => setEffectsMuted(!effectsMuted)}
                            label="Efekti"
                        />
                    </Stack>
                    <Button
                        onClick={handleReset}
                        variant="outlined"
                        startDecorator={<Reset className="size-4" />}
                        size="sm"
                        className="self-end"
                    >
                        Vrati zadano
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    );
}
