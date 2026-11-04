import { getGardenBaseUrl } from '@gredice/js/urls';
import { Home, Mobile, Sprout } from '@gredice/ui/icons';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Typography } from '@gredice/ui/Typography';
import { getLandingPricing } from '../../app/getLandingPricing';
import DeliveryTruck from '../../assets/DeliveryTruck.webp';
import RaisedBedMaintenance from '../../assets/RaisedBedMaintenance.webp';
import SeedsAndTransplants from '../../assets/SeedsAndTransplants.webp';
import { formatPrice } from '../../lib/formatPrice';
import { KnownPages } from '../../src/KnownPages';
import { LandingCheckItem } from './LandingCheckItem';
import { LandingStepCard } from './LandingStepCard';

export const landingHowItWorksId = 'kako-funkcionira';

export async function LandingHowItWorks() {
    const pricing = await getLandingPricing();
    const minPlantPrice = pricing?.minPlantPrice;
    const deliveryZoneRadius = pricing?.delivery?.zoneRadius;

    return (
        <section
            aria-labelledby="landing-how-it-works-title"
            className="scroll-mt-24 py-14 sm:py-20"
            id={landingHowItWorksId}
        >
            <div className="flex flex-col gap-10">
                <div className="flex flex-wrap items-end gap-x-16 gap-y-4">
                    <div className="flex min-w-0 flex-[1_1_32rem] flex-col gap-3">
                        <Typography
                            level="body1"
                            semiBold
                            className="text-brand"
                        >
                            Kako funkcionira
                        </Typography>
                        <Typography
                            id="landing-how-it-works-title"
                            level="h2"
                            className="text-4xl sm:text-5xl"
                        >
                            <span className="whitespace-nowrap">Klikneš.</span>{' '}
                            <span className="whitespace-nowrap text-brand">
                                Mi sadimo.
                            </span>{' '}
                            <span className="whitespace-nowrap">
                                Ti uživaš.
                            </span>
                        </Typography>
                    </div>
                    <Typography
                        level="body1"
                        secondary
                        className="min-w-0 flex-[1_1_22rem] text-pretty text-lg leading-relaxed"
                    >
                        Dobivaš vlastitu podignutu gredicu od 2 m² na
                        partnerskom OPG-u. Ti u aplikaciji biraš što raste, tim
                        na OPG-u obavlja sav fizički rad, a plodove ti dostavimo
                        na kućni prag.
                    </Typography>
                </div>

                <ol
                    aria-label="Tri koraka do povrća iz tvoje gredice"
                    className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-6"
                >
                    <LandingStepCard
                        step={1}
                        timing="Danas, u par klikova"
                        actor="Ti, u aplikaciji"
                        actorIcon={<Mobile aria-hidden />}
                        image={SeedsAndTransplants}
                        imageAlt="Sjeme i presadnice"
                        title="Klikneš"
                        tagline="Složiš svoju gredicu u aplikaciji"
                        description="Odaberi povrće, začine i cvijeće i rasporedi ih po gredici onako kako ti se sviđa."
                        facts={
                            <>
                                <LandingCheckItem>
                                    Svih 18 polja uređuješ po svom
                                </LandingCheckItem>
                                <LandingCheckItem>
                                    Povrće, začinsko bilje i cvijeće
                                </LandingCheckItem>
                                {typeof minPlantPrice === 'number' ? (
                                    <LandingCheckItem>
                                        Sadnja već od{' '}
                                        {formatPrice(minPlantPrice)} po biljci
                                    </LandingCheckItem>
                                ) : null}
                            </>
                        }
                        href={KnownPages.FirstRaisedBedGuide}
                        linkLabel="Vodič za prvu gredicu"
                        showConnector
                    />
                    <LandingStepCard
                        step={2}
                        timing="Kroz cijelu sezonu"
                        actor="Tim na OPG-u"
                        actorIcon={<Sprout aria-hidden />}
                        highlighted
                        image={RaisedBedMaintenance}
                        imageAlt="Održavanje gredice"
                        title="Mi sadimo"
                        tagline="I brinemo o gredici umjesto tebe"
                        description="Pripremamo tlo, sadimo i njegujemo tvoje biljke na OPG-u. Ti pratiš rast iz fotelje i naručuješ radnje kad želiš."
                        facts={
                            <>
                                <LandingCheckItem>
                                    Priprema tla, sadnja, zalijevanje i njega
                                </LandingCheckItem>
                                <LandingCheckItem>
                                    Fotografije i obavijesti s terena
                                </LandingCheckItem>
                                <LandingCheckItem>
                                    Zapis svake radnje na tvojoj gredici
                                </LandingCheckItem>
                            </>
                        }
                        href={KnownPages.Operations}
                        linkLabel="Sve radnje i cijene"
                        showConnector
                    />
                    <LandingStepCard
                        step={3}
                        timing="Kad plodovi dozriju"
                        actor="Ti, kod kuće"
                        actorIcon={<Home aria-hidden />}
                        image={DeliveryTruck}
                        imageAlt="Dostava povrća"
                        title="Ti uživaš"
                        tagline="Svježe ubrano, ravno na tvoj prag"
                        description="Kad poželiš, klikni za berbu. Uberemo plodove tvoje gredice i dostavimo ih još svježe iz tvog vrta."
                        facts={
                            <>
                                <LandingCheckItem>
                                    Besplatna dostava u Gradu Zagrebu
                                </LandingCheckItem>
                                {typeof deliveryZoneRadius === 'number' ? (
                                    <LandingCheckItem>
                                        Dostava do{' '}
                                        {deliveryZoneRadius.toString()} km
                                        vožnje od Zagreba
                                    </LandingCheckItem>
                                ) : null}
                                <LandingCheckItem>
                                    Ili osobno preuzimanje u Zagrebu
                                </LandingCheckItem>
                            </>
                        }
                        href={KnownPages.Delivery}
                        linkLabel="Provjeri dostavu na svoju adresu"
                    />
                </ol>

                <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 rounded-2xl bg-muted p-6 sm:p-7">
                    <div className="flex min-w-0 flex-[1_1_26rem] flex-col gap-2">
                        <Typography level="h5" component="p">
                            Gredica od 2 m², samo tvoja
                        </Typography>
                        <Typography
                            level="body1"
                            secondary
                            className="text-pretty"
                        >
                            Plaćaš samo biljke i radnje koje odabereš. Ako
                            biljka ne nikne, puni iznos sadnje vraćamo na tvoj
                            saldo.
                        </Typography>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <NavigatingButton
                            href={getGardenBaseUrl()}
                            color="brand"
                        >
                            Složi svoju gredicu
                        </NavigatingButton>
                    </div>
                </div>
            </div>
        </section>
    );
}
