import { Card, CardContent } from '@gredice/ui/Card';
import { Heart, Home, PawPrint } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';

const steps = [
    {
        icon: <Home aria-hidden className="size-5" />,
        title: 'Svaki ljubimac ima svoje mjesto',
        description:
            'Svaki stiže sa svojim domom, zaklonom ili ograđenim sigurnim mjestom koje mu je polazište za istraživanje.',
    },
    {
        icon: <PawPrint aria-hidden className="size-5" />,
        title: 'Sami se brinu za svoj dan',
        description:
            'Istražuju okolicu, traže hranu i odmaraju se. Ovisno o vrsti, pred noć ili po lošem vremenu vraćaju se na svoje sigurno mjesto.',
    },
    {
        icon: <Heart aria-hidden className="size-5" />,
        title: 'Reagiraju na tebe',
        description:
            'Klikni na ljubimca pa će ti se javiti svojim glasom i krenuti u novu aktivnost.',
    },
] satisfies Array<{
    icon: ReactNode;
    title: string;
    description: string;
}>;

export function GardenPetsIntro() {
    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {steps.map((step) => (
                <Card
                    className="h-full border-tertiary border-b-4"
                    key={step.title}
                >
                    <CardContent noHeader>
                        <Row alignItems="start" spacing={3}>
                            <span className="mt-0.5 shrink-0 text-muted-foreground">
                                {step.icon}
                            </span>
                            <Stack spacing={1}>
                                <Typography
                                    component="h3"
                                    level="body1"
                                    semiBold
                                >
                                    {step.title}
                                </Typography>
                                <Typography level="body2" secondary>
                                    {step.description}
                                </Typography>
                            </Stack>
                        </Row>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
