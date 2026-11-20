'use client';

import { useState } from 'react';
import {
    AssignUsersPanel,
    type AssignUsersPanelUser,
} from '../app/admin/schedule/AssignUsersPanel';

export function AssignUsersPanelHarness({
    users,
    initialSelectedUserIds = [],
}: {
    users: AssignUsersPanelUser[];
    initialSelectedUserIds?: string[];
}) {
    const [selectedUserIds, setSelectedUserIds] = useState(
        initialSelectedUserIds,
    );
    const [savedUserIds, setSavedUserIds] = useState<string[] | null>(null);

    return (
        <div className="max-w-lg p-6">
            <AssignUsersPanel
                title="Dodjela radnje"
                description="Odaberi korisnike."
                users={users}
                selectedUserIds={selectedUserIds}
                onSelectedUserIdsChange={setSelectedUserIds}
                onCancel={() => setSavedUserIds(null)}
                onSave={() => setSavedUserIds(selectedUserIds)}
            />
            <output data-testid="saved">
                {savedUserIds ? savedUserIds.join(',') : 'none'}
            </output>
        </div>
    );
}
