import { getPublicHarvestTraceGroupByToken } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { createPublicMetadata } from '../../../../lib/seo/publicMetadata';
import { HarvestTraceGroup } from './HarvestTraceGroup';

export const dynamic = 'force-dynamic';
export const metadata = createPublicMetadata({
    title: 'Trag grupe berbe',
    description: 'Odaberi polje za detalje berbe Gredice.',
    robots: { index: false, follow: false },
});

export default async function HarvestTraceGroupPage(
    props: PageProps<'/trag/grupa/[token]'>,
) {
    const { token } = await props.params;
    const group = await getPublicHarvestTraceGroupByToken(token);
    if (!group) {
        return (
            <Stack spacing={4} className="mx-auto max-w-2xl py-8 sm:py-12">
                <Typography level="h1">Trag berbe nije dostupan</Typography>
                <Typography>
                    Poveznica nije važeća ili su tragovi berbe opozvani.
                </Typography>
                <Button href="/" variant="solid">
                    Na početnu
                </Button>
            </Stack>
        );
    }
    return <HarvestTraceGroup group={group} />;
}
