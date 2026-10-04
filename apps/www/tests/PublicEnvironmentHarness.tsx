import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Markdown } from '@gredice/ui/Markdown';
import { PageHeader } from '@gredice/ui/PageHeader';
import {
    PublicChromeProvider,
    PublicEnvironmentFooterControls,
} from '@gredice/ui/PublicChrome';
import { Typography } from '@gredice/ui/Typography';

export function PublicEnvironmentHarness() {
    return (
        <PublicChromeProvider>
            <main className="mx-auto min-h-[150vh] max-w-6xl space-y-8 px-4 py-8">
                <Breadcrumbs
                    items={[
                        { label: 'Biljke', href: '/biljke' },
                        { label: 'Bamija' },
                    ]}
                />
                <PageHeader
                    header="Bamija"
                    alternativeName="lat. Abelmoschus esculentus"
                    subHeader="Bamija je jednogodišnja povrtna biljka koju uzgajamo zbog jestivih mladih mahuna. Biljka voli toplo i sunčano mjesto."
                />
                <section className="space-y-4">
                    <Typography level="h4" component="h2">
                        Priprema tla
                    </Typography>
                    <Markdown>
                        {
                            'Odaberi **dobro drenirano tlo** bogato humusom.\n\n- Ukloni korov prije sadnje.\n- Redovito zalijevaj tijekom rasta.\n\n[Više o sjetvi](/sjetva)'
                        }
                    </Markdown>
                    <Typography level="body3">Nema dodatnih radnji</Typography>
                </section>
                <PublicEnvironmentFooterControls />
                <p className="pt-[50vh] text-muted-foreground">
                    Smjernice za uzgoj i berbu.
                </p>
            </main>
        </PublicChromeProvider>
    );
}
