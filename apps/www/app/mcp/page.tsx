import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Container } from '@gredice/ui/Container';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { KnownPages } from '../../src/KnownPages';

const mcpEndpoint = 'https://api.gredice.com/api/mcp';
const clientConfiguration = `{
  "mcpServers": {
    "gredice": {
      "url": "${mcpEndpoint}"
    }
  }
}`;

const metadataDescription =
    'Poveži AI asistenta s javnim znanjem Gredica i, uz autorizaciju, podacima svojeg vrta preko sigurnog MCP sučelja.';

export const metadata: Metadata = {
    title: 'Gredice za AI asistente',
    description: metadataDescription,
    alternates: {
        canonical: KnownPages.MCP,
    },
    openGraph: {
        title: 'Gredice za AI asistente',
        description: metadataDescription,
        url: KnownPages.MCP,
    },
};

const accessLevels = [
    {
        icon: '🌿',
        title: 'Javno znanje',
        description:
            'AI asistent može bez prijave pretraživati biljke, sorte, sjeme, radnje i objavljene proizvode.',
    },
    {
        icon: '🪴',
        title: 'Tvoj vrt',
        description:
            'Autorizirane integracije mogu čitati vrtove, gredice, polja i radnje samo za dopušteni račun.',
    },
    {
        icon: '🛒',
        title: 'Zaštićene promjene',
        description:
            'Čitanje košarice traži prijavu, a svaka promjena i zasebnu dozvolu za pisanje.',
    },
] as const;

const technicalDetails = [
    ['Adresa', mcpEndpoint],
    ['Prijenos', 'Streamable HTTP i JSON-RPC 2.0'],
    ['Autorizacija', 'Bearer token za zaštićene alate'],
    ['Dozvole', 'mcp:read, mcp:write i mcp:admin'],
] as const;

export default function McpPage() {
    return (
        <Container maxWidth="lg" className="py-12 md:py-16">
            <Stack spacing={12}>
                <PageHeader
                    header="Gredice za AI asistente"
                    subHeader="Poveži kompatibilnog AI asistenta s provjerenim podacima o biljkama i, uz tvoje dopuštenje, kontekstom vlastitog vrta."
                />

                <Stack spacing={4}>
                    <Chip color="success" variant="soft">
                        MCP • javno dostupan
                    </Chip>
                    <Typography level="h3" component="h2">
                        Manje prepisivanja, više korisnog konteksta
                    </Typography>
                    <Typography level="body1" secondary>
                        Model Context Protocol (MCP) omogućuje AI asistentu da
                        koristi alate i podatke Gredica kroz jedno standardno
                        sučelje. Umjesto kopiranja podataka iz aplikacije,
                        asistent može dohvatiti samo ono što je potrebno za tvoj
                        upit i što mu je dopušteno koristiti.
                    </Typography>
                </Stack>

                <section aria-labelledby="mcp-access-heading">
                    <Stack spacing={6}>
                        <Typography
                            id="mcp-access-heading"
                            level="h3"
                            component="h2"
                        >
                            Što je dostupno
                        </Typography>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            {accessLevels.map((item) => (
                                <Card
                                    key={item.title}
                                    className="h-full border-b-4 border-tertiary"
                                >
                                    <CardHeader>
                                        <span
                                            aria-hidden="true"
                                            className="text-3xl"
                                        >
                                            {item.icon}
                                        </span>
                                        <CardTitle>{item.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Typography level="body2" secondary>
                                            {item.description}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </Stack>
                </section>

                <section aria-labelledby="mcp-connect-heading">
                    <div className="grid gap-8 rounded-xl border bg-card p-6 md:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)] md:p-8">
                        <Stack spacing={5}>
                            <Typography
                                id="mcp-connect-heading"
                                level="h3"
                                component="h2"
                            >
                                Kako se spojiti
                            </Typography>
                            <Typography level="body1" secondary>
                                U postavkama MCP klijenta dodaj udaljeni
                                poslužitelj pod nazivom <strong>Gredice</strong>{' '}
                                i upotrijebi adresu ispod. Točan oblik postavke
                                ovisi o klijentu, ali najčešće izgleda ovako:
                            </Typography>
                            <NavigatingButton
                                href={mcpEndpoint}
                                rel="noreferrer"
                                target="_blank"
                                className="w-fit"
                            >
                                Otvori MCP adresu
                            </NavigatingButton>
                        </Stack>
                        <pre className="min-w-0 max-w-full overflow-x-auto rounded-lg bg-neutral-950 p-4 text-sm leading-6 text-neutral-100 shadow-inner">
                            <code className="whitespace-pre-wrap break-all">
                                {clientConfiguration}
                            </code>
                        </pre>
                    </div>
                </section>

                <section aria-labelledby="mcp-security-heading">
                    <div className="grid gap-8 md:grid-cols-2">
                        <Stack spacing={5}>
                            <Typography
                                id="mcp-security-heading"
                                level="h3"
                                component="h2"
                            >
                                Privatnost i kontrola pristupa
                            </Typography>
                            <ul className="list-disc space-y-3 pl-6 text-sm leading-6 text-secondary-foreground">
                                <li>
                                    Javni alati ne otkrivaju podatke računa,
                                    korisnika, vrta, košarice ili dostave.
                                </li>
                                <li>
                                    Zaštićeni alati traže valjan token i rade
                                    samo nad računom kojem korisnik već smije
                                    pristupiti.
                                </li>
                                <li>
                                    Čitanje i promjene imaju odvojene dozvole,
                                    pa pristup podacima ne daje automatski pravo
                                    na promjenu stanja.
                                </li>
                                <li>
                                    Token nemoj unositi u javne poruke,
                                    dokumente ili klijente kojima ne vjeruješ.
                                </li>
                            </ul>
                        </Stack>

                        <Stack spacing={5}>
                            <Typography level="h3" component="h2">
                                Tehnički podaci
                            </Typography>
                            <dl className="divide-y rounded-lg border bg-card px-4">
                                {technicalDetails.map(([label, value]) => (
                                    <div
                                        key={label}
                                        className="grid gap-1 py-4 sm:grid-cols-[120px_1fr]"
                                    >
                                        <dt className="text-sm font-medium">
                                            {label}
                                        </dt>
                                        <dd className="min-w-0 break-words font-mono text-sm text-secondary-foreground">
                                            {value}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </Stack>
                    </div>
                </section>

                <section className="rounded-xl bg-muted p-6 md:p-8">
                    <Stack spacing={4}>
                        <Typography level="h4" component="h2">
                            Javni podaci bez prijave
                        </Typography>
                        <Typography level="body1" secondary>
                            Javni katalog i objavljeni proizvodi dostupni su
                            svakom kompatibilnom MCP klijentu. Podaci vrta i
                            košarice ostaju zaštićeni i dostupni su samo nakon
                            prijave kroz klijent koji podržava autorizaciju.
                            Klijent bez prijave i dalje može koristiti sve javne
                            alate.
                        </Typography>
                        <NavigatingButton
                            href={KnownPages.Contact}
                            variant="outlined"
                            className="w-fit"
                        >
                            Javi nam se za integraciju
                        </NavigatingButton>
                    </Stack>
                </section>
            </Stack>
        </Container>
    );
}
