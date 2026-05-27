import Link from 'next/link';
import { EntityViewerDynamic } from './EntityViewerDynamic';

type EntityDebugParams = Promise<{ entityName: string }>;
type EntityDebugSearchParams = Promise<
    Record<string, string | string[] | undefined>
>;

function firstValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function resolveNumber(value: string | undefined) {
    if (!value) return undefined;

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function DebugEntityPage({
    params,
    searchParams,
}: {
    params: EntityDebugParams;
    searchParams: EntityDebugSearchParams;
}) {
    const [{ entityName }, query] = await Promise.all([params, searchParams]);
    const zoom = resolveNumber(firstValue(query.zoom));
    const rotation = resolveNumber(firstValue(query.rotation));
    const staticEnvironment = firstValue(query.static) === '1';
    const noControl = firstValue(query.controls) === '0';

    return (
        <main className="flex h-screen w-screen flex-col bg-[#e7e2cc]">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-950 p-4">
                <div>
                    <h1 className="text-xl font-bold text-white">
                        {entityName}
                    </h1>
                    <p className="text-sm text-neutral-400">
                        Single entity debug view
                    </p>
                </div>
                <nav className="flex items-center gap-3 text-sm">
                    <Link
                        href="/debug"
                        className="text-neutral-300 underline-offset-4 hover:text-white hover:underline"
                    >
                        Debug index
                    </Link>
                    <Link
                        href="/debug/entities"
                        className="text-neutral-300 underline-offset-4 hover:text-white hover:underline"
                    >
                        All entities
                    </Link>
                </nav>
            </header>
            <div className="min-h-0 flex-1">
                <EntityViewerDynamic
                    entityName={entityName}
                    noControl={noControl}
                    rotation={rotation}
                    staticEnvironment={staticEnvironment}
                    zoom={zoom}
                />
            </div>
        </main>
    );
}
