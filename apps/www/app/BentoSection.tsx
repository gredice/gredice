import { Bell, Droplets, MapPinHouse, Truck } from '@signalco/ui-icons';
import Image from 'next/image';

export function BentoSection() {
    return (
        <section id="vrt" className="py-20 md:py-28">
            <div className="max-w-2xl mb-12 md:mb-16">
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-medium">
                    — Tvoj vrt, tvoja pravila
                </p>
                <h2 className="mt-3 text-4xl md:text-6xl font-semibold text-primary leading-[1.05]">
                    Sve što trebaš za
                    <br />
                    <span className="italic text-tomato">svježi tanjur</span>.
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-5 auto-rows-[minmax(180px,auto)]">
                <article className="md:col-span-4 md:row-span-2 rounded-2xl bg-primary text-primary-foreground p-8 md:p-10 flex flex-col justify-between relative overflow-hidden border border-tertiary border-b-4">
                    <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-accent/30 blur-2xl" />
                    <div className="flex items-center gap-2 text-sm font-medium opacity-80">
                        <MapPinHouse className="size-4" /> Tvoja gredica uživo
                    </div>
                    <div className="relative">
                        <Image
                            alt="Biljka rajčice"
                            className="mb-4 h-24 w-24 md:h-32 md:w-32 object-contain"
                            height={128}
                            src="/assets/vegetables/tomato-realistic-340.png"
                            width={128}
                        />
                        <h3 className="text-3xl md:text-5xl font-medium leading-tight">
                            Prati rast svoje rajčice,
                            <br />
                            <span className="italic opacity-90">
                                od sadnje do berbe.
                            </span>
                        </h3>
                        <p className="mt-4 max-w-md text-primary-foreground/80">
                            U aplikaciji pratiš što se događa u tvojoj gredici i
                            naručuješ radnje kad ti odgovara.
                        </p>
                    </div>
                </article>

                <article className="md:col-span-2 rounded-2xl bg-sky/20 p-6 flex flex-col justify-between border border-tertiary border-b-4">
                    <Droplets className="size-8 text-primary" />
                    <div>
                        <h3 className="text-2xl font-semibold text-primary">
                            Radnje po potrebi
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Zalijevanje, okopavanje i ostale radnje naručuješ u
                            par klikova.
                        </p>
                    </div>
                </article>

                <article className="md:col-span-2 rounded-2xl bg-accent p-6 flex flex-col justify-between text-accent-foreground border border-tertiary border-b-4">
                    <Truck className="size-8" />
                    <div>
                        <h3 className="text-2xl font-semibold">
                            Besplatna dostava
                        </h3>
                        <p className="text-sm opacity-80 mt-1">
                            Nakon berbe povrće ti dostavljamo još svježe na
                            kućni prag (područje Zagreba).
                        </p>
                    </div>
                </article>

                <article className="md:col-span-2 rounded-2xl bg-tomato text-tomato-foreground p-6 flex flex-col justify-between border border-tertiary border-b-4">
                    <MapPinHouse className="size-8" />
                    <div>
                        <h3 className="text-2xl font-semibold">
                            Lokalni OPG-ovi
                        </h3>
                        <p className="text-sm opacity-90 mt-1">
                            Tvoje gredice sadimo i održavamo kroz mrežu lokalnih
                            OPG partnera.
                        </p>
                    </div>
                </article>

                <article className="md:col-span-2 rounded-2xl bg-background border border-tertiary border-b-4 p-6 flex flex-col justify-between">
                    <Bell className="size-8 text-primary" />
                    <div>
                        <h3 className="text-2xl font-semibold text-primary">
                            Obavijesti i fotke
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Redovito dobivaš novosti iz vrta, fotke i korisne
                            savjete za svoje biljke.
                        </p>
                    </div>
                </article>
            </div>
        </section>
    );
}
