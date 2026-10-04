'use client';

import { initials } from '@gredice/js/initials';
import { type ReactElement, useState } from 'react';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { AvatarChoice } from './AvatarChoice';
import { AVATAR_CATEGORIES, AVATAR_OPTIONS } from './avatarOptions';

export type AvatarSelectionMenuProps = {
    displayName?: string | null;
    avatarUrl?: string | null;
    children: ReactElement;
    onChange: (avatarUrl: string | null) => void;
    title?: string;
    emptyLabel?: string;
};

export function AvatarSelectionMenu({
    displayName,
    avatarUrl,
    children,
    onChange,
    title = 'Odaberi avatar',
    emptyLabel = 'Prazno',
}: AvatarSelectionMenuProps) {
    const [open, setOpen] = useState(false);

    function selectAvatar(nextAvatarUrl: string | null) {
        onChange(nextAvatarUrl);
        setOpen(false);
    }

    return (
        <Modal
            title={title}
            trigger={children}
            open={open}
            onOpenChange={setOpen}
            className="md:max-w-2xl"
        >
            <div className="space-y-5">
                <div className="flex items-center justify-between gap-3 pr-6">
                    <h2 className="text-xl font-semibold">{title}</h2>
                    <Button
                        type="button"
                        size="sm"
                        variant="outlined"
                        aria-pressed={avatarUrl === null}
                        className="shrink-0 aria-pressed:border-primary aria-pressed:bg-primary/10"
                        onClick={() => selectAvatar(null)}
                        startDecorator={
                            <Avatar aria-hidden size="sm">
                                {initials(displayName ?? '')}
                            </Avatar>
                        }
                    >
                        {emptyLabel}
                    </Button>
                </div>
                {AVATAR_CATEGORIES.map((category) => (
                    <section
                        key={category}
                        aria-label={category}
                        className="space-y-2"
                    >
                        <h3 className="text-sm font-semibold text-muted-foreground">
                            {category}
                        </h3>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                            {AVATAR_OPTIONS.filter(
                                (option) => option.category === category,
                            ).map((option) => (
                                <AvatarChoice
                                    key={option.id}
                                    label={option.label}
                                    avatarUrl={option.avatarUrl}
                                    selected={avatarUrl === option.avatarUrl}
                                    onSelect={() =>
                                        selectAvatar(option.avatarUrl)
                                    }
                                />
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </Modal>
    );
}
