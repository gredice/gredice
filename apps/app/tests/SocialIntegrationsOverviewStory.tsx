import type { SelectSocialAccount } from '@gredice/storage';
import { SocialIntegrationsOverview } from '../app/admin/settings/integrations/social/_components/SocialIntegrationsOverview';

const createdAt = new Date('2026-11-20T10:00:00.000Z');

function account(
    id: number,
    provider: SelectSocialAccount['provider'],
    label: string,
    providerAccountKey: string,
): SelectSocialAccount {
    return {
        id,
        provider,
        providerAccountKey,
        label,
        handle: null,
        externalAccountId: null,
        status: 'active',
        defaultDestination: null,
        allowedDestinations: null,
        credentialReference: null,
        providerMetadata: null,
        createdAt,
        updatedAt: createdAt,
    };
}

const accounts = [
    account(
        1,
        'linkedin',
        'Gredice',
        'urn:li:organization:123456789012345678901234567890123456789012345',
    ),
    account(2, 'reddit', 'Gredice', 'u/gredice'),
];

export function SocialIntegrationsOverviewStory() {
    return (
        // Paddings of the admin frame, the content panel and the section
        // that holds the overview on the social publishing page.
        <div className="md:p-4">
            <div className="border p-3 md:p-4">
                <section className="rounded-lg border p-4">
                    <SocialIntegrationsOverview accounts={accounts} />
                </section>
            </div>
        </div>
    );
}
