import type { SocialProvider } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import Link from 'next/link';
import { getSocialProviderSetupGuide } from '../../../../../../src/social/providers/setupGuide';

export function SocialProviderInstructions({
    provider,
}: {
    provider: SocialProvider;
}) {
    const guide = getSocialProviderSetupGuide(provider);
    if (!guide) return null;

    return (
        <section className="space-y-4 rounded-lg border p-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold">Upute za instalaciju</h2>
                <p className="text-sm text-muted-foreground">
                    {guide.setupSummary}
                </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                    <div className="text-sm font-medium">Odredište</div>
                    <p className="text-sm text-muted-foreground">
                        {guide.destinationFormat}
                    </p>
                </div>

                <div className="space-y-2">
                    <div className="text-sm font-medium">Pristup</div>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {guide.requiredAccess.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </div>

                <div className="space-y-2">
                    <div className="text-sm font-medium">Environment</div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                        {guide.envVars.map((item) => (
                            <li key={item}>
                                <code>{item}</code>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="space-y-2">
                    <div className="text-sm font-medium">Mediji</div>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {guide.mediaNotes.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </div>
            </div>

            <Link href={guide.docsUrl} target="_blank" rel="noreferrer">
                <Button variant="outlined">Otvori dokumentaciju</Button>
            </Link>
        </section>
    );
}
