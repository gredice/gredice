'use client';

import { getUsers } from "@gredice/storage";
import { SelectItems } from "@signalco/ui-primitives/SelectItems";
import { updateUserRole } from "../../(actions)/userActions";
import { ShieldCheck, User } from "lucide-react";

export function SelectUserRole({ user }: { user: Awaited<ReturnType<typeof getUsers>>[0] }) {
    const handleUserRoleChange = async (userId: string, newRole: string) => {
        await updateUserRole(userId, newRole);
    }

    return (
        <SelectItems
            variant="plain"
            value={user.role}
            onValueChange={(newRole) => handleUserRoleChange(user.id, newRole)}
            items={[
                { value: 'admin', label: 'Administrator', icon: <ShieldCheck className="size-5" /> },
                { value: 'user', label: 'Korisnik', icon: <User className="size-5" /> }
            ]} />
    )
}