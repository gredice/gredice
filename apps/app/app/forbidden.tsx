import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Lock, LogOut } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { KnownPages } from '../src/KnownPages';

export default function ForbiddenPage() {
    return (
        <div className="grow bg-secondary/40">
            <main className="flex min-h-screen items-center justify-center p-4">
                <section className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
                    <Stack spacing={5}>
                        <Stack spacing={2} alignItems="center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full border bg-muted">
                                <Lock className="h-5 w-5" aria-hidden />
                            </span>
                            <Typography level="h4" component="h1" center>
                                Pristup nije dozvoljen
                            </Typography>
                            <Typography secondary center>
                                Nemate ovlasti za otvaranje ove stranice.
                            </Typography>
                        </Stack>
                        <Alert color="warning">
                            Prijavite se s korisnikom koji ima odgovarajuću
                            ulogu.
                        </Alert>
                        <Button
                            href={KnownPages.Logout}
                            variant="solid"
                            color="neutral"
                            fullWidth
                            startDecorator={<LogOut className="h-4 w-4" />}
                        >
                            Odjava
                        </Button>
                    </Stack>
                </section>
            </main>
        </div>
    );
}
