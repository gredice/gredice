'use client';

import { LogOut, UserCircle } from '@signalco/ui-icons';
import { ListItem } from '@signalco/ui-primitives/ListItem';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@signalco/ui-primitives/Menu';
import { KnownPages } from '../../../src/KnownPages';

export function ProfileNavItem({
    onItemClick,
}: {
    onItemClick?: () => void;
} = {}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <ListItem
                    startDecorator={<UserCircle className="size-5" />}
                    label="Korisnik"
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem
                    startDecorator={<LogOut className="size-5" />}
                    href={KnownPages.Logout}
                    onClick={onItemClick}
                >
                    Odjava
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
