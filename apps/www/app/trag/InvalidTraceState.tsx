import { Button } from '@gredice/ui/Button';
import { LinkOff } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { Card } from '../../components/shared/Card';

/** Shown when a harvest trace link (single field or group) cannot be opened. */
export function InvalidTraceState({
    description = 'Poveznica nije važeća, istekla je ili opozvana. Provjeri etiketu ili nam se javi ako trebaš pomoć.',
}: {
    description?: string;
}) {
    return (
        <Stack spacing={6} className="mx-auto max-w-2xl py-8 sm:py-12">
            <Card className="p-6 sm:p-8">
                <Stack spacing={5} alignItems="center" className="text-center">
                    <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <LinkOff aria-hidden className="size-7" />
                    </span>
                    <Stack spacing={2}>
                        <Typography level="h1">
                            Trag berbe nije dostupan
                        </Typography>
                        <Typography className="text-muted-foreground">
                            {description}
                        </Typography>
                    </Stack>
                    <Button href="/" variant="solid">
                        Na početnu
                    </Button>
                </Stack>
            </Card>
        </Stack>
    );
}
