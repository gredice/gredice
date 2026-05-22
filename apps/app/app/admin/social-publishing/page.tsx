import { listSocialAccounts, listSocialPosts } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import Link from 'next/link';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
import { SocialIntegrationsOverview } from '../settings/integrations/social/_components/SocialIntegrationsOverview';
import { SocialPublishingComposer } from './SocialPublishingComposer';

export default async function SocialPublishingPage() {
    await auth(['admin']);
    const [accounts, recentPosts] = await Promise.all([
        listSocialAccounts(),
        listSocialPosts(),
    ]);

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-semibold">Društvene objave</h1>
            <p className="text-sm text-muted-foreground">
                Upravljanje objavama, redom i zakazanim slanjem za društvene
                kanale Gredica.
            </p>
            <section className="space-y-4 rounded-lg border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <h2 className="text-lg font-semibold">
                            Društvene integracije
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Instaliraj platforme i konfiguriraj račune prije
                            slanja objava.
                        </p>
                    </div>
                    <Link href={`${KnownPages.Settings}#integration-settings`}>
                        <Button variant="outlined">Otvori postavke</Button>
                    </Link>
                </div>
                <SocialIntegrationsOverview accounts={accounts} />
            </section>
            <SocialPublishingComposer
                accounts={accounts}
                recentPosts={recentPosts.slice(0, 20)}
            />
        </div>
    );
}
