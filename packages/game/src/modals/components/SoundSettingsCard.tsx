import { Alert } from '@signalco/ui/Alert';
import { Leaf, Play, Reset } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useEffect } from 'react';
import { useGameAudio } from '../../hooks/useGameAudio';
import { SoundSlider } from './SoundSlider';

const DEFAULT_VOLUMES = {
    master: 0.5,
    ambient: 0.5,
    sfx: 0.5,
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
        effects: {
            isMuted: sfxMuted,
            volume: sfxVolume,
            setMuted: setSfxMuted,
            setVolume: setSfxVolume,
        },
    } = useGameAudio();

    const handleMasterVolumeChange = (newVolume: number) => {
        if (newVolume === masterVolume) return;

        setMasterVolume(newVolume);
        const newMuted = newVolume === 0;
        if (newMuted !== isMasterMuted) setMasterMuted(newMuted);
    };

    const handleReset = () => {
        setMasterVolume(DEFAULT_VOLUMES.master);
        setSfxVolume(DEFAULT_VOLUMES.sfx);
        setAmbientVolume(DEFAULT_VOLUMES.ambient);
        setMasterMuted(false);
        setSfxMuted(false);
        setAmbientMuted(false);
    };

    function handleAmbientSetMuted(newMuted: boolean) {
        if (!newMuted && ambientVolume === 0) {
            setAmbientVolume(DEFAULT_VOLUMES.ambient);
        }
        setAmbientMuted(newMuted);
    }

    function handleSfxSetMuted(newMuted: boolean) {
        if (!newMuted && sfxVolume === 0) {
            setSfxVolume(DEFAULT_VOLUMES.sfx);
        }
        setSfxMuted(newMuted);
    }

    useEffect(() => {
        if (isMasterMuted || masterVolume === 0) {
            setSfxMuted(true);
            setAmbientMuted(true);
        } else {
            setSfxMuted(false);
            setAmbientMuted(false);
        }
    }, [isMasterMuted, masterVolume, setAmbientMuted, setSfxMuted]);

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
                                Zvuk je privremeno isključen jer tvoj uređaj
                                štedi energiju.
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
                            muted={
                                isMasterMuted ||
                                masterVolume === 0 ||
                                ambientMuted
                            }
                            onChange={(value) => setAmbientVolume(value / 100)}
                            onMuteToggle={() =>
                                handleAmbientSetMuted(!ambientMuted)
                            }
                            label="Ambientalno"
                        />
                        <SoundSlider
                            value={Math.round(sfxVolume * 100)}
                            muted={
                                isMasterMuted || masterVolume === 0 || sfxMuted
                            }
                            onChange={(value) => setSfxVolume(value / 100)}
                            onMuteToggle={() => handleSfxSetMuted(!sfxMuted)}
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
