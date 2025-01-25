'use client';

import { getUsers } from "@gredice/storage";
import { SelectItems } from "@signalco/ui-primitives/SelectItems";
import { updateUserRole } from "../../(actions)/userActions";
import { ShieldCheck, User } from "lucide-react";
import { ModalConfirm } from '@signalco/ui/ModalConfirm';
import { useState } from "react";
import { Typography } from "@signalco/ui-primitives/Typography";

export function SelectUserRole({ user }: { user: Awaited<ReturnType<typeof getUsers>>[0] }) {
    const [confirmOpen, setConfirmOpen] = useState<string | null>(null);

    const handleUserRoleChange = async (userId: string, newRole: string) => {
        await updateUserRole(userId, newRole);
    }

    const handleConfirm = () => {
        if (confirmOpen)
            handleUserRoleChange(user.id, confirmOpen);
    }

    const handleConfirmOpenChange = (newOpen: boolean) => {
        if (!newOpen)
            setConfirmOpen(null);
    }

    return (
        <>
            <SelectItems
                variant="plain"
                value={user.role}
                onValueChange={(newRole) => setConfirmOpen(newRole)}
                items={[
                    { value: 'admin', label: 'Administrator', icon: <ShieldCheck className="size-5" /> },
                    { value: 'user', label: 'Korisnik', icon: <User className="size-5" /> }
                ]} />
            <ModalConfirm
                header="Promena uloge korisnika"
                title="Promjena uloge korisnika"
                open={Boolean(confirmOpen)}
                onOpenChange={handleConfirmOpenChange}
                onConfirm={handleConfirm}>
                <Typography>Da li ste sigurni da želite promjeniti ulogu korisnika <strong>{user.userName}</strong> u <strong>{confirmOpen === 'admin' ? 'Administrator' : 'Korisnik'}</strong>?</Typography>
            </ModalConfirm>
        </>
    )
}