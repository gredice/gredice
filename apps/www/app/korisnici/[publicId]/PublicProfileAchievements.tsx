import {
    type getPublicProfile,
    getTopPublicAchievements,
} from './publicProfile';

export function PublicProfileAchievements({
    achievements,
}: Pick<Awaited<ReturnType<typeof getPublicProfile>>, 'achievements'>) {
    const topAchievements = getTopPublicAchievements(achievements);

    return (
        <section aria-labelledby="profile-achievements-heading">
            <h2
                id="profile-achievements-heading"
                className="mb-6 text-xl font-semibold"
            >
                Postignuća
            </h2>
            {topAchievements.length > 0 ? (
                <ul className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
                    {topAchievements.map((definition) => (
                        <li
                            key={definition.category}
                            className="flex flex-col items-center gap-3 text-center"
                        >
                            <span
                                aria-hidden="true"
                                className="flex size-20 items-center justify-center rounded-full border-4 border-yellow-400 bg-yellow-100 text-3xl shadow-[0_4px_0_0_theme(colors.yellow.600)] dark:border-yellow-600 dark:bg-yellow-900/30"
                            >
                                🏆
                            </span>
                            <div>
                                <h3 className="font-semibold">
                                    {definition.title}
                                </h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {definition.description}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Još nema otključanih postignuća.
                </p>
            )}
        </section>
    );
}
