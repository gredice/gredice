import { AboutValueCard } from '@apps/www/app/o-nama/AboutValueCard';
import { AttributeCard } from '@apps/www/components/attributes/DetailCard';
import { PlantHealthIssueCard } from '@apps/www/components/plant-health/PlantHealthIssueCard';
import { PublicGardenIllustration } from '@apps/www/components/visuals/PublicGardenIllustration';
import {
    GameCommunityIcon,
    GameGlobeIcon,
    GameIdeaIcon,
    GamePlantDiseaseIcon,
    GamePlantPestIcon,
    GameSeedlingIcon,
    GameThermometerIcon,
    GameWaterIcon,
} from '@gredice/ui/GameIcons';
import { OperationImage } from '@gredice/ui/OperationImage';

export function PublicVisualExamples() {
    return (
        <div className="space-y-8">
            <section aria-label="Editorial artwork" className="space-y-3">
                <h2 className="text-xl font-semibold">Veće ilustracije</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                    {(
                        [
                            { kind: 'delivery', title: 'Dostava' },
                            { kind: 'sowing', title: 'Sjetva' },
                            { kind: 'care', title: 'Briga o gredici' },
                        ] as const
                    ).map(({ kind, title }) => (
                        <figure
                            key={kind}
                            className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4"
                        >
                            <PublicGardenIllustration kind={kind} />
                            <figcaption className="font-medium">
                                {title}
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </section>
            <section aria-label="About value cards" className="space-y-3">
                <h2 className="text-xl font-semibold">Naše vrijednosti</h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <AboutValueCard
                        icon={
                            <GameSeedlingIcon aria-hidden className="size-16" />
                        }
                        title="Priroda"
                        description="Briga o biljkama i prirodi."
                        microCopy="Od sjemena do berbe."
                    />
                    <AboutValueCard
                        icon={
                            <GameCommunityIcon
                                aria-hidden
                                className="size-16"
                            />
                        }
                        title="Zajednica"
                        description="Vrtlarimo i učimo zajedno."
                        microCopy="Podijeli svoje iskustvo."
                    />
                    <AboutValueCard
                        icon={<GameGlobeIcon aria-hidden className="size-16" />}
                        title="Dostupnost"
                        description="Vrt koji je uvijek uz tebe."
                        microCopy="Tvoj vrt, gdje god bio 🌱"
                    />
                    <AboutValueCard
                        icon={<GameIdeaIcon aria-hidden className="size-16" />}
                        title="Tehnologija"
                        description="Jednostavnija briga o vrtu."
                        microCopy="Više vremena za prirodu."
                    />
                </div>
            </section>
            <section
                aria-label="Plant health category artwork"
                className="space-y-3"
            >
                <h2 className="text-xl font-semibold">Zdravlje biljaka</h2>
                <p className="text-sm text-secondary-foreground">
                    Ilustracije označavaju kategoriju; nisu fotografije određene
                    bolesti ili nametnika.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-3">
                        <GamePlantDiseaseIcon
                            aria-label="Ilustracija kategorije bolesti biljaka"
                            className="mx-auto size-48"
                        />
                        <PlantHealthIssueCard
                            issue={{
                                id: 1,
                                href: '/bolesti',
                                title: 'Bolesti biljaka',
                                kind: 'disease',
                                shortDescription:
                                    'Prepoznavanje simptoma i briga o biljkama.',
                            }}
                        />
                    </div>
                    <div className="space-y-3">
                        <GamePlantPestIcon
                            aria-label="Ilustracija kategorije nametnika biljaka"
                            className="mx-auto size-48"
                        />
                        <PlantHealthIssueCard
                            issue={{
                                id: 2,
                                href: '/stetnici',
                                title: 'Nametnici biljaka',
                                kind: 'pest',
                                shortDescription:
                                    'Prepoznavanje nametnika i zaštita biljaka.',
                            }}
                        />
                    </div>
                </div>
            </section>
            <section aria-label="Plant attribute icons" className="space-y-3">
                <h2 className="text-xl font-semibold">Podaci o biljci</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    <AttributeCard
                        icon={<GameWaterIcon aria-hidden />}
                        header="Voda"
                        value="Umjereno"
                    />
                    <AttributeCard
                        icon={<GameThermometerIcon aria-hidden />}
                        header="Temperatura klijanja"
                        value="18–24 °C"
                    />
                </div>
            </section>
            <section
                aria-label="Operation category image fallbacks"
                className="space-y-3"
            >
                <h2 className="text-xl font-semibold">
                    Radnje bez naslovne slike
                </h2>
                <div className="flex flex-wrap gap-4">
                    {[
                        { name: 'watering', label: 'Zalijevanje' },
                        { name: 'flowering', label: 'Cvjetanje' },
                        { name: 'harvest', label: 'Berba' },
                    ].map(({ name, label }) => (
                        <figure
                            key={name}
                            className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4"
                        >
                            <OperationImage
                                variant="game"
                                size={144}
                                operation={{
                                    information: { label },
                                    attributes: {
                                        category: { information: { name } },
                                    },
                                }}
                            />
                            <figcaption>{label}</figcaption>
                        </figure>
                    ))}
                </div>
            </section>
        </div>
    );
}
