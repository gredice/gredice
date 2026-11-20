'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Check, People, Search, Warning } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { cx } from '@gredice/ui/utils';
import { type ReactNode, useMemo, useState } from 'react';

const searchVisibleFromUserCount = 7;

export type AssignUsersPanelUser = {
    id: string;
    userName: string;
    displayName: string | null;
    avatarUrl?: string | null;
    achievementCount?: number;
    /** Shown in place of the email when the user can no longer be selected. */
    unavailableReason?: string;
};

interface AssignUsersPanelProps {
    title: string;
    description: ReactNode;
    users: AssignUsersPanelUser[];
    selectedUserIds: string[];
    onSelectedUserIdsChange: (selectedUserIds: string[]) => void;
    /** Warning shown above the list, for example why saving is blocked. */
    notice?: ReactNode;
    errorMessage?: string | null;
    isSaving?: boolean;
    saveDisabled?: boolean;
    emptyMessage?: string;
    onCancel: () => void;
    onSave: () => void;
}

// Same mapping as the www and farm search normalizers: NFD leaves Đ/đ intact.
function normalizeSearch(value: string) {
    return value
        .replace(/[Đđ]/g, 'd')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('hr-HR')
        .trim();
}

/**
 * Shared body for the schedule "assign users" dialogs: a header, an
 * avatar-based multi-select user list and the cancel/save footer.
 */
export function AssignUsersPanel({
    title,
    description,
    users,
    selectedUserIds,
    onSelectedUserIdsChange,
    notice,
    errorMessage,
    isSaving = false,
    saveDisabled = false,
    emptyMessage = 'Na ovu farmu još nije dodijeljen nijedan korisnik.',
    onCancel,
    onSave,
}: AssignUsersPanelProps) {
    const [search, setSearch] = useState('');
    const showSearch = users.length >= searchVisibleFromUserCount;
    const normalizedSearch = normalizeSearch(search.trim());

    const visibleUsers = useMemo(() => {
        if (!showSearch || !normalizedSearch) {
            return users;
        }

        return users.filter((user) =>
            normalizeSearch(
                `${user.displayName ?? ''} ${user.userName}`,
            ).includes(normalizedSearch),
        );
    }, [normalizedSearch, showSearch, users]);

    const toggleUser = (userId: string) => {
        onSelectedUserIdsChange(
            selectedUserIds.includes(userId)
                ? selectedUserIds.filter(
                      (selectedUserId) => selectedUserId !== userId,
                  )
                : [...selectedUserIds, userId],
        );
    };

    return (
        <Stack spacing={4}>
            <Row spacing={3} alignItems="start" className="pr-8">
                <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                >
                    <People className="size-5" />
                </span>
                <Stack spacing={0.5} className="min-w-0">
                    <Typography level="h5">{title}</Typography>
                    <Typography level="body2">{description}</Typography>
                </Stack>
            </Row>

            {notice && (
                <Alert
                    color="warning"
                    startDecorator={<Warning aria-hidden className="size-4" />}
                >
                    {notice}
                </Alert>
            )}

            {users.length > 0 ? (
                <Stack spacing={2}>
                    {showSearch && (
                        <Input
                            type="search"
                            fullWidth
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Pretraži korisnike"
                            aria-label="Pretraži korisnike"
                            startDecorator={
                                <Search
                                    aria-hidden
                                    className="ml-3 size-4 shrink-0 text-muted-foreground"
                                />
                            }
                        />
                    )}
                    <Row spacing={2} justifyContent="space-between">
                        <Typography level="body3" secondary aria-live="polite">
                            {`Odabrano: ${selectedUserIds.length} od ${users.length}`}
                        </Typography>
                        <Button
                            variant="plain"
                            size="sm"
                            onClick={() => onSelectedUserIdsChange([])}
                            disabled={selectedUserIds.length === 0 || isSaving}
                        >
                            Ukloni sve dodjele
                        </Button>
                    </Row>
                    <fieldset className="max-h-[min(22rem,50dvh)] min-w-0 divide-y overflow-y-auto overscroll-contain rounded-lg border">
                        <legend className="sr-only">Korisnici</legend>
                        {visibleUsers.map((user) => {
                            const isSelected = selectedUserIds.includes(
                                user.id,
                            );
                            const name = user.displayName ?? user.userName;

                            return (
                                <label
                                    key={user.id}
                                    className={cx(
                                        'relative flex w-full min-w-0 cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 motion-reduce:transition-none',
                                        isSelected
                                            ? 'bg-primary/10 hover:bg-primary/15'
                                            : 'hover:bg-muted/60',
                                        user.unavailableReason &&
                                            'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/60',
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={isSelected}
                                        disabled={isSaving}
                                        onChange={() => toggleUser(user.id)}
                                    />
                                    <UserAvatar
                                        avatarUrl={user.avatarUrl}
                                        displayName={name}
                                        achievementCount={user.achievementCount}
                                        decorativeImage
                                    />
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-sm font-medium text-foreground">
                                            {name}
                                        </span>
                                        {user.unavailableReason ? (
                                            <span className="text-xs text-amber-800 dark:text-amber-200">
                                                {user.unavailableReason}
                                            </span>
                                        ) : (
                                            user.displayName && (
                                                <span className="truncate text-xs text-muted-foreground">
                                                    {user.userName}
                                                </span>
                                            )
                                        )}
                                    </span>
                                    <span
                                        aria-hidden
                                        className={cx(
                                            'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors motion-reduce:transition-none',
                                            isSelected
                                                ? 'border-primary bg-primary text-primary-foreground'
                                                : 'border-input bg-background',
                                        )}
                                    >
                                        {isSelected && (
                                            <Check className="size-3.5" />
                                        )}
                                    </span>
                                </label>
                            );
                        })}
                        {visibleUsers.length === 0 && (
                            <Typography
                                level="body2"
                                secondary
                                className="px-3 py-6 text-center"
                            >
                                Nema korisnika za ovu pretragu.
                            </Typography>
                        )}
                    </fieldset>
                </Stack>
            ) : (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center">
                    <People
                        aria-hidden
                        className="size-6 text-muted-foreground"
                    />
                    <Typography level="body2" secondary>
                        {emptyMessage}
                    </Typography>
                </div>
            )}

            {errorMessage && (
                <Typography level="body2" role="alert" className="text-red-600">
                    {errorMessage}
                </Typography>
            )}

            <Row spacing={2} justifyContent="end">
                <Button
                    variant="outlined"
                    onClick={onCancel}
                    disabled={isSaving}
                >
                    Odustani
                </Button>
                <Button
                    variant="solid"
                    onClick={onSave}
                    loading={isSaving}
                    disabled={isSaving || saveDisabled}
                >
                    Spremi dodjelu
                </Button>
            </Row>
        </Stack>
    );
}
