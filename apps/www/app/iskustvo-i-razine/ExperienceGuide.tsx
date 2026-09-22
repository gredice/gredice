import {
    achievementXp,
    getAchievementDefinitions,
    getAchievementProgress,
} from '@gredice/js/achievements';
import { Button } from '@gredice/ui/Button';
import { GameSunflowerIcon, GameTrophyIcon } from '@gredice/ui/GameIcons';
import { Link } from '@gredice/ui/Link';
import {
    UserAchievementProgress,
    UserLevelBadge,
} from '@gredice/ui/UserAvatar';
import { KnownPages } from '../../src/KnownPages';

// Use the same calculation as profiles, including every currently defined award.
const thresholds = Array.from(
    { length: getAchievementDefinitions().length + 1 },
    (_, count) => getAchievementProgress(count),
).filter(({ xp, levelXp }) => xp === levelXp);
const example = getAchievementProgress(5);
const format = (value: number) => value.toLocaleString('hr-HR');

export function ExperienceGuide() {
    return (
        <div className="space-y-12">
            <header className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
                <div className="max-w-2xl">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <GameTrophyIcon aria-hidden className="size-6" />
                        Tvoj napredak u vrtu
                    </p>
                    <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                        XP i razine u Gredicama
                    </h1>
                    <p className="mt-4 text-lg text-muted-foreground">
                        Svako odobreno postignuće donosi {achievementXp} bodova
                        iskustva (XP). Iskustvo se zbraja, a tvoja razina raste
                        kad dosegneš sljedeći prag.
                    </p>
                    <p className="mt-4 text-muted-foreground">
                        XP prati tvoja postignuća. Suncokreti su zaseban saldo
                        koji koristiš u vrtu. Trošenjem suncokreta ne gubiš XP
                        ni razinu.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <Button
                            href={`${KnownPages.GardenApp}/?pregled=postignuca`}
                        >
                            Moja postignuća u vrtu
                        </Button>
                        <Button href="#pragovi" variant="outlined">
                            Pogledaj pragove razina
                        </Button>
                    </div>
                </div>
                <aside
                    aria-label="Primjer napretka"
                    className="rounded-2xl border bg-card p-6 md:w-72"
                >
                    <div className="flex items-center gap-2 font-semibold">
                        <UserLevelBadge level={example.level} />
                        Primjer: {example.achievementCount} postignuća
                    </div>
                    <UserAchievementProgress
                        achievementCount={example.achievementCount}
                    />
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                        Još {format(example.xpToNextLevel / achievementXp)}{' '}
                        odobreno postignuće donosi{' '}
                        {format(example.xpToNextLevel)} XP do razine{' '}
                        {example.level + 1}.
                    </p>
                </aside>
            </header>

            <section
                aria-labelledby="skupljanje"
                className="rounded-2xl bg-muted/50 p-5 sm:p-8"
            >
                <h2 id="skupljanje" className="text-2xl font-semibold">
                    Kako skupljaš XP?
                </h2>
                <ol className="mt-5 grid gap-6 text-sm leading-relaxed md:grid-cols-3">
                    <li>
                        <h3 className="mb-2 text-base font-semibold">
                            1. Ispuni uvjete postignuća
                        </h3>
                        Sadnja, izvršeno zalijevanje i berba, raznolikost vrta
                        te prihvaćene izmjene sadržaja vode do postignuća. XP se
                        dobiva za postignuće, a ne za svaku pojedinu radnju ili
                        kupnju suncokreta.
                    </li>
                    <li>
                        <h3 className="mb-2 text-base font-semibold">
                            2. Pričekaj odobrenje
                        </h3>
                        Dobrodošlica se odobrava automatski. Ostala postignuća
                        nakon ispunjenja uvjeta čekaju potvrdu. Postignuća na
                        čekanju i odbijena postignuća ne ulaze u XP.
                    </li>
                    <li>
                        <h3 className="mb-2 text-base font-semibold">
                            3. Prati svoju razinu
                        </h3>
                        Svako različito odobreno postignuće računa se jednom i
                        donosi {achievementXp} XP, bez obzira na iznos nagrade u
                        suncokretima. Računaju se i ranije odobrena postignuća.
                    </li>
                </ol>
                <Link
                    href={KnownPages.Achievements}
                    className="mt-5 inline-block text-sm underline underline-offset-4"
                >
                    Pogledaj sva postignuća, uvjete i nagrade
                </Link>
            </section>

            <section
                id="pragovi"
                aria-labelledby="pragovi-title"
                className="scroll-mt-24"
            >
                <h2 id="pragovi-title" className="text-2xl font-semibold">
                    Kada prelaziš na sljedeću razinu?
                </h2>
                <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
                    Počinješ na razini 1 s 0 XP. Kad dosegneš prag, razina se
                    povećava automatski, a ukupni XP ostaje. Svaki sljedeći
                    korak traži više postignuća: za razinu 2 treba jedno, za
                    razinu 3 ukupno tri, a za razinu 4 ukupno šest.
                </p>
                <div className="mt-6 overflow-hidden rounded-2xl border">
                    <table className="w-full text-left text-sm tabular-nums">
                        <caption className="border-b bg-muted/30 p-4 text-left font-medium">
                            Pragovi razina prema ukupnom broju odobrenih
                            postignuća
                        </caption>
                        <thead className="bg-muted/50">
                            <tr>
                                <th scope="col" className="p-3 sm:px-5">
                                    Razina
                                </th>
                                <th scope="col" className="p-3 sm:px-5">
                                    Ukupno XP
                                </th>
                                <th scope="col" className="p-3 sm:px-5">
                                    Odobrena postignuća
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {thresholds.map(
                                ({ level, xp, achievementCount }) => (
                                    <tr key={level}>
                                        <th scope="row" className="p-3 sm:px-5">
                                            <UserLevelBadge level={level} />
                                        </th>
                                        <td className="p-3 sm:px-5">
                                            {format(xp)} XP
                                        </td>
                                        <td className="p-3 sm:px-5">
                                            {achievementCount}
                                        </td>
                                    </tr>
                                ),
                            )}
                        </tbody>
                    </table>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Tablica prikazuje pragove obuhvaćene trenutačnim katalogom
                    postignuća. Sezonska postignuća imaju svoja razdoblja
                    dostupnosti. Kad osvojiš sva postignuća iz kataloga, profil
                    prikazuje poruku „Sva postignuća osvojena!” umjesto
                    preostalog XP-a do sljedeće razine.
                </p>
            </section>

            <section aria-labelledby="razlika">
                <h2 id="razlika" className="text-2xl font-semibold">
                    XP i suncokreti: što je razlika?
                </h2>
                <dl className="mt-5 grid gap-6 sm:grid-cols-2">
                    <div className="border-t-2 border-primary pt-4">
                        <dt className="flex items-center gap-2 text-lg font-semibold">
                            <GameTrophyIcon aria-hidden className="size-6" />{' '}
                            Iskustvo (XP)
                        </dt>
                        <dd className="mt-2 leading-relaxed text-muted-foreground">
                            Zbroj bodova za odobrena postignuća određuje tvoju
                            razinu. XP se ne troši, ne kupuje i ne zamjenjuje za
                            suncokrete.
                        </dd>
                    </div>
                    <div className="border-t-2 border-tertiary pt-4">
                        <dt className="flex items-center gap-2 text-lg font-semibold">
                            <GameSunflowerIcon aria-hidden className="size-6" />{' '}
                            Suncokreti
                        </dt>
                        <dd className="mt-2 leading-relaxed text-muted-foreground">
                            Saldo za vrtne akcije. Možeš ih kupiti ili dobiti
                            kao nagradu. Iznos nagrade ovisi o postignuću, a
                            trošenje salda ne mijenja tvoj XP.
                        </dd>
                    </div>
                </dl>
                <p className="mt-5 leading-relaxed text-muted-foreground">
                    Viša korisnička razina oznaka je napretka. Sama promjena
                    razine ne dodaje nagradu u suncokretima: nagrade pripadaju
                    postignućima. Odobreno postignuće ulazi u XP i kad se
                    njegova nagrada u suncokretima još obrađuje ili iznosi nula.
                </p>
                <Link
                    href={KnownPages.Sunflowers}
                    className="mt-4 inline-block underline underline-offset-4"
                >
                    Kako funkcioniraju suncokreti
                </Link>
            </section>

            <section aria-labelledby="profil" className="border-t pt-8">
                <h2 id="profil" className="text-2xl font-semibold">
                    Gdje vidiš svoj napredak?
                </h2>
                <div className="mt-3 max-w-3xl space-y-3 leading-relaxed text-muted-foreground">
                    <p>
                        U svom profilu u vrtu i na javnom profilu vidiš razinu,
                        ukupni XP i napredak do sljedeće razine. Značka uz
                        avatar pokazuje tvoju korisničku razinu.
                    </p>
                    <p>
                        Za napredak se računaju odobrena postignuća s primarnog
                        računa, odnosno računa kojem si se prvo pridružio.
                        Postignuća s više računa ne zbrajaju se.
                    </p>
                    <p>
                        Javni profil iz svake zbirke prikazuje najviše osvojeno
                        postignuće. U XP ulaze i ranije odobrene razine te
                        zbirke, pa broj prikazanih znački može biti manji od
                        broja postignuća koja se računaju za XP. Razina
                        postignuća unutar zbirke nije isto što i tvoja
                        korisnička razina.
                    </p>
                </div>
                <Link
                    href={KnownPages.Users}
                    className="mt-4 inline-block underline underline-offset-4"
                >
                    Pogledaj ljestvicu vrtlara
                </Link>
            </section>
        </div>
    );
}
