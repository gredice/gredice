'use client';

import { ListItem } from "@signalco/ui-primitives/ListItem";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@signalco/ui-primitives/Menu";
import { LogOut, UserCircle } from "lucide-react";
import { KnownPages } from "../../src/KnownPages";

export function ProfileNavItem() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <ListItem
                    startDecorator={<UserCircle className="size-5" />}
                    label="Korisnik" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem startDecorator={<LogOut className="size-5" />} href={KnownPages.Logout}>
                    Odjava
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}