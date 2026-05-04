import { ConfigurationNotice } from '../components/ConfigurationNotice';
import { OverallStatus } from '../components/OverallStatus';
import { ServiceStatusList } from '../components/ServiceStatusList';
import { SourceErrorNotice } from '../components/SourceErrorNotice';
import { StatusFooter } from '../components/StatusFooter';
import { StatusHeader } from '../components/StatusHeader';
import { getStatusPageData } from '../lib/status/getStatusPageData';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StatusPage() {
    const data = await getStatusPageData();

    return (
        <main className="min-h-dvh bg-background text-foreground">
            <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
                <StatusHeader updatedAt={data.updatedAt} />
                <div className="mt-10 flex flex-1 flex-col gap-5">
                    <OverallStatus
                        services={data.services}
                        status={data.overallStatus}
                    />
                    {!data.isConfigured && <ConfigurationNotice />}
                    {data.sourceError && (
                        <SourceErrorNotice message={data.sourceError} />
                    )}
                    <ServiceStatusList services={data.services} />
                </div>
                <StatusFooter />
            </div>
        </main>
    );
}
