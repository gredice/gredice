import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Container } from '@gredice/ui/Container';
import { Navigate } from '@gredice/ui/icons';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
    getPublicSunflowerPackages,
    type PublicSunflowerPackage,
} from '../../lib/sunflowerPackages';
import { KnownPages } from '../../src/KnownPages';

export const metadata: Metadata = {
    title: 'Suncokreti i Gredice saldo',
    description:
        'Suncokreti su prepaid Gredice bodovi za vrtne akcije. Pogledaj pakete, bonus suncokrete i pravila korištenja salda.',
};

const sunflowerFormatter = new Intl.NumberFormat('hr-HR', {
    maximumFractionDigits: 0,
});
const euroFormatter = new Intl.NumberFormat('hr-HR', {
    currency: 'EUR',
    style: 'currency',
});

function packagePrice(pkg: PublicSunflowerPackage) {
    return euroFormatter.format(pkg.priceCents / 100);
}

function packageCtaUrl() {
    return `${KnownPages.GardenApp}/?pregled=suncokreti`;
}

function packageCard(pkg: PublicSunflowerPackage) {
    return (
        <Card key={pkg.code} className="h-full border-tertiary border-b-4">
            <CardHeader>
                <div className="flex items-start justify-between gap-3">
                    <Stack spacing={1}>
                        <CardTitle>{pkg.name}</CardTitle>
                        {pkg.tag ? (
                            <Chip size="sm" variant="soft">
                                {pkg.tag}
                            </Chip>
                        ) : null}
                    </Stack>
                    <Typography level="body1" bold className="tabular-nums">
                        {packagePrice(pkg)}
                    </Typography>
                </div>
            </CardHeader>
            <CardContent>
                <Stack spacing={3}>
                    <Typography level="h3" className="tabular-nums">
                        {sunflowerFormatter.format(pkg.sunflowers)} 🌻
                    </Typography>
                    {pkg.bonusSunflowers > 0 ? (
                        <Typography level="body2" className="text-primary">
                            +{sunflowerFormatter.format(pkg.bonusSunflowers)}{' '}
                            bonus suncokreta
                        </Typography>
                    ) : null}
                    {pkg.descriptionShort ? (
                        <Typography level="body2" secondary>
                            {pkg.descriptionShort}
                        </Typography>
                    ) : null}
                    {pkg.isOneTime ? (
                        <Typography level="body3" secondary>
                            Jednokratna ponuda po korisničkom računu.
                        </Typography>
                    ) : null}
                    {pkg.role === 'upsell' ? (
                        <Typography level="body3" secondary>
                            Najveći paket prikazuje se u vrtu nakon odabira
                            paketa Mirna sezona.
                        </Typography>
                    ) : null}
                    <Button
                        href={packageCtaUrl()}
                        endDecorator={<Navigate className="size-4" />}
                        size="sm"
                    >
                        {pkg.cta ?? 'Kupi paket'}
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    );
}

export default async function SunflowersPage() {
    const packages = await getPublicSunflowerPackages();
    const initialOffer = packages.filter(
        (pkg) => pkg.role === 'initial_one_time',
    );
    const mainPackages = packages.filter(
        (pkg) => pkg.role === 'main' && pkg.showInPrimaryList,
    );
    const upsellPackages = packages.filter((pkg) => pkg.role === 'upsell');

    return (
        <Container maxWidth="lg">
            <Stack spacing={6}>
                <PageHeader
                    header="Suncokreti"
                    subHeader="Gredice bodovi za vrtne akcije u tvojoj gredici"
                    padded
                    visual={
                        <Image
                            src="https://cdn.gredice.com/sunflower-large.svg"
                            alt="Suncokret"
                            width={192}
                            height={192}
                            priority
                        />
                    }
                />

                <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                    <Card className="border-tertiary border-b-4">
                        <CardHeader>
                            <CardTitle>Kako funkcionira saldo</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Stack spacing={3}>
                                <Typography level="body1">
                                    Suncokreti su Gredice bodovi koje koristiš
                                    za vrtne akcije - sadnju, sjetvu,
                                    zalijevanje, plijevljenje, fotografiranje,
                                    berbu, dostavu i druge zadatke u svojoj
                                    gredici.
                                </Typography>
                                <Typography level="body2" secondary>
                                    Kod korištenja salda vrijedi orijentacijski
                                    odnos 1 EUR ≈ 1.000 suncokreta. Saldo se
                                    evidentira na korisničkom računu i dostupan
                                    je u vrtu nakon uspješne uplate.
                                </Typography>
                                <Typography level="body2" secondary>
                                    Suncokreti se mogu koristiti samo unutar
                                    Gredica, ne prenose se na druge korisnike i
                                    ne mijenjaju se za gotovinu osim kod
                                    zakonski obveznih ili odobrenih povrata.
                                </Typography>
                            </Stack>
                        </CardContent>
                    </Card>
                    <Card className="border-tertiary border-b-4">
                        <CardHeader>
                            <CardTitle>Korištenje u vrtu</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Stack spacing={3}>
                                <Typography level="body2" secondary>
                                    Pri naručivanju vrtne akcije suncokreti se
                                    najprije rezerviraju. Ako se akcija otkaže
                                    prije obrade, rezervacija se vraća na saldo.
                                </Typography>
                                <Typography level="body2" secondary>
                                    Nakon izvršene akcije rezervirani iznos se
                                    naplaćuje iz salda, a dokumenti su dostupni
                                    u korisničkom profilu.
                                </Typography>
                                <Link
                                    className="font-medium text-primary underline-offset-4 hover:underline"
                                    href={KnownPages.Refunds}
                                >
                                    Pravila povrata i korekcija
                                </Link>
                            </Stack>
                        </CardContent>
                    </Card>
                </section>

                <section className="space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <Stack spacing={1}>
                            <Typography level="h2">
                                Paketi suncokreta
                            </Typography>
                            <Typography level="body2" secondary>
                                Bonus je prikazan kao dodatni broj suncokreta
                                koji se dodaje na Gredice saldo.
                            </Typography>
                        </Stack>
                        <Button
                            href={packageCtaUrl()}
                            variant="outlined"
                            endDecorator={<Navigate className="size-4" />}
                        >
                            Otvori vrt
                        </Button>
                    </div>

                    {packages.length === 0 ? (
                        <Card>
                            <CardContent noHeader>
                                <Typography level="body2" secondary>
                                    Paketi se trenutno ne mogu učitati.
                                    Suncokrete možeš kupiti iz profila u vrtu
                                    čim je katalog dostupan.
                                </Typography>
                            </CardContent>
                        </Card>
                    ) : null}

                    {initialOffer.length > 0 ? (
                        <Stack spacing={2}>
                            <Typography level="body1" bold>
                                Početna ponuda
                            </Typography>
                            <div className="grid gap-4 md:grid-cols-2">
                                {initialOffer.map(packageCard)}
                            </div>
                        </Stack>
                    ) : null}

                    {mainPackages.length > 0 ? (
                        <Stack spacing={2}>
                            <Typography level="body1" bold>
                                Glavni paketi
                            </Typography>
                            <div className="grid gap-4 md:grid-cols-3">
                                {mainPackages.map(packageCard)}
                            </div>
                        </Stack>
                    ) : null}

                    {upsellPackages.length > 0 ? (
                        <Stack spacing={2}>
                            <Typography level="body1" bold>
                                Najveći paket
                            </Typography>
                            <div className="grid gap-4 md:grid-cols-2">
                                {upsellPackages.map(packageCard)}
                            </div>
                        </Stack>
                    ) : null}
                </section>
            </Stack>
        </Container>
    );
}
