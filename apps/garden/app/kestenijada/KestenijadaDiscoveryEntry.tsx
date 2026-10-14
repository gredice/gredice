import { directoriesClient } from '@gredice/client';
import {
    getKestenijadaAvailability,
    isKestenijadaEventActive,
    parseKestenijadaEventConfig,
} from '@gredice/js/kestenijada';
import Link from 'next/link';

/** Off by default; this entry never creates inventory or modifies a garden. */
export async function KestenijadaDiscoveryEntry() {
    const window = parseKestenijadaEventConfig(
        process.env.GREDICE_KESTENIJADA_EVENT_CONFIG,
    );
    if (!isKestenijadaEventActive(window, Date.now())) return null;
    try {
        const { data, error } = await directoriesClient().GET(
            '/entities/block',
            { signal: AbortSignal.timeout(5000) },
        );
        // A daytime entry must be usable without a night-only purchasing window.
        if (
            error ||
            !data ||
            !getKestenijadaAvailability(data, false).every((item) => item.row)
        )
            return null;
        return (
            <aside className="absolute top-4 left-4 z-20 rounded-xl bg-background p-3 shadow">
                <Link
                    href="/kestenijada"
                    prefetch={false}
                    className="underline"
                >
                    Posjeti Kestenijadu
                </Link>
            </aside>
        );
    } catch {
        return null;
    }
}
