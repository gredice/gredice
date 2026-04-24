import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '../../components/shared/PageHeader';
import { KnownPages } from '../../src/KnownPages';

export const metadata: Metadata = {
    title: 'Povrat novca',
    description:
        'Informacije o 30-dnevnoj politici povrata novca za biljke, sorte i radnje na tržištu Hrvatske.',
};

export default function RefundsPage() {
    return (
        <Stack spacing={3} className="py-8">
            <PageHeader
                header="Povrat novca"
                subHeader="Ako nisi zadovoljan uslugom ili proizvodom, možeš zatražiti povrat novca u roku od 30 dana."
            />

            <Card>
                <CardHeader>
                    <CardTitle>Naša politika</CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={1}>
                        <Typography>
                            Za biljke, sorte i radnje nudimo{' '}
                            <strong>30 dana</strong> za zahtjev povrata novca od
                            trenutka kupovine.
                        </Typography>
                        <Typography>
                            Kako se radi o uslugama i digitalno vođenim
                            procesima, klasičan fizički povrat robe nije
                            primjenjiv. Umjesto povrata robe, odobravamo:
                        </Typography>
                        <ul className="list-disc pl-6">
                            <li>
                                <Typography>puni povrat novca, ili</Typography>
                            </li>
                            <li>
                                <Typography>
                                    kredit na korisničkom računu (store credit),
                                    prema dogovoru sa podrškom.
                                </Typography>
                            </li>
                        </ul>
                    </Stack>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Kako zatražiti povrat</CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={1}>
                        <Typography>
                            Javi se našoj podršci i opiši razlog nezadovoljstva.
                            Nakon provjere zahtjeva predložit ćemo puni povrat
                            novca ili kredit.
                        </Typography>
                        <Typography>
                            Kontakt stranicu možeš otvoriti ovdje:{' '}
                            <Link
                                className="underline"
                                href={KnownPages.Contact}
                            >
                                Kontakt
                            </Link>
                            .
                        </Typography>
                    </Stack>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Važno</CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={1}>
                        <Typography>
                            Trenutno je ova politika dostupna samo za narudžbe
                            na tržištu Hrvatske (HR).
                        </Typography>
                        <Typography>
                            Za ovu vrstu ponude nema povratne dostave niti
                            return feed procesa.
                        </Typography>
                        <Typography>
                            Povrat je moguć isključivo kroz korisničku podršku i
                            odobrenje povrata novca/kredita.
                        </Typography>
                    </Stack>
                </CardContent>
            </Card>

            <Typography level="body2" secondary>
                Cijene i povezane informacije možeš provjeriti na stranici{' '}
                <Link className="underline" href={KnownPages.Pricing}>
                    Cjenik
                </Link>
                .
            </Typography>
        </Stack>
    );
}
