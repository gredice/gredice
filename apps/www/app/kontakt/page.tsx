import { GameContactIcon, GameMailboxIcon } from '@gredice/ui/GameIcons';
import { PageHeader } from '@gredice/ui/PageHeader';
import { CompanyWhatsApp } from '@gredice/ui/PublicChrome';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Typography } from '@gredice/ui/Typography';
import { Card } from '../../components/shared/Card';
import { FacebookCard } from '../../components/social/FacebookCard';
import { InstagramCard } from '../../components/social/InstagramCard';
import { WhatsAppCard } from '../../components/social/WhatsAppCard';
import { createPublicMetadata } from '../../lib/seo/publicMetadata';
import { KnownPages } from '../../src/KnownPages';

export const metadata = createPublicMetadata({
    title: 'Kontakt',
    description:
        'Slobodno nam se javi ako imaš pitanja, prijedloge ili komentare.',
    path: KnownPages.Contact,
    eyebrow: 'Kontakt',
});

const contactChannels = [
    {
        key: 'whatsapp',
        icon: <CompanyWhatsApp aria-hidden className="size-7" />,
        label: 'WhatsApp',
        value: '+385 99 344 7418',
        href: 'https://wa.me/385993447418',
    },
    {
        key: 'info',
        icon: <GameMailboxIcon aria-hidden className="size-8" />,
        label: 'E-mail za opće informacije',
        value: 'info@gredice.com',
        href: 'mailto:info@gredice.com',
    },
    {
        key: 'support',
        icon: <GameContactIcon aria-hidden className="size-8" />,
        label: 'E-mail tehničke podrške',
        value: 'podrska@gredice.com',
        href: 'mailto:podrska@gredice.com',
    },
];

export default function ContactPage() {
    return (
        <Stack spacing={12} className="pb-12">
            <Stack spacing={4}>
                <PageHeader
                    header="Kontakt"
                    subHeader="Slobodno nam se javi ako imaš pitanja, prijedloge ili komentare."
                    padded
                />
                <section aria-labelledby="kontakt-kanali" className="space-y-4">
                    <Typography level="h4" component="h2" id="kontakt-kanali">
                        Javi nam se
                    </Typography>
                    <Typography level="body1" className="max-w-2xl">
                        Trudimo se odgovoriti na sve poruke u najkraćem mogućem
                        roku, stoga ne oklijevaj i javi nam se.
                    </Typography>
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {contactChannels.map((channel) => (
                            <li key={channel.key}>
                                <a
                                    href={channel.href}
                                    className="group block h-full rounded-lg ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <Card className="flex h-full items-center gap-3 p-4 transition-colors group-hover:bg-muted/60">
                                        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-muted">
                                            {channel.icon}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-sm text-muted-foreground">
                                                {channel.label}
                                            </span>
                                            <span className="block break-words font-semibold">
                                                {channel.value}
                                            </span>
                                        </span>
                                    </Card>
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            </Stack>

            <section aria-labelledby="kontakt-mreze" className="space-y-4">
                <Typography level="h4" component="h2" id="kontakt-mreze">
                    Prati nas na društvenim mrežama
                </Typography>
                <div className="grid gap-3 lg:grid-cols-3">
                    <WhatsAppCard />
                    <InstagramCard />
                    <FacebookCard />
                </div>
            </section>

            <div className="max-w-3xl">
                <StyledHtml size="md">
                    <h2 id="pisani-prigovor">Pisani prigovor potrošača</h2>
                    <p>
                        Pisani prigovor na kupljeni proizvod, pruženu uslugu ili
                        naše poslovanje možeš poslati na{' '}
                        <a href="mailto:kontakt@gredice.com">
                            kontakt@gredice.com
                        </a>
                        , poštom na Gredice d.o.o., Ulica Julija Knifera 3,
                        10000 Zagreb, ili ga predati u našim poslovnim
                        prostorijama.
                    </p>
                    <p>
                        Primitak prigovora potvrđujemo bez odgađanja. Pisani
                        odgovor šaljemo u roku od{' '}
                        <strong>15 dana od primitka</strong>, uz jasno
                        očitovanje prihvaćamo li osnovanost prigovora.
                        Evidenciju prigovora čuvamo najmanje godinu dana od
                        primitka.
                    </p>
                    <p>
                        Opiši problem i navedi kontakt za odgovor te, ako ga
                        imaš, broj narudžbe. Fotografije ili drugi podaci mogu
                        pomoći, ali ne moraš koristiti poseban obrazac za
                        podnošenje prigovora. Prigovor i dobrovoljni zahtjev za
                        povrat ne zamjenjuju zakonsko pravo na jednostrani
                        raskid ili druga prava.
                    </p>
                    <p>
                        Postupci su opisani na stranici{' '}
                        <a href={KnownPages.Refunds}>Povrat novca</a>. Za
                        zahtjeve vezane uz osobne podatke pročitaj{' '}
                        <a href={KnownPages.LegalPrivacy}>
                            Politiku privatnosti
                        </a>
                        .
                    </p>
                    <hr />
                    <p>Hvala ti što si dio naše zajednice!</p>
                </StyledHtml>
            </div>
        </Stack>
    );
}
