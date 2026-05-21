import { Card, CardContent } from '@gredice/ui/Card';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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
