import type {
    SelectSocialAccount,
    SocialAccountStatus,
    SocialProvider,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Add } from '@gredice/ui/icons';
import Link from 'next/link';
import { KnownPages } from '../../../../../../src/KnownPages';
import { socialProviderDefinitions } from '../../../../../../src/social/providers/definitions';
import { SocialIntegrationIcon } from './SocialIntegrationIcon';

type SocialIntegrationsOverviewProps = {
    accounts: SelectSocialAccount[];
};

function accountStatusLabel(status: SocialAccountStatus) {
    if (status === 'active')
        return { label: 'Aktivan', color: 'success' as const };
    if (status === 'needs_reauth')
        return { label: 'Treba prijavu', color: 'warning' as const };
    return { label: 'Onemogućen', color: 'neutral' as const };
}

function providerAccounts(
    accounts: SelectSocialAccount[],
    provider: SocialProvider,
) {
    return accounts.filter((account) => account.provider === provider);
}

export function SocialIntegrationsOverview({
    accounts,
}: SocialIntegrationsOverviewProps) {
    return (
        <div className="grid gap-3 lg:grid-cols-2">
            {socialProviderDefinitions.map((definition) => {
                const installedAccounts = providerAccounts(
                    accounts,
                    definition.name,
                );
                const installed = installedAccounts.length > 0;

                return (
                    <section
                        key={definition.name}
                        className="flex flex-col gap-4 rounded-lg border p-4"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <SocialIntegrationIcon
                                    provider={definition.name}
                                    className="size-10 shrink-0"
                                />
                                <div className="min-w-0">
                                    <h3 className="text-base font-semibold">
                                        {definition.label}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {installed
                                            ? `${installedAccounts.length} instalirano`
                                            : 'Nije instalirano'}
                                    </p>
                                </div>
                            </div>
                            {installed ? (
                                <Link
                                    href={KnownPages.SocialIntegrationInstall(
                                        definition.name,
                                    )}
                                >
                                    <Button variant="outlined" size="sm">
                                        <Add className="size-4" />
                                        Dodaj račun
                                    </Button>
                                </Link>
                            ) : (
                                <Link
                                    href={KnownPages.SocialIntegrationInstall(
                                        definition.name,
                                    )}
                                >
                                    <Button variant="solid" size="sm">
                                        <SocialIntegrationIcon
                                            provider={definition.name}
                                            className="size-4 shrink-0"
                                        />
                                        Instaliraj
                                    </Button>
                                </Link>
                            )}
                        </div>

                        {installed ? (
                            <div className="space-y-2">
                                {installedAccounts.map((account) => {
                                    const status = accountStatusLabel(
                                        account.status,
                                    );

                                    return (
                                        <div
                                            key={account.id}
                                            className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-medium">
                                                        {account.label}
                                                    </span>
                                                    <Chip
                                                        color={status.color}
                                                        size="sm"
                                                    >
                                                        {status.label}
                                                    </Chip>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {account.providerAccountKey}
                                                </p>
                                            </div>
                                            <Link
                                                href={KnownPages.SocialIntegrationAccount(
                                                    account.provider,
                                                    account.id,
                                                )}
                                            >
                                                <Button
                                                    variant="outlined"
                                                    size="sm"
                                                >
                                                    Konfiguriraj
                                                </Button>
                                            </Link>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : null}
                    </section>
                );
            })}
        </div>
    );
}
