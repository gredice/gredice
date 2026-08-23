import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Typography } from '@gredice/ui/Typography';
import { createPublicMetadata } from '../../../lib/seo/publicMetadata';
import { KnownPages } from '../../../src/KnownPages';

export const metadata = createPublicMetadata({
    title: 'Licenca izvornog koda',
    description: 'Uvjeti korištenja izvornog koda aplikacije Gredice.',
    path: KnownPages.LegalLicense,
    eyebrow: 'Pravni dokument',
});

export default function PolitikaPrivatnostiPage() {
    return (
        <Container maxWidth="sm">
            <Stack>
                <PageHeader
                    padded
                    header="Licenca izvornog koda"
                    subHeader="Uvjeti korištenja izvornog koda aplikacije Gredice."
                />
                <StyledHtml>
                    <p>
                        Izvorni kod aplikacije Gredice dostupan je pod licencom{' '}
                        <a href="https://github.com/gredice/gredice/blob/main/LICENSE">
                            AGPL-3.0
                        </a>
                        . To znači da je dopušteno pregledati, preuzeti,
                        mijenjati i distribuirati izvorni kod aplikacije pod
                        uvjetima ove licence.
                    </p>
                    <p>
                        Izvorni kod dostupan je na{' '}
                        <a href="https://github.com/gredice/gredice">GitHub</a>{' '}
                        repozitoriju.
                    </p>
                    <p>
                        Ako imaš bilo kakvih pitanja o licenci ili korištenju
                        izvornog koda, slobodno nas kontaktiraj na{' '}
                        <a href="mailto:kontakt@gredice.com">
                            kontakt@gredice.com
                        </a>
                        .
                    </p>
                </StyledHtml>
                <Typography level="body2" secondary className="mt-8">
                    Zadnja izmjena: 20. Studeni 2024.
                </Typography>
            </Stack>
        </Container>
    );
}
