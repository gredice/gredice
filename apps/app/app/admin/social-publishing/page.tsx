import { listSocialPosts } from '@gredice/storage';
import { Card } from '@signalco/ui-primitives/Card';
import { auth } from '../../../lib/auth/auth';
import { SocialPublishingComposer } from './SocialPublishingComposer';

export default async function SocialPublishingPage() {
    await auth(['admin']);
    const recentPosts = await listSocialPosts({ provider: 'reddit' });

    return (
        <Card className="space-y-4 p-4">
            <h1 className="text-xl font-semibold">Društvene objave</h1>
            <p className="text-sm text-muted-foreground">
                Objavi odmah na podržani provider i prati status zadnjih objava.
            </p>
            <SocialPublishingComposer recentPosts={recentPosts.slice(0, 20)} />
        </Card>
    );
}
