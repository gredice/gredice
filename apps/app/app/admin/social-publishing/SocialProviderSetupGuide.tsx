import { getSocialProviderDefinition } from '../../../src/social/providers/definitions';
import { socialProviderSetupGuides } from '../../../src/social/providers/setupGuide';

export function SocialProviderSetupGuide() {
    return (
        <section className="space-y-4 rounded-lg border p-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold">Setup providera</h2>
                <p className="text-sm text-muted-foreground">
                    Direktno slanje koristi samo server-side API pozive iz
                    apps/app. Za svaki provider spremi tajne u environment,
                    postavi odredište u društvenom računu i drži allowlistu
                    uskom.
                </p>
                <p className="text-sm text-muted-foreground">
                    Za više računa dodaj ključ računa prije završnog polja, npr.{' '}
                    <code>
                        SOCIAL_PROVIDER_INSTAGRAM_BRAND_MAIN_ACCESS_TOKEN
                    </code>
                    .
                </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
                {socialProviderSetupGuides.map((guide) => {
                    const providerDefinition = getSocialProviderDefinition(
                        guide.provider,
                    );
                    return (
                        <details
                            key={guide.provider}
                            className="rounded-md border p-3"
                        >
                            <summary className="cursor-pointer text-sm font-semibold">
                                {providerDefinition?.label ?? guide.provider}
                            </summary>
                            <div className="mt-3 space-y-3 text-sm">
                                <p className="text-muted-foreground">
                                    {guide.setupSummary}
                                </p>

                                <div>
                                    <div className="font-medium">Odredište</div>
                                    <p className="text-muted-foreground">
                                        {guide.destinationFormat}
                                    </p>
                                </div>

                                <GuideList
                                    title="Pristup"
                                    items={guide.requiredAccess}
                                />
                                <GuideList title="Env" items={guide.envVars} />
                                <GuideList
                                    title="Mediji"
                                    items={guide.mediaNotes}
                                />

                                <a
                                    href={guide.docsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex text-blue-600 underline"
                                >
                                    Službena dokumentacija
                                </a>
                            </div>
                        </details>
                    );
                })}
            </div>
        </section>
    );
}

function GuideList({ title, items }: { title: string; items: string[] }) {
    return (
        <div>
            <div className="font-medium">{title}</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                {items.map((item) => (
                    <li key={item}>
                        {item.startsWith('SOCIAL_PROVIDER_') ? (
                            <code>{item}</code>
                        ) : (
                            item
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
