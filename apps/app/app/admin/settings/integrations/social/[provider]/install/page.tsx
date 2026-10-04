import { listSocialAccounts } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '../../../../../../../lib/auth/auth';
import { KnownPages } from '../../../../../../../src/KnownPages';
import {
    getSocialProviderDefinition,
    isSocialProvider,
} from '../../../../../../../src/social/providers/definitions';
import { SocialIntegrationAccountForm } from '../../_components/SocialIntegrationAccountForm';
import { SocialIntegrationIcon } from '../../_components/SocialIntegrationIcon';
import { SocialProviderInstructions } from '../../_components/SocialProviderInstructions';

export default async function SocialIntegrationInstallPage({
    params,
}: {
    params: Promise<{ provider: string }>;
}) {
    await auth(['admin']);

    const { provider: providerParam } = await params;
    if (!isSocialProvider(providerParam)) notFound();

    const definition = getSocialProviderDefinition(providerParam);
    if (!definition) notFound();

    const existingAccounts = await listSocialAccounts({
        provider: providerParam,
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <SocialIntegrationIcon
                        provider={providerParam}
                        className="size-12 shrink-0"
                    />
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold">
                            Instaliraj {definition.label}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Dodaj novi račun za ovu platformu. Za više računa
                            koristi različit ključ računa.
                        </p>
                    </div>
                </div>
                <Link href={`${KnownPages.Settings}#integration-settings`}>
                    <Button variant="outlined">Natrag na integracije</Button>
                </Link>
            </div>

            <SocialProviderInstructions provider={providerParam} />

            {existingAccounts.length > 0 ? (
                <section className="space-y-3 rounded-lg border p-4">
                    <h2 className="text-lg font-semibold">
                        Postojeće konfiguracije
                    </h2>
                    <div className="grid gap-2 md:grid-cols-2">
                        {existingAccounts.map((account) => (
                            <Link
                                key={account.id}
                                href={KnownPages.SocialIntegrationAccount(
                                    account.provider,
                                    account.id,
                                )}
                                className="rounded-md border p-3 hover:bg-muted/40"
                            >
                                <div className="font-medium">
                                    {account.label}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {account.providerAccountKey}
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            ) : null}

            <SocialIntegrationAccountForm provider={providerParam} />
        </div>
    );
}
