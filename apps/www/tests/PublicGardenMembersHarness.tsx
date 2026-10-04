import type { PublicGardensResponse } from '@gredice/client';
import { PublicChromeProvider } from '@gredice/ui/PublicChrome';
import { PublicGardenCard } from '../app/vrtovi/PublicGardenCard';
import { PublicGardenMembers } from '../app/vrtovi/PublicGardenMembers';

export function PublicGardenMembersHarness({
    members,
    legacyResponse = false,
}: {
    members: PublicGardensResponse['items'][number]['members'];
    legacyResponse?: boolean;
}) {
    const garden: PublicGardensResponse['items'][number] = {
        id: 59,
        name: 'Zajednički vrt',
        members,
        owner: members[0] ?? null,
        activePlantCount: 31,
        likeCount: 2,
        backgroundPalette: 'current',
        homeCamera: null,
        isSandbox: false,
        previewImage: null,
        previewImages: { day: null, night: null },
        createdAt: '2026-07-07T00:00:00.000Z',
        updatedAt: '2026-09-21T00:00:00.000Z',
    };
    // Older API deployments do not return members yet.
    const cardGarden = legacyResponse
        ? { ...garden, members: undefined }
        : garden;

    return (
        <PublicChromeProvider>
            <main className="mx-auto max-w-3xl space-y-6 p-4">
                <h1 className="text-xl">Vrtovi</h1>
                <div className="max-w-sm" data-testid="garden-card">
                    <PublicGardenCard garden={cardGarden} />
                </div>
                <section
                    className="space-y-4 rounded-lg border bg-card p-4"
                    aria-label="Detalji vrta"
                >
                    <h2 className="text-xl">Zajednički vrt</h2>
                    <PublicGardenMembers gardenId={59} members={members} />
                </section>
            </main>
        </PublicChromeProvider>
    );
}
