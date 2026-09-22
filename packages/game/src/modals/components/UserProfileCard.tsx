import { AvatarSelectionMenu } from '@gredice/ui/AvatarSelectionMenu';
import { Button } from '@gredice/ui/Button';
import { Card, CardActions, CardContent } from '@gredice/ui/Card';
import { Input } from '@gredice/ui/Input';
import { Link } from '@gredice/ui/Link';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { UserAchievementProgress } from '@gredice/ui/UserAvatar';
import type { FormEvent } from 'react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useUpdateUser } from '../../hooks/useUpdateUser';
import { KnownPages } from '../../knownPages';
import { ProfileAvatar } from '../../shared-ui/ProfileAvatar';

export function UserProfileCard() {
    const currentUser = useCurrentUser();
    const updateUser = useUpdateUser();

    const memberFormatter = new Intl.DateTimeFormat('hr-HR', {
        month: 'long',
        year: 'numeric',
    });

    const memberSinceDisplay = currentUser.data?.createdAt
        ? memberFormatter.format(currentUser.data.createdAt)
        : undefined;

    const handleProfileUpdate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const displayName = formData.get('displayName') as string;

        await updateUser.mutateAsync({ displayName });
    };

    const handleAvatarChange = async (avatarUrl: string | null) => {
        await updateUser.mutateAsync({ avatarUrl });
    };

    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={8}>
                    <form onSubmit={handleProfileUpdate}>
                        <Stack spacing={4}>
                            <Row spacing={4}>
                                <AvatarSelectionMenu
                                    displayName={currentUser.data?.displayName}
                                    avatarUrl={currentUser.data?.avatarUrl}
                                    onChange={handleAvatarChange}
                                >
                                    <button
                                        type="button"
                                        aria-label="Promijeni avatar"
                                        className="cursor-pointer rounded-full disabled:cursor-not-allowed disabled:opacity-60"
                                        disabled={updateUser.isPending}
                                    >
                                        <ProfileAvatar
                                            size="lg"
                                            className="[&_img]:size-auto hover:outline min-w-20 min-h-20 shrink-0"
                                        />
                                    </button>
                                </AvatarSelectionMenu>
                                <Stack spacing={2}>
                                    <Input
                                        name="displayName"
                                        label="Prikazano ime"
                                        defaultValue={
                                            currentUser.data?.displayName
                                        }
                                        type="text"
                                        placeholder="Unesite ime..."
                                        required
                                    />
                                    <Typography level="body3">
                                        Ovo ime će biti prikazano u vašem
                                        profilu i na svim vašim objavama.
                                    </Typography>
                                </Stack>
                            </Row>
                            {currentUser.data && (
                                <UserAchievementProgress
                                    achievementCount={
                                        currentUser.data.achievementCount
                                    }
                                />
                            )}
                            <Link
                                href={KnownPages.GrediceExperience}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm underline underline-offset-4"
                            >
                                Kako funkcioniraju XP i razine? (nova kartica)
                            </Link>
                            <CardActions className="justify-between">
                                <Typography level="body2">
                                    Član od: {memberSinceDisplay}
                                </Typography>
                                <Button
                                    size="sm"
                                    variant="solid"
                                    type="submit"
                                    loading={updateUser.isPending}
                                    disabled={updateUser.isPending}
                                >
                                    Spremi
                                </Button>
                            </CardActions>
                        </Stack>
                    </form>
                </Stack>
            </CardContent>
        </Card>
    );
}
