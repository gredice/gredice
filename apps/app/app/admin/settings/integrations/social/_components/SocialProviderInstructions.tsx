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
    const formFields = [
        {
            label: 'Ključ računa',
            description: guide.formFields.providerAccountKey,
        },
        { label: 'Naziv', description: guide.formFields.label },
        { label: 'Handle', description: guide.formFields.handle },
        {
            label: 'Vanjski ID računa',
            description: guide.formFields.externalAccountId,
        },
        {
            label: 'Zadano odredište',
            description: guide.formFields.defaultDestination,
        },
        {
            label: 'Dopuštena odredišta',
            description: guide.formFields.allowedDestinations,
        },
        {
            label: 'Interna referenca',
            description: guide.formFields.credentialReference,
        },
        { label: 'Status', description: guide.formFields.status },
    ];

    return (
        <section className="space-y-4 rounded-lg border p-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold">Upute za instalaciju</h2>
                <p className="text-sm text-muted-foreground">
                    {guide.setupSummary}
                </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2 xl:col-span-2">
                    <div className="text-sm font-medium">
                        Koraci za prikupljanje podataka
                    </div>
                    <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                        {guide.setupSteps.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ol>
                </div>

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
                    <div className="text-sm font-medium">Podaci za pristup</div>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        {guide.credentialDetails.map((item) => (
                            <li key={item.label}>
                                <span className="font-medium text-foreground">
                                    {item.label}:
                                </span>{' '}
                                {item.description}
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

            <div className="space-y-2">
                <div className="text-sm font-medium">Što unijeti u obrazac</div>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {formFields.map((field) => (
                        <div key={field.label} className="space-y-1">
                            <dt className="font-medium">{field.label}</dt>
                            <dd className="text-muted-foreground">
                                {field.description}
                            </dd>
                        </div>
                    ))}
                </dl>
            </div>

            <Link href={guide.docsUrl} target="_blank" rel="noreferrer">
                <Button variant="outlined">Otvori dokumentaciju</Button>
            </Link>
        </section>
    );
}
