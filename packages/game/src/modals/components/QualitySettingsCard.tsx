import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import {
    type GameQualitySetting,
    isGameQualitySetting,
} from '../../scene/gameQuality';
import { useGameState } from '../../useGameState';

const qualityOptions = [
    { label: 'Automatski', value: 'auto' },
    { label: 'Niska', value: 'low' },
    { label: 'Srednja', value: 'medium' },
    { label: 'Visoka', value: 'high' },
] satisfies Array<{ label: string; value: GameQualitySetting }>;

const qualityDescriptions = {
    auto: 'Prilagođava detalje, sjene i efekte mogućnostima uređaja.',
    low: 'Smanjuje detalje, sjene i efekte za stabilniji prikaz.',
    medium: 'Uravnotežuje detalje i performanse.',
    high: 'Prikazuje najviše detalja, sjene i efekte.',
} satisfies Record<GameQualitySetting, string>;

export function QualitySettingsCard() {
    const gameQualitySetting = useGameState(
        (state) => state.gameQualitySetting,
    );
    const setGameQualitySetting = useGameState(
        (state) => state.setGameQualitySetting,
    );

    const handleQualityChange = (value: string) => {
        if (isGameQualitySetting(value)) {
            setGameQualitySetting(value);
        }
    };

    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={2}>
                    <SelectItems
                        label="Kvaliteta prikaza"
                        value={gameQualitySetting}
                        onValueChange={handleQualityChange}
                        items={qualityOptions}
                    />
                    <Typography level="body3" secondary>
                        {qualityDescriptions[gameQualitySetting]}
                    </Typography>
                </Stack>
            </CardContent>
        </Card>
    );
}
