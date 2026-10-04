'use client';

import { Alert } from '@gredice/ui/Alert';
import { AvatarSelectionMenu } from '@gredice/ui/AvatarSelectionMenu';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader } from '@gredice/ui/Card';
import { Input } from '@gredice/ui/Input';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { useActionState, useState } from 'react';
import {
    type FarmProfileActionState,
    updateFarmProfile,
} from '../profileActions';

export function FarmProfileSettings({
    displayName: initialDisplayName,
    avatarUrl: initialAvatarUrl,
}: {
    displayName: string;
    avatarUrl: string | null;
}) {
    const [displayName, setDisplayName] = useState(initialDisplayName);
    const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
    // A failed result describes the submitted draft, so hide it once edited.
    const [isDraftEditedSinceSubmit, setIsDraftEditedSinceSubmit] =
        useState(false);
    const [state, formAction, isPending] = useActionState<
        FarmProfileActionState,
        FormData
    >(async (previousState, formData) => {
        try {
            return await updateFarmProfile(previousState, formData);
        } catch {
            return {
                success: false,
                message: 'Profil nije spremljen. Pokušaj ponovno.',
            };
        }
    }, null);
    const savedDisplayName = state?.success
        ? state.displayName
        : initialDisplayName;
    const savedAvatarUrl = state?.success ? state.avatarUrl : initialAvatarUrl;
    const hasChanges =
        displayName.trim() !== savedDisplayName || avatarUrl !== savedAvatarUrl;
    const showResult = state?.success ? !hasChanges : !isDraftEditedSinceSubmit;

    return (
        <Card>
            <CardHeader>
                <Typography component="h2" level="h4" semiBold>
                    Profil
                </Typography>
            </CardHeader>
            <CardContent>
                <form
                    action={formAction}
                    onSubmit={() => setIsDraftEditedSinceSubmit(false)}
                    aria-busy={isPending}
                >
                    <Stack spacing={3}>
                        <input
                            type="hidden"
                            name="avatarUrl"
                            value={avatarUrl ?? ''}
                        />
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                            <div className="flex shrink-0 items-center gap-3">
                                <UserAvatar
                                    avatarUrl={avatarUrl}
                                    displayName={displayName}
                                    size="lg"
                                />
                                <AvatarSelectionMenu
                                    displayName={displayName}
                                    avatarUrl={avatarUrl}
                                    onChange={(nextAvatarUrl) => {
                                        setAvatarUrl(nextAvatarUrl);
                                        setIsDraftEditedSinceSubmit(true);
                                    }}
                                >
                                    <Button
                                        type="button"
                                        variant="outlined"
                                        disabled={isPending}
                                    >
                                        Promijeni avatar
                                    </Button>
                                </AvatarSelectionMenu>
                            </div>
                            <div className="min-w-0 flex-1">
                                <Input
                                    label="Ime za prikaz"
                                    name="displayName"
                                    autoComplete="nickname"
                                    value={displayName}
                                    onChange={(event) => {
                                        setDisplayName(event.target.value);
                                        setIsDraftEditedSinceSubmit(true);
                                    }}
                                    maxLength={100}
                                    required
                                    fullWidth
                                    disabled={isPending}
                                />
                            </div>
                            <Button
                                type="submit"
                                loading={isPending}
                                disabled={
                                    isPending ||
                                    !hasChanges ||
                                    !displayName.trim()
                                }
                            >
                                Spremi profil
                            </Button>
                        </div>
                        {state?.message && showResult && (
                            <Alert
                                color={state.success ? 'success' : 'danger'}
                                role={state.success ? 'status' : 'alert'}
                            >
                                {state.message}
                            </Alert>
                        )}
                    </Stack>
                </form>
            </CardContent>
        </Card>
    );
}
