import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Container } from '@gredice/ui/Container';
import { AI } from '@gredice/ui/icons';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { WallpaperStudio } from './WallpaperStudio';

export const metadata: Metadata = {
    title: 'Pozadine iz tvog vrta',
    description:
        'Izradi pozadinu iz svog Gredice vrta za računalo, tablet ili mobitel, uz četiri doba dana i opcionalni Gredice logo.',
};

export default function WallpapersPage() {
    return (
        <Container maxWidth="lg">
            <Stack spacing={6}>
                <PageHeader
                    header="Pozadine iz tvog vrta"
                    subHeader="Odaberi vrt, doba dana i veličinu pa preuzmi pozadinu za računalo, tablet ili mobitel. Za Mac možeš preuzeti i dinamički paket."
                    padded
                />

                <WallpaperStudio />

                <Card variant="secondary">
                    <CardContent
                        noHeader
                        className="flex items-start gap-3 p-4"
                    >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <AI className="size-5" />
                        </span>
                        <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <Typography level="body1" bold>
                                    Nove kolekcije pozadina
                                </Typography>
                                <Chip size="sm" variant="outlined">
                                    Uskoro
                                </Chip>
                            </div>
                            <Typography level="body2" secondary>
                                Dodatni stilovi i ugođaji donijet će još više
                                načina da svoj vrt preneseš na svaki zaslon.
                            </Typography>
                        </div>
                    </CardContent>
                </Card>
            </Stack>
        </Container>
    );
}
