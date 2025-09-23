import { Alert } from '@signalco/ui/Alert';
import { Leaf, Play, Reset } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useEffect, useRef } from 'react';
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

    // Track the previous mute states before master muting
    const previousAmbientMuted = useRef(ambientMuted);
    const previousSfxMuted = useRef(sfxMuted);
    const wasMasterMuted = useRef(isMasterMuted);

    const handleMasterVolumeChange = (newVolume: number) => {
        if (newVolume === masterVolume) return;

        setMasterVolume(newVolume);
        const newMuted = newVolume === 0;
        if (newMuted !== isMasterMuted) setMasterMuted(newMuted);
        console.debug('Master volume changed:', newVolume, 'muted:', newMuted);
    };

    const handleReset = () => {
        setMasterVolume(DEFAULT_VOLUMES.master);
        setSfxVolume(DEFAULT_VOLUMES.sfx);
        setAmbientVolume(DEFAULT_VOLUMES.ambient);
        setMasterMuted(false);
        setSfxMuted(false);
        setAmbientMuted(false);

        // Reset stored states
        previousAmbientMuted.current = false;
        previousSfxMuted.current = false;
        wasMasterMuted.current = false;

        console.debug('Sound settings reset to defaults');
    };

    function handleAmbientSetMuted(newMuted: boolean) {
        if (!newMuted && ambientVolume === 0) {
            setAmbientVolume(DEFAULT_VOLUMES.ambient);
        }
        setAmbientMuted(newMuted);

        // Update stored state if master is not muted (so we remember user's choice)
        if (!isMasterMuted && masterVolume > 0) {
            previousAmbientMuted.current = newMuted;
        }

        console.debug('Ambient muted state changed:', newMuted);
    }

    function handleSfxSetMuted(newMuted: boolean) {
        if (!newMuted && sfxVolume === 0) {
            setSfxVolume(DEFAULT_VOLUMES.sfx);
        }
        setSfxMuted(newMuted);

        // Update stored state if master is not muted (so we remember user's choice)
        if (!isMasterMuted && masterVolume > 0) {
            previousSfxMuted.current = newMuted;
        }

        console.debug('SFX muted state changed:', newMuted);
    }

    useEffect(() => {
        const isMasterCurrentlyMuted = isMasterMuted || masterVolume === 0;

        console.debug('useEffect triggered:', {
            wasMasterMuted: wasMasterMuted.current,
            isMasterCurrentlyMuted,
            isMasterMuted,
            masterVolume,
            ambientMuted,
            sfxMuted,
            previousAmbientMuted: previousAmbientMuted.current,
            previousSfxMuted: previousSfxMuted.current,
        });

        // Store previous states when transitioning from unmuted to muted
        if (!wasMasterMuted.current && isMasterCurrentlyMuted) {
            console.debug(
                'Master became muted/zero - storing previous sub-mixer states',
                { ambientMuted, sfxMuted },
            );
            previousAmbientMuted.current = ambientMuted;
            previousSfxMuted.current = sfxMuted;

            // Mute all sub-mixers
            console.debug('Muting sub-mixers due to master mute');
            setSfxMuted(true);
            setAmbientMuted(true);
        }
        // Restore previous states when transitioning from muted to unmuted
        else if (wasMasterMuted.current && !isMasterCurrentlyMuted) {
            console.debug(
                'Master became unmuted - restoring previous sub-mixer states',
                {
                    previousAmbientMuted: previousAmbientMuted.current,
                    previousSfxMuted: previousSfxMuted.current,
                },
            );

            // Use setTimeout to ensure this runs after any other state updates
            setTimeout(() => {
                setSfxMuted(previousSfxMuted.current);
                setAmbientMuted(previousAmbientMuted.current);
                console.debug('Sub-mixer states restored');
            }, 0);
        }

        // Update the previous master muted state
        wasMasterMuted.current = isMasterCurrentlyMuted;
    }, [
        isMasterMuted,
        masterVolume,
        ambientMuted,
        sfxMuted,
        setAmbientMuted,
        setSfxMuted,
    ]);

    console.debug(
        'SoundSettingsCard render',
        isMasterMuted,
        masterVolume,
        ambientMuted,
        ambientVolume,
        sfxMuted,
        sfxVolume,
    );

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
