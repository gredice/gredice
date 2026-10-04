import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { createPublicMetadata } from '../../lib/seo/publicMetadata';

export const metadata = createPublicMetadata({
    title: 'Legalno',
    description: 'Pravni dokumenti i informacije.',
    path: '/legalno',
    eyebrow: 'Pravne informacije',
});

export default function LegalnoPage() {
    return (
        <Container maxWidth="sm">
            <Stack className="pb-24" spacing={2}>
                <PageHeader padded header="Legalno" />
                <Typography>
                    Ovdje se nalaze svi dokumenti koji ti mogu biti korisni.
                </Typography>
                <Typography>
                    Odaberi jedan od lijevo navedenih dokumenata za više
                    detalja.
                </Typography>
            </Stack>
        </Container>
    );
}
