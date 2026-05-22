'use client';

import { initials } from '@gredice/js/initials';
import type { ReactElement } from 'react';
import { Avatar } from '../Avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../Menu';
import { AVATAR_OPTIONS } from './avatarOptions';

export type AvatarSelectionMenuProps = {
    displayName?: string | null;
    children: ReactElement;
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
            <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
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
                            option.avatarUrl ? (
                                <Avatar
                                    src={option.avatarUrl}
                                    alt={option.label}
                                    size="lg"
                                />
                            ) : (
                                <Avatar size="lg">
                                    {initials(option.label)}
                                </Avatar>
                            )
                        }
                    >
                        <DropdownMenuLabel>{option.label}</DropdownMenuLabel>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
