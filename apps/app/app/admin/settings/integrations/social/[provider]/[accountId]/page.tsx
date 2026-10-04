import { getSocialAccount } from '@gredice/storage';
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

export default async function SocialIntegrationAccountPage({
    params,
}: {
    params: Promise<{ provider: string; accountId: string }>;
}) {
    await auth(['admin']);

    const { provider: providerParam, accountId } = await params;
    if (!isSocialProvider(providerParam)) notFound();

    const accountIdNumber = Number(accountId);
    if (!Number.isInteger(accountIdNumber) || accountIdNumber <= 0) notFound();

    const [definition, account] = await Promise.all([
        getSocialProviderDefinition(providerParam),
        getSocialAccount(accountIdNumber),
    ]);
    if (!definition || !account || account.provider !== providerParam) {
        notFound();
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <SocialIntegrationIcon
                        provider={account.provider}
                        className="size-12 shrink-0"
                    />
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold">
                            {account.label}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {definition.label} · {account.providerAccountKey}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href={KnownPages.SocialIntegrationInstall(
                            account.provider,
                        )}
                    >
                        <Button variant="outlined">
                            Dodaj još jedan račun
                        </Button>
                    </Link>
                    <Link href={`${KnownPages.Settings}#integration-settings`}>
                        <Button variant="outlined">
                            Natrag na integracije
                        </Button>
                    </Link>
                </div>
            </div>

            <SocialIntegrationAccountForm
                provider={account.provider}
                account={account}
            />
        </div>
    );
}
