'use client';

import { initials } from '@signalco/js';
import { Avatar } from '@signalco/ui-primitives/Avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@signalco/ui-primitives/Menu';
import type { ReactNode } from 'react';
import { AVATAR_OPTIONS } from './avatarOptions';

export type AvatarSelectionMenuProps = {
    displayName?: string | null;
    children: ReactNode;
    onChange: (avatarUrl: string | null) => void;
    title?: string;
    emptyLabel?: string;
};

export function AvatarSelectionMenu({
    displayName,
    children,
    onChange,
    title = 'Odaberi avatar',
    emptyLabel = 'Prazno',
}: AvatarSelectionMenuProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger>{children}</DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuLabel>{title}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={() => onChange(null)}
                    startDecorator={
                        <Avatar size="lg">{initials(displayName ?? '')}</Avatar>
                    }
                >
                    <DropdownMenuLabel>{emptyLabel}</DropdownMenuLabel>
                </DropdownMenuItem>
                {AVATAR_OPTIONS.map((option) => (
                    <DropdownMenuItem
                        key={option.label}
                        onClick={() => onChange(option.avatarUrl)}
                        startDecorator={
                            <Avatar
                                src={option.avatarUrl ?? undefined}
                                alt={option.label}
                                size="lg"
                            />
                        }
                    >
                        <DropdownMenuLabel>{option.label}</DropdownMenuLabel>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
