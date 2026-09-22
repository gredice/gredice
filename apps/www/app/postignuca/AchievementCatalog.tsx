import {
    achievementXp,
    getAchievementFamilies,
} from '@gredice/js/achievements';
import {
    AchievementAward,
    AchievementLevelLabel,
} from '@gredice/ui/AchievementAwards';
import { Button } from '@gredice/ui/Button';
import { GameSunflowerIcon, GameTrophyIcon } from '@gredice/ui/GameIcons';
import { Link } from '@gredice/ui/Link';
import { KnownPages } from '../../src/KnownPages';
import { achievementAvailability } from './achievementAvailability';

const families = getAchievementFamilies([]);
const achievementCount = families.reduce(
    (total, family) => total + family.levels.length,
    0,
);

export function AchievementCatalog({ now }: { now: string }) {
    const date = new Date(now);

    return (
        <div className="space-y-12">
            <header className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
                <div className="max-w-2xl">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <GameTrophyIcon aria-hidden className="size-6" />
                        Tvoja zbirka raste s vrtom
                    </p>
                    <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                        Postignuća u Gredicama
                    </h1>
                    <p className="mt-4 text-lg text-muted-foreground">
                        Od prvog sjemena do bogate berbe: otkrij sve značke, što
                        trebaš učiniti za svaku i koliko suncokreta donosi.
                    </p>
                    <p className="mt-4 font-semibold">
                        {achievementCount} postignuća · {families.length} zbirki
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <Button
                            href={`${KnownPages.GardenApp}/?pregled=postignuca`}
                        >
                            Moja postignuća u vrtu
                        </Button>
                        <Button href={KnownPages.Users} variant="outlined">
                            Upoznaj druge vrtlare
                        </Button>
                    </div>
                </div>
                <div className="flex justify-center -space-x-5" aria-hidden>
                    <AchievementAward
                        achievementKey="planting_1"
                        className="mt-10 size-24 sm:size-36"
                    />
                    <AchievementAward
                        achievementKey="harvest_500"
                        className="size-32 sm:size-44"
                    />
                    <AchievementAward
                        achievementKey="garden_diversity_20"
                        className="mt-10 size-24 sm:size-36"
                    />
                </div>
            </header>

            <section
                aria-labelledby="earning-title"
                className="rounded-2xl bg-muted/50 p-5 sm:p-8"
            >
                <h2 id="earning-title" className="text-xl font-semibold">
                    Kako osvojiti postignuća?
                </h2>
                <div className="mt-4 grid gap-5 text-sm leading-relaxed md:grid-cols-3">
                    <p>
                        <strong className="block text-base">
                            Vrtlari i doprinosi
                        </strong>
                        Registriraj račun, sadi, naručuj zalijevanje i berbu ili
                        predloži izmjenu sadržaja. Računaju se evidentirane
                        sadnje, izvršene radnje i prihvaćene izmjene.
                    </p>
                    <p>
                        <strong className="block text-base">
                            Pričekaj potvrdu
                        </strong>
                        Dobrodošlica se odobrava automatski. Ostala postignuća
                        nakon ispunjenja uvjeta čekaju potvrdu. Status svoje
                        zbirke možeš pratiti u vrtu.
                    </p>
                    <p>
                        <strong className="block text-base">
                            Prikupi nagrade
                        </strong>
                        Svako odobreno postignuće donosi {achievementXp} XP i
                        prikazani broj{' '}
                        <Link
                            href={KnownPages.Sunflowers}
                            className="underline underline-offset-4"
                        >
                            suncokreta
                        </Link>
                        . Nagradu za svako postignuće dobivaš jednom. XP
                        povećava tvoju razinu i ne troši se kupnjom.
                    </p>
                </div>
                <Link
                    href={KnownPages.Experience}
                    className="mt-5 inline-block text-sm underline underline-offset-4"
                >
                    Kako skupljati XP i napredovati kroz razine
                </Link>
            </section>

            <nav
                aria-label="Zbirke postignuća"
                className="flex flex-wrap gap-2"
            >
                {families.map((family) => (
                    <Link
                        key={family.key}
                        href={`#${family.key}`}
                        className="rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        {family.label}{' '}
                        <span className="text-muted-foreground">
                            ({family.levels.length})
                        </span>
                    </Link>
                ))}
            </nav>

            {families.map((family) => (
                <section
                    key={family.key}
                    id={family.key}
                    aria-labelledby={`${family.key}-title`}
                    className="scroll-mt-24"
                >
                    <h2
                        id={`${family.key}-title`}
                        className="text-2xl font-semibold"
                    >
                        {family.label}
                    </h2>
                    {family.key === 'garden_diversity' && (
                        <p className="mt-2 text-muted-foreground">
                            Broje se različite vrste biljaka; više sorti iste
                            biljke računa se kao jedna vrsta.
                        </p>
                    )}
                    {family.key === 'seed_to_table' && (
                        <p className="mt-2 text-muted-foreground">
                            Sjetva i berba moraju pripadati istoj sadnji.
                        </p>
                    )}
                    {family.key === 'seasonal' && (
                        <p className="mt-2 max-w-3xl text-muted-foreground">
                            Vrijedi datum potvrđene sadnje ili berbe od sjemena
                            do stola, prema vremenu u Hrvatskoj. Aktivnosti
                            izvan navedenog razdoblja ne računaju se za tu
                            sezonu. Završene sezone ostaju dio zbirke.
                        </p>
                    )}
                    <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {family.levels.map(({ definition }) => (
                            <li
                                key={definition.key}
                                id={
                                    definition.key === family.key
                                        ? undefined
                                        : definition.key
                                }
                                className="flex scroll-mt-24 flex-col rounded-2xl border bg-card p-5"
                                data-catalog-achievement={definition.key}
                            >
                                <div className="flex items-center gap-3">
                                    <AchievementAward
                                        achievementKey={definition.key}
                                        className="size-24 shrink-0"
                                        aria-hidden
                                    />
                                    <div className="min-w-0">
                                        {family.key !== 'seasonal' && (
                                            <AchievementLevelLabel
                                                level={definition.level}
                                                total={family.levels.length}
                                            />
                                        )}
                                        <h3 className="mt-1 text-lg font-semibold leading-snug">
                                            {definition.title.trim()}
                                        </h3>
                                    </div>
                                </div>
                                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                                    {definition.description}
                                </p>
                                <p className="mt-3 text-xs font-medium text-muted-foreground">
                                    {achievementAvailability(
                                        definition.key,
                                        date,
                                    )}
                                </p>
                                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-5 text-sm font-semibold">
                                    <span className="flex items-center gap-1.5">
                                        <GameSunflowerIcon
                                            aria-hidden
                                            className="size-5"
                                        />
                                        {definition.rewardSunflowers.toLocaleString(
                                            'hr-HR',
                                        )}{' '}
                                        suncokreta
                                    </span>
                                    <span className="text-muted-foreground">
                                        +{achievementXp} XP
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    );
}
