import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { WhatsAppCard } from '../../components/social/WhatsAppCard';

export const metadata: Metadata = {
    title: 'O nama',
    description:
        'Tvoj vrt, gdje god bio. Jer vrt ne mora biti ispred kuće da bi bio tvoj.',
};

function SectionHeader({
    children,
    subheader,
}: {
    children: React.ReactNode;
    subheader?: string;
}) {
    return (
        <Stack>
            <Typography level="h3" component="h2">
                {children}
            </Typography>
            {subheader && (
                <Typography level="body2" className="leading-none">
                    {subheader}
                </Typography>
            )}
        </Stack>
    );
}

function ValueCard({
    icon,
    title,
    description,
    microCopy,
}: {
    icon: string;
    title: string;
    description: string;
    microCopy: string;
}) {
    return (
        <Stack
            spacing={4}
            className="bg-card border border-tertiary border-b-4 rounded-xl p-6 shadow"
        >
            <Typography level="h5" component="h3">
                {icon} {title}
            </Typography>
            <Typography level="body1">{description}</Typography>
            <Typography level="body2" className="italic text-muted-foreground">
                {microCopy}
            </Typography>
        </Stack>
    );
}

export default function AboutUsPage() {
    return (
        <Container maxWidth="md">
            <Stack spacing={16}>
                <PageHeader
                    header="O nama"
                    subHeader="Tvoj vrt, gdje god bio 🌱"
                    padded
                />

                {/* Ideja */}
                <Stack spacing={6}>
                    <SectionHeader subheader="Vrt bez selidbe na selo.">
                        Ideja
                    </SectionHeader>
                    <Typography level="body1">
                        <strong>
                            Gredice su nastale iz želje za vlastitim vrtom — čak
                            i kad živiš u gradu.
                        </strong>{' '}
                        Za sve nas koji nemamo dvorište, ali imamo potrebu da
                        uzgajamo svoju hranu, znamo što jedemo i budemo barem
                        malo bliže prirodi.
                    </Typography>
                    <Typography level="body1">
                        Kroz Gredice smo stvorili način da imaš{' '}
                        <strong>svoj vrt bez obzira na lokaciju</strong>, bez
                        potrebe da imaš zemlju, alat ili slobodno vrijeme svaki
                        vikend.
                    </Typography>
                </Stack>

                {/* Kako se ideja razvila */}
                <Stack spacing={6}>
                    <SectionHeader subheader="Jedan vrt. Više mogućnosti.">
                        Kako se ideja razvila
                    </SectionHeader>
                    <Typography level="body1">
                        Ubrzo smo shvatili da Gredice nisu samo za one bez vrta.
                        Sve više nam se javljaju i ljudi koji{' '}
                        <strong>već imaju vrt</strong>, ali žele:
                    </Typography>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>
                            <Typography level="body1">
                                uzgajati povrće na{' '}
                                <strong>drugoj lokaciji</strong>
                            </Typography>
                        </li>
                        <li>
                            <Typography level="body1">
                                imati vrt u <strong>drukčijoj klimi</strong>
                            </Typography>
                        </li>
                        <li>
                            <Typography level="body1">
                                ili jednostavno imati vrt{' '}
                                <strong>bliže svakodnevnom životu</strong>
                            </Typography>
                        </li>
                    </ul>
                    <Typography level="body1">
                        Gredice su postale fleksibilan koncept — vrt koji se
                        prilagođava tebi, a ne obrnuto.
                    </Typography>
                </Stack>

                {/* Kako Gredice funkcioniraju */}
                <Stack spacing={6}>
                    <SectionHeader subheader="Ti biraš vrt. Mi pazimo da uspije.">
                        Kako Gredice funkcioniraju
                    </SectionHeader>
                    <Typography level="body1">
                        Gredice povezuju ljude koji žele vrt s ljudima koji{' '}
                        <strong>znaju kako ga uzgojiti</strong>. Suradnjom s
                        lokalnim OPG-ovima stvaramo vrtove koji su:
                    </Typography>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>
                            <Typography level="body1">stvarni</Typography>
                        </li>
                        <li>
                            <Typography level="body1">lokalni</Typography>
                        </li>
                        <li>
                            <Typography level="body1">
                                održavani s pažnjom
                            </Typography>
                        </li>
                    </ul>
                    <Typography level="body1">
                        Ti imaš svoj vrt, a mi se brinemo da on raste.
                    </Typography>
                </Stack>

                {/* Naš tim */}
                <Stack spacing={6}>
                    <SectionHeader subheader="Malo ljudi. Puno zemlje pod noktima.">
                        Naš tim
                    </SectionHeader>
                    <Typography level="body1">
                        <strong>Gredice tim je trenutačno mali</strong>, ali iza
                        njega stoji puno rada, razmišljanja i stvarnog iskustva.
                    </Typography>
                    <Typography level="body1">
                        Trenutno surađujemo s{' '}
                        <strong>jednim OPG-om iz Moslavine</strong>, s kojim
                        gradimo temelje cijelog sustava — od uzgoja do
                        povjerenja.
                    </Typography>
                    <Typography level="body1">
                        Ne gradimo brzo, nego <strong>gradimo smisleno</strong>.
                    </Typography>
                </Stack>

                {/* Naša vizija */}
                <Stack spacing={6}>
                    <SectionHeader subheader="Vrtovi bez granica.">
                        Naša vizija
                    </SectionHeader>
                    <Typography level="body1">
                        Naš cilj je jednostavan, ali ambiciozan:{' '}
                        <strong>
                            omogućiti svima da imaju svoj vrt — gdje god bili.
                        </strong>
                    </Typography>
                    <Typography level="body1">
                        Zato Gredice razvijamo kao{' '}
                        <strong>mrežu suradnji s više malih OPG-ova</strong> iz
                        različitih krajeva i klima. Tako svatko može imati vrt
                        tamo gdje mu najviše odgovara — klimatski, geografski
                        ili životno.
                    </Typography>
                </Stack>

                {/* Naše vrijednosti */}
                <Stack spacing={8}>
                    <SectionHeader>Naše vrijednosti</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ValueCard
                            icon="🌱"
                            title="Lokalno i održivo"
                            description="Radimo s malim OPG-ovima i vjerujemo u lokalnu proizvodnju, pošten odnos i dugoročnu održivost."
                            microCopy="Malo lokalno. Velika razlika."
                        />
                        <ValueCard
                            icon="🤝"
                            title="Povjerenje i transparentnost"
                            description="Tvoj vrt je stvaran. Znaš gdje je, tko ga uzgaja i kako."
                            microCopy="Bez skrivenih slojeva."
                        />
                        <ValueCard
                            icon="🌍"
                            title="Dostupnost svima"
                            description="Vrt ne smije biti luksuz. Gredice postoje kako bi vrt bio dostupan svima — bez obzira gdje živiš."
                            microCopy="Vrt za grad, selo i sve između."
                        />
                        <ValueCard
                            icon="🧠"
                            title="Pametna tehnologija"
                            description="Koristimo tehnologiju da bismo pojednostavili vrtlarenje, ne da bismo ga udaljili od prirode."
                            microCopy="Tehnologija u službi zemlje."
                        />
                    </div>
                </Stack>

                {/* CTA - Contact */}
                <Stack spacing={4}>
                    <Typography level="h5">
                        Imaš pitanja ili želiš surađivati?
                    </Typography>
                    <WhatsAppCard />
                </Stack>

                {/* Feedback */}
                <Row spacing={4} className="mt-4">
                    <Typography level="body1">
                        Jesu li ti informacije korisne?
                    </Typography>
                    <FeedbackModal topic="www/about-us" />
                </Row>
            </Stack>
        </Container>
    );
}
