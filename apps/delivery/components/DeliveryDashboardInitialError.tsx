import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { LoaderSpinner, Reset, Warning } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';

export function DeliveryDashboardInitialError({
    message,
    retrying,
    retryUnavailableMessage = null,
    onRetry,
}: {
    message: string;
    retrying: boolean;
    retryUnavailableMessage?: string | null;
    onRetry: () => void | Promise<void>;
}) {
    return (
        <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardContent noHeader className="space-y-4 p-6 text-center">
                    <div aria-atomic="true" role="alert">
                        <Warning className="mx-auto size-9 text-warning" />
                        <Typography className="mt-4" level="h3" semiBold>
                            Dostave nisu dostupne
                        </Typography>
                        <Typography className="mt-4 text-muted-foreground">
                            {message}
                        </Typography>
                    </div>
                    <Button
                        aria-busy={retrying}
                        aria-label={
                            retryUnavailableMessage
                                ? 'Pokušaj ponovno nije dostupan bez internetske veze'
                                : 'Pokušaj ponovno'
                        }
                        className="min-h-11"
                        disabled={retrying || Boolean(retryUnavailableMessage)}
                        startDecorator={
                            retrying ? (
                                <LoaderSpinner className="size-4 animate-spin" />
                            ) : (
                                <Reset className="size-4" />
                            )
                        }
                        onClick={() => void onRetry()}
                    >
                        {retryUnavailableMessage
                            ? 'Čeka se internetska veza'
                            : retrying
                              ? 'Pokušaj u tijeku…'
                              : 'Pokušaj ponovno'}
                    </Button>
                    {retryUnavailableMessage ? (
                        <Typography
                            className="text-muted-foreground"
                            level="body3"
                        >
                            {retryUnavailableMessage}
                        </Typography>
                    ) : null}
                    {retrying ? (
                        <span
                            aria-atomic="true"
                            aria-live="polite"
                            className="sr-only"
                            role="status"
                        >
                            Ponovno učitavanje dostava je u tijeku.
                        </span>
                    ) : null}
                </CardContent>
            </Card>
        </main>
    );
}
