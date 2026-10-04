import { Card, CardContent } from '@gredice/ui/Card';
import { Checkbox } from '@gredice/ui/Checkbox';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Slider } from '@gredice/ui/Slider';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    type GameCloudShadowMode,
    type GameQualityCustomProfile,
    type GameQualitySetting,
    isGameQualitySetting,
} from '../../scene/gameQuality';
import { useGameState } from '../../useGameState';

type ShadowMapSizeOption = '1024' | '2048' | '4096';

const qualityOptions = [
    { label: 'Automatski', value: 'auto' },
    { label: 'Niska', value: 'low' },
    { label: 'Srednja', value: 'medium' },
    { label: 'Visoka', value: 'high' },
    { label: 'Prilagođeno', value: 'custom' },
] satisfies Array<{ label: string; value: GameQualitySetting }>;

const qualityDescriptions = {
    auto: 'Prilagođava detalje, sjene i efekte mogućnostima uređaja.',
    low: 'Smanjuje detalje, sjene i efekte za stabilniji prikaz.',
    medium: 'Uravnotežuje detalje i performanse.',
    high: 'Prikazuje najviše detalja, sjene i efekte.',
    custom: 'Koristi ručno odabrane detalje, sjene i efekte.',
} satisfies Record<GameQualitySetting, string>;

const cloudShadowModeOptions = [
    { label: 'Oštre', value: 'hard' },
    { label: 'Mekane', value: 'soft' },
] satisfies Array<{ label: string; value: GameCloudShadowMode }>;

const shadowMapSizeOptions = [
    { label: '1024 px', value: '1024' },
    { label: '2048 px', value: '2048' },
    { label: '4096 px', value: '4096' },
] satisfies Array<{ label: string; value: ShadowMapSizeOption }>;

function formatDpr(value: number) {
    return `${value.toFixed(value % 1 === 0 ? 0 : 2)}x`;
}

function formatPercent(value: number) {
    return `${Math.round(value * 100)}%`;
}

function shadowMapSizeOption(value: number): ShadowMapSizeOption {
    switch (value) {
        case 1024:
            return '1024';
        case 4096:
            return '4096';
        default:
            return '2048';
    }
}

function parseShadowMapSizeOption(value: ShadowMapSizeOption) {
    switch (value) {
        case '1024':
            return 1024;
        case '4096':
            return 4096;
        default:
            return 2048;
    }
}

export function QualitySettingsCard() {
    const gameQualitySetting = useGameState(
        (state) => state.gameQualitySetting,
    );
    const setGameQualitySetting = useGameState(
        (state) => state.setGameQualitySetting,
    );
    const customQualityProfile = useGameState(
        (state) => state.gameQualityCustomProfile,
    );
    const setGameQualityCustomProfile = useGameState(
        (state) => state.setGameQualityCustomProfile,
    );

    const handleQualityChange = (value: string) => {
        if (isGameQualitySetting(value)) {
            setGameQualitySetting(value);
        }
    };

    const updateCustomProfile = (
        updates: Partial<GameQualityCustomProfile>,
    ) => {
        setGameQualityCustomProfile({
            ...customQualityProfile,
            ...updates,
        });
    };

    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={4}>
                    <SelectItems
                        label="Kvaliteta prikaza"
                        value={gameQualitySetting}
                        onValueChange={handleQualityChange}
                        items={qualityOptions}
                    />
                    <Typography level="body3" secondary>
                        {qualityDescriptions[gameQualitySetting]}
                    </Typography>
                    {gameQualitySetting === 'custom' && (
                        <Stack className="border-t pt-4" spacing={4}>
                            <Typography level="body2" component="div" semiBold>
                                Napredne postavke
                            </Typography>
                            <Stack spacing={4}>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <Typography
                                            level="body3"
                                            component="span"
                                        >
                                            Oštrina prikaza
                                        </Typography>
                                        <Typography
                                            className="shrink-0 tabular-nums"
                                            level="body3"
                                            component="span"
                                            mono
                                            secondary
                                        >
                                            {formatDpr(
                                                customQualityProfile.dpr,
                                            )}
                                        </Typography>
                                    </div>
                                    <Slider
                                        aria-label="Oštrina prikaza"
                                        value={[customQualityProfile.dpr]}
                                        min={1}
                                        max={3}
                                        step={0.25}
                                        onValueChange={(value) =>
                                            updateCustomProfile({
                                                dpr:
                                                    value[0] ??
                                                    customQualityProfile.dpr,
                                            })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <Typography
                                            level="body3"
                                            component="span"
                                        >
                                            Dekoracije tla
                                        </Typography>
                                        <Typography
                                            className="shrink-0 tabular-nums"
                                            level="body3"
                                            component="span"
                                            mono
                                            secondary
                                        >
                                            {formatPercent(
                                                customQualityProfile.groundDecorationDensity,
                                            )}
                                        </Typography>
                                    </div>
                                    <Slider
                                        aria-label="Dekoracije tla"
                                        value={[
                                            customQualityProfile.groundDecorationDensity,
                                        ]}
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        onValueChange={(value) =>
                                            updateCustomProfile({
                                                groundDecorationDensity:
                                                    value[0] ??
                                                    customQualityProfile.groundDecorationDensity,
                                            })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <Typography
                                            level="body3"
                                            component="span"
                                        >
                                            Kišne čestice
                                        </Typography>
                                        <Typography
                                            className="shrink-0 tabular-nums"
                                            level="body3"
                                            component="span"
                                            mono
                                            secondary
                                        >
                                            {formatPercent(
                                                customQualityProfile.rainParticleMultiplier,
                                            )}
                                        </Typography>
                                    </div>
                                    <Slider
                                        aria-label="Kišne čestice"
                                        value={[
                                            customQualityProfile.rainParticleMultiplier,
                                        ]}
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        onValueChange={(value) =>
                                            updateCustomProfile({
                                                rainParticleMultiplier:
                                                    value[0] ??
                                                    customQualityProfile.rainParticleMultiplier,
                                            })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <Typography
                                            level="body3"
                                            component="span"
                                        >
                                            Snježne čestice
                                        </Typography>
                                        <Typography
                                            className="shrink-0 tabular-nums"
                                            level="body3"
                                            component="span"
                                            mono
                                            secondary
                                        >
                                            {formatPercent(
                                                customQualityProfile.snowParticleMultiplier,
                                            )}
                                        </Typography>
                                    </div>
                                    <Slider
                                        aria-label="Snježne čestice"
                                        value={[
                                            customQualityProfile.snowParticleMultiplier,
                                        ]}
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        onValueChange={(value) =>
                                            updateCustomProfile({
                                                snowParticleMultiplier:
                                                    value[0] ??
                                                    customQualityProfile.snowParticleMultiplier,
                                            })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <Typography
                                            level="body3"
                                            component="span"
                                        >
                                            Snježni prekrivač
                                        </Typography>
                                        <Typography
                                            className="shrink-0 tabular-nums"
                                            level="body3"
                                            component="span"
                                            mono
                                            secondary
                                        >
                                            {formatPercent(
                                                customQualityProfile.snowOverlayMinCoverage,
                                            )}
                                        </Typography>
                                    </div>
                                    <Slider
                                        aria-label="Snježni prekrivač"
                                        value={[
                                            customQualityProfile.snowOverlayMinCoverage,
                                        ]}
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        onValueChange={(value) =>
                                            updateCustomProfile({
                                                snowOverlayMinCoverage:
                                                    value[0] ??
                                                    customQualityProfile.snowOverlayMinCoverage,
                                            })
                                        }
                                    />
                                </div>
                            </Stack>
                            <Stack spacing={3}>
                                <Checkbox
                                    label="Sjene"
                                    checked={customQualityProfile.shadows}
                                    onCheckedChange={(checked: boolean) =>
                                        updateCustomProfile({
                                            shadows: checked,
                                        })
                                    }
                                />
                                <SelectItems
                                    label="Rezolucija sjena"
                                    value={shadowMapSizeOption(
                                        customQualityProfile.shadowMapSize,
                                    )}
                                    disabled={!customQualityProfile.shadows}
                                    onValueChange={(value) =>
                                        updateCustomProfile({
                                            shadowMapSize:
                                                parseShadowMapSizeOption(value),
                                        })
                                    }
                                    items={shadowMapSizeOptions}
                                />
                                <SelectItems
                                    label="Sjene oblaka"
                                    value={customQualityProfile.cloudShadowMode}
                                    disabled={!customQualityProfile.shadows}
                                    onValueChange={(value) =>
                                        updateCustomProfile({
                                            cloudShadowMode: value,
                                        })
                                    }
                                    items={cloudShadowModeOptions}
                                />
                            </Stack>
                        </Stack>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}
