import {
    firstRaisedBedTutorialPath,
    firstRaisedBedTutorialTasks,
} from '@gredice/js/raisedBedTutorial';
import { BlockImage } from '@gredice/ui/BlockImage';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { KnownPages } from '../../src/KnownPages';

export const metadata: Metadata = {
    title: 'Vodič za prvu gredicu',
    description:
        'Korak-po-korak vodič kroz prvi plan sadnje u Gredicama: od odabira obroka do popunjavanja praznih polja.',
    alternates: {
        canonical: firstRaisedBedTutorialPath,
    },
    openGraph: {
        title: 'Vodič za prvu gredicu',
        description:
            'Nauči kako odabrati prijedlog sadnje, dodati plan u košaru i urediti preostala polja u svojoj prvoj gredici.',
        url: firstRaisedBedTutorialPath,
    },
};

export default function FirstRaisedBedGuidePage() {
    return (
        <Container maxWidth="md">
            <Stack spacing={8}>
                <PageHeader
                    visual={
                        <BlockImage
                            blockName="Raised_Bed"
                            width={160}
                            height={160}
                        />
                    }
                    header="Vodič za prvu gredicu"
                    subHeader="Prati kratke zadatke iz onboarding prozora i pretvori prijedlog sadnje u stvaran plan za svoju gredicu."
                    padded
                />

                <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
                    <Stack spacing={3}>
                        <Typography level="h2">
                            Što ovaj vodič pokriva
                        </Typography>
                        <Typography level="body1" secondary>
                            Brzi plan sadnje pomaže ti krenuti bez praznog
                            platna. Aplikacija pita što želiš jesti i kakav
                            ritam brige želiš, predloži nekoliko rasporeda i
                            popuni 12 polja u košari. Šest polja ostaje prazno
                            kako bi ih kasnije mogao urediti po svome.
                        </Typography>
                        <Row className="flex-wrap" spacing={2}>
                            <Chip color="success" variant="soft">
                                12 predloženih sadnji
                            </Chip>
                            <Chip variant="outlined">6 praznih polja</Chip>
                            <Chip variant="outlined">2 kratka koraka</Chip>
                        </Row>
                    </Stack>
                    <div className="rounded-lg border border-tertiary/40 bg-card p-4">
                        <Stack spacing={3}>
                            <Typography semiBold>Brzi ulaz</Typography>
                            <Typography level="body3" secondary>
                                Ako već imaš otvoren vrt, vrati se u aplikaciju
                                i nastavi iz closeup prikaza gredice.
                            </Typography>
                            <Button href={KnownPages.GardenApp} fullWidth>
                                Otvori vrt
                            </Button>
                        </Stack>
                    </div>
                </section>

                <section>
                    <Stack spacing={4}>
                        <Typography level="h2">Svi zadaci</Typography>
                        <div className="grid gap-3 md:grid-cols-2">
                            {firstRaisedBedTutorialTasks.map((task, index) => (
                                <a
                                    className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    href={`#${task.id}`}
                                    key={task.id}
                                >
                                    <Stack spacing={2}>
                                        <Row alignItems="center" spacing={2}>
                                            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                                                {(index + 1).toString()}
                                            </span>
                                            <Typography semiBold>
                                                {task.title}
                                            </Typography>
                                        </Row>
                                        <Typography level="body3" secondary>
                                            {task.shortDescription}
                                        </Typography>
                                    </Stack>
                                </a>
                            ))}
                        </div>
                    </Stack>
                </section>

                <section>
                    <Stack spacing={6}>
                        <Typography level="h2">Korak-po-korak upute</Typography>
                        {firstRaisedBedTutorialTasks.map((task, index) => (
                            <article
                                className="scroll-mt-24 rounded-lg border border-tertiary/30 bg-card p-5"
                                id={task.id}
                                key={task.id}
                            >
                                <Stack spacing={4}>
                                    <Stack spacing={2}>
                                        <Chip
                                            className="w-fit"
                                            size="sm"
                                            variant="soft"
                                        >
                                            Zadatak {(index + 1).toString()}
                                        </Chip>
                                        <Typography level="h3">
                                            {task.title}
                                        </Typography>
                                        <Typography level="body1" secondary>
                                            {task.guideDescription}
                                        </Typography>
                                    </Stack>
                                    <ol className="grid gap-2 pl-5">
                                        {task.steps.map((step) => (
                                            <li
                                                className="pl-1 text-sm leading-6 text-foreground"
                                                key={step}
                                            >
                                                {step}
                                            </li>
                                        ))}
                                    </ol>
                                </Stack>
                            </article>
                        ))}
                    </Stack>
                </section>

                <section className="rounded-lg border border-tertiary/40 bg-muted/40 p-5">
                    <Stack spacing={3}>
                        <Typography level="h2">Ako zapneš</Typography>
                        <Typography level="body1" secondary>
                            Onboarding možeš preskočiti ili zatvoriti u bilo
                            kojem trenutku. Tvoj vrt ostaje dostupan, a prazna
                            polja možeš urediti ručno iz closeup prikaza gredice
                            kada budeš spreman.
                        </Typography>
                        <Row className="flex-wrap" spacing={3}>
                            <Button href={KnownPages.GardenApp}>
                                Nastavi u vrtu
                            </Button>
                            <Button
                                href={KnownPages.RaisedBeds}
                                variant="outlined"
                            >
                                Više o gredicama
                            </Button>
                        </Row>
                    </Stack>
                </section>

                <Row spacing={4} className="mt-2">
                    <Typography level="body1">
                        Je li ti vodič za prvu gredicu bio koristan?
                    </Typography>
                    <FeedbackModal topic="www/first-raised-bed-guide" />
                </Row>
            </Stack>
        </Container>
    );
}
