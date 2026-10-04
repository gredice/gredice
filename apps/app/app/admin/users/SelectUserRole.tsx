'use client';

import type { getUsers } from '@gredice/storage';
import { Fence, Security, Truck, User } from '@gredice/ui/icons';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Typography } from '@gredice/ui/Typography';
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
        {
            value: 'driver',
            label: 'Vozač dostave',
            icon: <Truck className="size-5" />,
        },
    ];

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
