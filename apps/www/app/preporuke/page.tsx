import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Preporuke',
    description: 'Program preporuka i pravila za dijeljenje koda preporuke.',
    keywords: [
        'Gredice',
        'program preporuka',
        'kod preporuke',
        'suncokreti',
        'nagrade',
    ],
};
export default function ReferralsLandingPage() {
    return (
        <main className="container py-10">
            <Stack spacing={3}>
                <Typography level="h2" component="h1">
                    💮 Gredice program preporuka
                </Typography>
                <Typography>
                    Podijeli svoj kod preporuke i zaradi{' '}
                    <strong>10.000 suncokreta</strong> kada novi račun ispuni
                    uvjet aktivne gredice.
                </Typography>
                <Typography>
                    Pravila: kod je vezan uz račun (ne korisnika), kod se može
                    mijenjati dok račun nema aktivnu gredicu, nakon prve aktivne
                    gredice kod se zaključava.
                </Typography>
                <Typography>
                    Nagrađivanje se obrađuje kada novi račun ima barem jednu
                    aktivnu gredicu. Broj dijeljenja koda preporuke nije
                    ograničen.
                </Typography>
            </Stack>
        </main>
    );
}
