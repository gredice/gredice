import { Card, CardContent } from '@gredice/ui/Card';
import { Heart, Home, PawPrint } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';

const steps = [
    {
        icon: <Home aria-hidden className="size-5" />,
        title: 'Svaki ljubimac ima svoj blok',
        description:
            'Pseća kućica, mačji jastuk, kokošinjac i obor za praščića — svaki blok dovodi svog stanara.',
    },
    {
        icon: <PawPrint aria-hidden className="size-5" />,
        title: 'Sami se brinu za svoj dan',
        description:
            'Istražuju okolicu, traže hranu i odmaraju se, a pred noć i po lošem vremenu vraćaju se svom domu.',
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
