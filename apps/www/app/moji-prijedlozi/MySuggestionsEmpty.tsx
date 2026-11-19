import { Button } from '@gredice/ui/Button';
import { GameJournalIcon } from '@gredice/ui/GameIcons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { Card } from '../../components/shared/Card';
import { PublicEmptyState } from '../../components/shared/placeholders/PublicEmptyState';
import { KnownPages } from '../../src/KnownPages';

/** Shown when the signed-in visitor has not sent a suggestion yet. */
export function MySuggestionsEmpty() {
    return (
        <Card className="p-4">
            <Stack spacing={3} className="items-center text-center">
                <PublicEmptyState icon={GameJournalIcon}>
                    Još nema poslanih prijedloga.
                </PublicEmptyState>
                <Typography level="body2" className="max-w-prose">
                    Na stranicama biljaka, sorti, radnji, bolesti i štetnika
                    odaberi „Predloži izmjenu” ili karticu za novi prijedlog.
                    Pregledamo svaki prijedlog prije objave i javimo ti ishod.
                </Typography>
                <Button href={KnownPages.Plants} variant="outlined">
                    Pregledaj biljke
                </Button>
            </Stack>
        </Card>
    );
}
