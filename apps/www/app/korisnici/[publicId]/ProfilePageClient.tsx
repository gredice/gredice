'use client';

import { clientPublic } from '@gredice/client';
import { getAchievementDefinition } from '@gredice/js/achievements';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PublicGardenViewerDynamic } from './PublicGardenViewerDynamic';

type ProfilePageClientProps = {
    publicId: string;
};

function mapStacks(
    stacks: Record<
        string,
        Record<
            string,
            {
                id: string;
                name: string;
                rotation?: number | null;
                variant?: number | null;
            }[]
        >
    >,
) {
    return Object.entries(stacks).flatMap(([x, rows]) =>
        Object.entries(rows).map(([y, blocks]) => ({
            x: Number(x),
            y: Number(y),
            blocks: blocks.map((block) => ({
                id: block.id,
                name: block.name,
                rotation: block.rotation ?? 0,
                variant: block.variant,
            })),
        })),
    );
}

export function ProfilePageClient({ publicId }: ProfilePageClientProps) {
    const profileQuery = useQuery({
        queryKey: ['public-profile', publicId],
        queryFn: async () => {
            const response = await clientPublic().api.users.public[
                ':publicId'
            ].profile.$get({
                param: { publicId },
            });
            if (!response.ok) {
                throw new Error('Profil nije pronađen.');
            }
            return response.json();
        },
    });

    const [selectedGardenId, setSelectedGardenId] = useState<number | null>(
        null,
    );

    const activeGardenId =
        selectedGardenId ?? profileQuery.data?.gardens[0]?.id ?? null;

    const gardenQuery = useQuery({
        queryKey: ['public-garden', activeGardenId],
        enabled: Boolean(activeGardenId),
        queryFn: async () => {
            const response = await clientPublic().api.gardens[
                ':gardenId'
            ].public.$get({
                param: {
                    gardenId: String(activeGardenId),
                },
            });
            if (!response.ok) {
                throw new Error('Vrt nije dostupan.');
            }
            return response.json();
        },
    });

    const approvedAchievements =
        profileQuery.data?.achievements.filter(
            (achievement) => achievement.status === 'approved',
        ) ?? [];

    const gardenStacks = useMemo(
        () => (gardenQuery.data ? mapStacks(gardenQuery.data.stacks) : []),
        [gardenQuery.data],
    );

    if (profileQuery.isLoading) {
        return <p>Učitavanje profila...</p>;
    }

    if (profileQuery.error || !profileQuery.data) {
        return <p>Traženi profil ne postoji ili nije javno dostupan.</p>;
    }

    const { user, gardens } = profileQuery.data;

    return (
        <Stack spacing={6} className="pb-12">
            <section className="rounded-2xl border border-black/10 bg-background/90 p-6">
                <h1 className="text-3xl font-semibold">{user.displayName}</h1>
                <p className="text-sm text-muted-foreground">
                    @{user.userName} · {gardens.length} vrtova
                </p>
            </section>

            <section className="rounded-2xl border border-black/10 bg-background/90 p-6">
                <h2 className="text-xl font-semibold mb-4">Postignuća</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {approvedAchievements.length > 0 ? (
                        approvedAchievements.map((achievement) => {
                            const definition = getAchievementDefinition(
                                achievement.key,
                            );
                            return (
                                <article
                                    key={achievement.id}
                                    className="rounded-xl border border-black/10 bg-emerald-50/70 p-4"
                                >
                                    <p className="font-medium">
                                        {definition?.title ?? achievement.key}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {definition?.description ??
                                            'Postignuće otključano.'}
                                    </p>
                                </article>
                            );
                        })
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Još nema otključanih postignuća.
                        </p>
                    )}
                </div>
            </section>

            <section className="rounded-2xl border border-black/10 bg-background/90 p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                    <h2 className="text-xl font-semibold">Vrt</h2>
                    <label className="text-sm flex items-center gap-2">
                        <span>Odaberi vrt:</span>
                        <select
                            className="rounded-md border border-black/20 bg-background px-2 py-1"
                            value={activeGardenId ?? ''}
                            onChange={(event) =>
                                setSelectedGardenId(
                                    Number.parseInt(event.target.value, 10),
                                )
                            }
                        >
                            {gardens.map((garden) => (
                                <option key={garden.id} value={garden.id}>
                                    {garden.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="h-[520px] rounded-2xl overflow-hidden border border-black/10">
                    {gardenQuery.isLoading ? (
                        <p className="p-4">Učitavanje vrta...</p>
                    ) : gardenQuery.error || !gardenQuery.data ? (
                        <p className="p-4">Vrt trenutno nije dostupan.</p>
                    ) : (
                        <PublicGardenViewerDynamic
                            className="h-full"
                            stacks={gardenStacks}
                        />
                    )}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                    Prikaz je samo za gledanje (bez HUD-a i uređivanja).
                </p>
            </section>
        </Stack>
    );
}
