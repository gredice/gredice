import { getGardenBaseUrl } from '@gredice/js/urls';
import { Button } from '@gredice/ui/Button';
import { ArrowRight } from '@gredice/ui/icons';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Typography } from '@gredice/ui/Typography';
import { Suspense } from 'react';
import { SeasonHighlightChip } from '../shared/SeasonHighlightChip';
import { LandingCheckItem } from './LandingCheckItem';
import { landingHowItWorksId } from './LandingHowItWorks';
import { landingSeasonalPlantsId } from './LandingSeasonalPlants';

export function LandingHeroCopy() {
    return (
        <div
            className="flex flex-col gap-6 px-2 sm:px-0"
            data-testid="landing-hero"
        >
            <Suspense fallback={null}>
                <SeasonHighlightChip href={`#${landingSeasonalPlantsId}`} />
            </Suspense>
            <Typography
                level="h1"
                className="text-4xl leading-tight sm:text-5xl xl:text-6xl"
            >
                Tvoj vrt na pravom OPG-u.{' '}
                <span className="text-brand">Nit oro, nit kopo.</span>
            </Typography>
            <Typography
                level="body1"
                secondary
                className="max-w-xl text-pretty text-lg leading-relaxed"
            >
                Odaberi povrće u aplikaciji, tim na partnerskom OPG-u ga posadi
                i njeguje, a plodove ti dostavimo na kućni prag. U Gradu Zagrebu
                dostava je besplatna.
            </Typography>
            <div className="flex flex-wrap gap-3">
                <NavigatingButton
                    href={getGardenBaseUrl()}
                    size="lg"
                    color="brand"
                    endDecorator={<ArrowRight aria-hidden className="size-4" />}
                >
                    Složi svoju gredicu
                </NavigatingButton>
                <Button
                    href={`#${landingHowItWorksId}`}
                    size="lg"
                    color="neutral"
                    variant="outlined"
                    className="bg-background text-primary"
                >
                    Kako funkcionira
                </Button>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-secondary-foreground">
                <LandingCheckItem>
                    Gredica 2 × 1 m samo za tebe
                </LandingCheckItem>
                <LandingCheckItem>
                    Svi plodovi s tvoje gredice su tvoji
                </LandingCheckItem>
                <LandingCheckItem>Fotografije s terena</LandingCheckItem>
                <LandingCheckItem>Povrat ako biljka ne nikne</LandingCheckItem>
            </ul>
        </div>
    );
}
