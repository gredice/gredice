import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import Image from 'next/image';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { formatPrice } from '../../lib/formatPrice';
import { KnownPages } from '../../src/KnownPages';

const referralReward = 10000;
const sunflowerEuroRate = 1000;
const combinedReferralReward = referralReward * 2;
const combinedRewardValue = combinedReferralReward / sunflowerEuroRate;
const formattedReferralReward = new Intl.NumberFormat('hr-HR').format(
    referralReward,
);
const formattedCombinedReferralReward = new Intl.NumberFormat('hr-HR').format(
    combinedReferralReward,
);
const referralMetadataDescription = `Program preporuka za Gredice: podijeli ili iskoristi kod i saznaj kako jedna preporuka donosi ukupno ${formattedCombinedReferralReward} 🌻 nagrade.`;

export const metadata: Metadata = {
    title: 'Preporuke',
    description: referralMetadataDescription,
    keywords: [
        'Gredice',
        'program preporuka',
        'kod preporuke',
        'nagrade',
        'vrt aplikacija',
    ],
    openGraph: {
        title: 'Preporuke',
        description: referralMetadataDescription,
        url: KnownPages.Referrals,
    },
};

const referralFlows = [
    {
        title: 'Daješ preporuku',
        ctaLabel: 'Otvori i podijeli kod',
        steps: [
            {
                title: 'Uredi i kopiraj svoj kod',
                rule: 'Kod možeš mijenjati dok račun nema aktivnu gredicu, a dva računa ne mogu imati isti kod.',
            },
            {
                title: 'Podijeli kod ili poveznicu',
                rule: 'Isti kod može iskoristiti više različitih računa.',
            },
            {
                title: 'Dobivaš nagradu',
                rule: 'Kada pozvani račun posadi svoje prvo povrće u gredici, tvoj račun dobiva 10.000 🌻.',
            },
        ],
    },
    {
        title: 'Primaš preporuku',
        ctaLabel: 'Otvori i unesi kod',
        steps: [
            {
                title: 'Unesi kod prijatelja',
                rule: 'Kod možeš iskoristiti i ako račun već ima aktivnu gredicu.',
            },
            {
                title: 'Iskoristi samo jedan kod',
                rule: 'Svaki račun može iskoristiti samo jedan kod preporuke; nakon toga ne možeš iskoristiti drugi.',
            },
            {
                title: 'Dobivaš nagradu',
                rule: 'Kada tvoj račun posadi svoje prvo povrće u gredici, dobivaš 10.000 🌻.',
            },
        ],
    },
];

export default function ReferralsLandingPage() {
    return (
        <Container maxWidth="md">
            <Stack spacing={10}>
                <PageHeader
                    header="Preporuke"
                    subHeader={`Podijeli svoj kod, pozovi nekoga u Gredice i zajedno ostvarite ukupno ${formattedCombinedReferralReward} 🌻 kada pozvani račun posadi svoje prvo povrće u gredici.`}
                    padded
                    visual={
                        <Image
                            src="https://cdn.gredice.com/sunflower-gift-sunflowers.webp"
                            alt="Poklon sa suncokretima"
                            width={192}
                            height={192}
                            priority
                        />
                    }
                />

                <StyledHtml>
                    <p>
                        Program preporuka je jednostavan: podijeli svoj kod s
                        osobom koja želi koristiti Gredice. Ta osoba može
                        unijeti tvoj kod u aplikaciji, a nagrada se povezuje s
                        oba računa kada pozvani račun posadi svoje prvo povrće u
                        gredici.
                    </p>
                    <p>
                        Kodovi nisu jednokratne pozivnice. Isti kod možeš
                        dijeliti više puta, a različiti računi ga mogu
                        iskoristiti neovisno jedan o drugome.
                    </p>
                </StyledHtml>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>🎁 Nagrada</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Typography level="h3" component="p">
                                {formattedReferralReward} 🌻
                            </Typography>
                            <Typography level="body2" secondary>
                                Toliko dobiva račun koji je podijelio kod, a još
                                toliko dobiva račun koji kod iskoristi.
                            </Typography>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>💶 Vrijednost</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Typography level="h3" component="p">
                                {formatPrice(combinedRewardValue)}
                            </Typography>
                            <Typography level="body2" secondary>
                                Svaki račun dobiva {formattedReferralReward} 🌻.
                                Zajedno je to {formattedCombinedReferralReward}{' '}
                                🌻 prema pravilu 1.000 🌻 = 1 €.
                            </Typography>
                        </CardContent>
                    </Card>
                    <Card className="flex h-full flex-col">
                        <CardHeader>
                            <CardTitle>⚡ Brzi pristup</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col gap-4">
                            <Typography level="body2" secondary>
                                U pregledu preporuka možeš kopirati svoj kod,
                                podijeliti poveznicu ili unijeti kod prijatelja.
                            </Typography>
                            <Button
                                className="mt-auto w-fit"
                                href={KnownPages.GardenReferrals}
                                size="sm"
                            >
                                Otvori pregled
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <Stack spacing={4}>
                    <Stack spacing={2}>
                        <Typography level="h3" component="h2">
                            Kako funkcioniraju preporuke
                        </Typography>
                        <Typography
                            level="body2"
                            secondary
                            className="max-w-3xl"
                        >
                            Odaberi tok koji odgovara tvojoj situaciji: podijeli
                            svoj kod ili unesi kod prijatelja. Nagrada se
                            dodjeljuje kada preporučeni račun posadi svoje prvo
                            povrće u gredici.
                        </Typography>
                    </Stack>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {referralFlows.map((flow) => (
                            <Stack
                                spacing={3}
                                key={flow.title}
                                className="h-full"
                            >
                                <Typography level="h5" component="h3">
                                    {flow.title}
                                </Typography>
                                <Stack spacing={3}>
                                    {flow.steps.map((step, index) => (
                                        <div
                                            className="rounded-lg border bg-card p-4 text-card-foreground"
                                            key={step.title}
                                        >
                                            <Row spacing={3} alignItems="start">
                                                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                                    {index + 1}
                                                </span>
                                                <Stack spacing={1}>
                                                    <Typography
                                                        level="body1"
                                                        semiBold
                                                    >
                                                        {step.title}
                                                    </Typography>
                                                    <Typography
                                                        level="body3"
                                                        secondary
                                                    >
                                                        {step.rule}
                                                    </Typography>
                                                </Stack>
                                            </Row>
                                        </div>
                                    ))}
                                </Stack>
                                <Button
                                    className="mt-auto w-fit self-center"
                                    href={KnownPages.GardenReferrals}
                                    size="sm"
                                >
                                    {flow.ctaLabel}
                                </Button>
                            </Stack>
                        ))}
                    </div>
                </Stack>

                <StyledHtml>
                    <h2>Kako podijeliti ili iskoristiti kod?</h2>
                    <p>
                        Otvori pregled preporuka u aplikaciji. Tamo možeš
                        kopirati samo kod, kopirati punu poveznicu za dijeljenje
                        ili promijeniti svoj kod ako tvoj račun još nema aktivnu
                        gredicu.
                    </p>
                    <p>
                        Ako želiš iskoristiti kod prijatelja, unesi ga u istom
                        pregledu. Nakon što jedan kod iskoristiš, više ne možeš
                        iskoristiti drugi kod na istom računu.
                    </p>
                    <p>
                        Više o vrijednosti i korištenju 🌻 pročitaj na{' '}
                        <a href={KnownPages.Sunflowers}>stranici o 🌻</a>.
                    </p>
                </StyledHtml>

                <Row spacing={4} className="mt-4">
                    <Typography level="body1">
                        Jesu li pravila preporuka jasna ili nešto nedostaje?
                    </Typography>
                    <FeedbackModal topic="www/referrals" />
                </Row>
            </Stack>
        </Container>
    );
}
