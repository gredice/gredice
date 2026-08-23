import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Container } from '@gredice/ui/Container';
import { AI } from '@gredice/ui/icons';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Logotype } from '@gredice/ui/PublicChrome';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { WallpaperStudio } from './WallpaperStudio';

export const metadata: Metadata = {
    title: 'Pozadine iz tvog vrta',
    description:
        'Besplatno izradi 4K ili ultrawide pozadinu iz svog Gredice vrta, s minimalnim ili standardnim prikazom i četiri doba dana.',
};

export default function WallpapersPage() {
    return (
        <Container maxWidth="lg">
            <Stack spacing={6}>
                <PageHeader
                    header="Pozadine iz tvog vrta"
                    subHeader="Odaberi vrt, izgled i doba dana pa preuzmi čistu ili potpisanu PNG pozadinu za macOS, Windows ili Linux. Osnovni predlošci su besplatni."
                    padded
                    visual={
                        <div className="flex size-full items-center justify-center bg-[linear-gradient(145deg,#f4f7ee,#dcebd2)] p-5">
                            <Logotype className="w-full text-primary" />
                        </div>
                    }
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
                                    Autorske kolekcije više kvalitete
                                </Typography>
                                <Chip size="sm" variant="outlined">
                                    Kasnije
                                </Chip>
                            </div>
                            <Typography level="body2" secondary>
                                AI-generirane scene bit će zasebna plaćena
                                opcija. AI neće dobiti sliku ni podatke tvog
                                vrta; tvoj vrt i dalje renderira Gredice.
                            </Typography>
                        </div>
                    </CardContent>
                </Card>
            </Stack>
        </Container>
    );
}
