import { Mobile, Sprout } from '@gredice/ui/icons';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Typography } from '@gredice/ui/Typography';
import { KnownPages } from '../../src/KnownPages';
import { LandingCheckItem } from './LandingCheckItem';
import { LandingFarmIllustration } from './LandingFarmIllustration';
import { LandingSectionHeader } from './LandingSectionHeader';

export function LandingResponsibilities() {
    return (
        <section
            aria-labelledby="landing-responsibilities-title"
            className="py-14 sm:py-20"
        >
            <div className="flex flex-col gap-10">
                <LandingSectionHeader
                    id="landing-responsibilities-title"
                    eyebrow="Nit oro, nit kopo"
                    title="Ti biraš. Sav fizički rad je na nama."
                    description="Tim na partnerskom OPG-u obavlja sve na terenu. Ti odlučuješ što raste, kad se radi i kad bereš."
                />
                <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                    <div className="flex flex-col gap-5 rounded-2xl border border-tertiary border-b-4 bg-card p-6 sm:p-7">
                        <div className="flex items-center gap-3">
                            <span
                                aria-hidden
                                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted dark:bg-accent"
                            >
                                <Mobile className="size-5" />
                            </span>
                            <Typography level="h4" component="h3">
                                Ti, u aplikaciji
                            </Typography>
                        </div>
                        <ul className="flex flex-col gap-3">
                            <LandingCheckItem>
                                Biraš biljke i raspored polja
                            </LandingCheckItem>
                            <LandingCheckItem>
                                Naručuješ radnje kad želiš
                            </LandingCheckItem>
                            <LandingCheckItem>
                                Pratiš fotografije, stanje i obavijesti
                            </LandingCheckItem>
                            <LandingCheckItem>
                                Klikneš za berbu i odabereš dostavu
                            </LandingCheckItem>
                        </ul>
                    </div>
                    <div className="flex flex-col gap-5 rounded-2xl border border-brand/40 border-b-4 bg-brand/10 p-6 sm:p-7">
                        <div className="flex items-center gap-3">
                            <span
                                aria-hidden
                                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground"
                            >
                                <Sprout className="size-5" />
                            </span>
                            <Typography level="h4" component="h3">
                                Tim na OPG-u
                            </Typography>
                        </div>
                        <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                            <LandingCheckItem>
                                Priprema tla u slojevima
                            </LandingCheckItem>
                            <LandingCheckItem>
                                Sadnja tvojih biljaka
                            </LandingCheckItem>
                            <LandingCheckItem>
                                Zalijevanje i prihrana
                            </LandingCheckItem>
                            <LandingCheckItem>
                                Zaštita i kontrola korova
                            </LandingCheckItem>
                            <LandingCheckItem>
                                Berba kad ti kažeš
                            </LandingCheckItem>
                            <LandingCheckItem>
                                Fotografije i zapisi svake radnje
                            </LandingCheckItem>
                        </ul>
                    </div>
                </div>
                <div className="flex flex-col gap-6 rounded-2xl border border-tertiary bg-card p-4 sm:flex-row sm:items-center sm:gap-8 sm:p-5">
                    <LandingFarmIllustration />
                    <div className="flex min-w-0 flex-col gap-2.5 px-1 pb-1 sm:p-0">
                        <Typography level="h5" component="h3">
                            Upoznaj OPG na kojem raste tvoj vrt
                        </Typography>
                        <Typography
                            level="body1"
                            secondary
                            className="text-pretty"
                        >
                            Gredice su na partnerskom OPG-u u Bosiljevu, u
                            Bjelovarsko-bilogorskoj županiji. Svaka gredica ima
                            svoj kod, pa je prepoznaješ na svakoj fotografiji s
                            terena.
                        </Typography>
                        <NavigatingButton
                            variant="link"
                            className="w-fit"
                            href={KnownPages.AboutUs}
                        >
                            O nama i našim OPG-ovima
                        </NavigatingButton>
                    </div>
                </div>
            </div>
        </section>
    );
}
