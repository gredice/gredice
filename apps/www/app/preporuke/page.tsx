import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Preporuke',
    description: 'Referral program i pravila dijeljenja referral kodova.',
};

export default function ReferralsLandingPage() {
    return (
        <main className="container py-10">
            <Stack spacing={3}>
                <Typography level="h2">💮 Gredice referral program</Typography>
                <Typography>
                    Podijeli svoj referral kod i zaradi{' '}
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
                    aktivnu gredicu. Broj dijeljenja referral koda nije
                    ograničen.
                </Typography>
            </Stack>
        </main>
    );
}
