import { getNewsletterAudienceSummary } from '@gredice/storage';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { NewsletterForm } from './NewsletterForm';

export default async function NewsletterPage() {
    const audience = await getNewsletterAudienceSummary();

    return (
        <Stack spacing={2}>
            <Typography level="h1" className="text-2xl" semiBold>
                Newsletter
            </Typography>
            <Typography
                level="body2"
                className="text-muted-foreground max-w-2xl"
            >
                Pošalji novosti svim pretplatnicima newslettera i korisnicima
                koji su se odlučili primati obavijesti.
            </Typography>
            <NewsletterForm audience={audience} />
        </Stack>
    );
}
