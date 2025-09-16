'use client';

import type { getUsers } from '@gredice/storage';
import { ModalConfirm } from '@signalco/ui/ModalConfirm';
import { Fence, Security, User } from '@signalco/ui-icons';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { updateUserRole } from '../../(actions)/userActions';

export function SelectUserRole({
    user,
}: {
    user: Awaited<ReturnType<typeof getUsers>>[0];
}) {
    const [confirmOpen, setConfirmOpen] = useState<string | null>(null);

    const roleItems = [
        {
            value: 'admin',
            label: 'Administrator',
            icon: <Security className="size-5" />,
        },
        {
            value: 'user',
            label: 'Korisnik',
            icon: <User className="size-5" />,
        },
        {
            value: 'farmer',
            label: 'Poljoprivrednik',
            icon: <Fence className="size-5" />,
        },
    ] as const;

    const roleLabels = roleItems.reduce<Record<string, string>>((acc, item) => {
        acc[item.value] = item.label;
        return acc;
    }, {});

    const handleUserRoleChange = async (userId: string, newRole: string) => {
        await updateUserRole(userId, newRole);
    };

    const handleConfirm = async () => {
        if (confirmOpen) await handleUserRoleChange(user.id, confirmOpen);
    };

    const handleConfirmOpenChange = (newOpen: boolean) => {
        if (!newOpen) setConfirmOpen(null);
    };

    return (
        <>
            <SelectItems
                variant="plain"
                value={user.role}
                onValueChange={(newRole) => setConfirmOpen(newRole)}
                items={roleItems}
            />
            <ModalConfirm
                header="Promena uloge korisnika"
                title="Promjena uloge korisnika"
                open={Boolean(confirmOpen)}
                onOpenChange={handleConfirmOpenChange}
                onConfirm={handleConfirm}
            >
                <Typography>
                    Da li ste sigurni da želite promjeniti ulogu korisnika{' '}
                    <strong>{user.userName}</strong> u{' '}
                    <strong>
                        {confirmOpen
                            ? (roleLabels[confirmOpen] ?? confirmOpen)
                            : ''}
                    </strong>
                    ?
                </Typography>
            </ModalConfirm>
        </>
    );
}
