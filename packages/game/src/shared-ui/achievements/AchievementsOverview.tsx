'use client';

import {
    type AchievementCategory,
    getAchievementFamilies,
} from '@gredice/js/achievements';
import {
    AchievementFamilyCard,
    AchievementFamilyDetails,
} from '@gredice/ui/AchievementAwards';
import { Button } from '@gredice/ui/Button';
import { Spinner } from '@gredice/ui/Spinner';
import { useState } from 'react';
import { useAccountAchievements } from '../../hooks/useAccountAchievements';
import { GameModal } from '../game-modal';
import { AchievementApprovalNotice } from './AchievementApprovalNotice';

export function AchievementsOverview() {
    const query = useAccountAchievements();
    const [selectedKey, setSelectedKey] = useState<AchievementCategory | null>(
        null,
    );
    const families = getAchievementFamilies(query.data ?? []);
    const selected = families.find((family) => family.key === selectedKey);

    if (query.isLoading)
        return (
            <div className="flex min-h-64 items-center justify-center">
                <Spinner loadingLabel="Učitavanje postignuća" />
            </div>
        );
    if (query.error && !query.data)
        return (
            <div role="alert" className="space-y-3 py-6 text-center">
                <p>Postignuća trenutno nisu dostupna.</p>
                <Button variant="outlined" onClick={() => query.refetch()}>
                    Pokušaj ponovno
                </Button>
            </div>
        );

    return (
        <>
            <AchievementApprovalNotice achievements={query.data} />
            {query.error && (
                <p role="alert" className="mb-3 text-sm text-foreground/75">
                    Zbirku trenutno nije moguće osvježiti. Prikazana su
                    posljednja učitana postignuća.
                </p>
            )}
            <div className="max-h-[calc(100dvh-15rem)] overflow-y-auto p-1 md:max-h-[calc(100dvh-24rem)]">
                <div className="grid gap-3">
                    {families.map((family) => (
                        <AchievementFamilyCard
                            key={family.key}
                            family={family}
                            onSelect={() => setSelectedKey(family.key)}
                        />
                    ))}
                </div>
            </div>
            <GameModal
                open={Boolean(selected)}
                onOpenChange={(open) => {
                    if (!open) setSelectedKey(null);
                }}
                title={selected?.label ?? 'Postignuća'}
                showHeader
                className="max-w-xl"
            >
                {selected && <AchievementFamilyDetails family={selected} />}
            </GameModal>
        </>
    );
}
