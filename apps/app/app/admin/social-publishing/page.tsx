import { listSocialAccounts, listSocialPosts } from '@gredice/storage';
import { auth } from '../../../lib/auth/auth';
import { SocialAccountsManager } from './SocialAccountsManager';
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
            <SocialAccountsManager accounts={accounts} />
            <SocialPublishingComposer
                accounts={accounts}
                recentPosts={recentPosts.slice(0, 20)}
            />
        </div>
    );
}
