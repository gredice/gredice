import { Button } from "@signalco/ui-primitives/Button";
import { Card, CardContent, CardActions } from "@signalco/ui-primitives/Card";
import { Input } from "@signalco/ui-primitives/Input";
import { Typography } from "@signalco/ui-primitives/Typography";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useUpdateUser } from "../../hooks/useUpdateUser";
import { Stack } from "@signalco/ui-primitives/Stack";
import { ProfileAvatar } from "../../shared-ui/ProfileAvatar";
import { Row } from "@signalco/ui-primitives/Row";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@signalco/ui-primitives/Menu";
import { Avatar } from "@signalco/ui-primitives/Avatar";
import { initials } from "@signalco/js";

export function UserProfileCard() {
    const currentUser = useCurrentUser();
    const updateUser = useUpdateUser();
    const dateFormatter = new Intl.DateTimeFormat('hr-HR', { month: 'long', year: 'numeric' });
    const memberSinceDisplay = currentUser.data?.createdAt
        ? dateFormatter.format(currentUser.data?.createdAt)
        : undefined;

    const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const displayName = formData.get("displayName") as string;

        await updateUser.mutateAsync({ displayName });
    };

    const handleAvatarChange = async (avatarUrl: string | null) => {
        await updateUser.mutateAsync({ avatarUrl });
    };

    return (
        <Card>
            <form onSubmit={handleUpdate}>
                <CardContent noHeader>
                    <Stack spacing={2}>
                        <Row spacing={2}>
                            <DropdownMenu>
                                <DropdownMenuTrigger>
                                    <ProfileAvatar size="lg" className="[&_img]:size-auto hover:outline min-w-20 min-h-20 shrink-0" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuLabel>Odaberi avatar</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => handleAvatarChange(null)}
                                        startDecorator={<Avatar size="lg">{initials(currentUser.data?.displayName ?? '')}</Avatar>}>
                                        <DropdownMenuLabel>Prazno</DropdownMenuLabel>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => handleAvatarChange("https://cdn.gredice.com/avatars/farmer-male.png")}
                                        startDecorator={(
                                            <Avatar src="https://cdn.gredice.com/avatars/farmer-male.png" alt="Farmer Avatar" size="lg" />
                                        )}>
                                        <DropdownMenuLabel>Farmer</DropdownMenuLabel>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => handleAvatarChange("https://cdn.gredice.com/avatars/farmer-female.png")}
                                        startDecorator={(
                                            <Avatar src="https://cdn.gredice.com/avatars/farmer-female.png" alt="Farmer Avatar" size="lg" />
                                        )}>
                                        <DropdownMenuLabel>Farmerka</DropdownMenuLabel>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Stack spacing={1}>
                                <Input
                                    name="displayName"
                                    label="Prikazano ime"
                                    className='[&_input]:text-base sm:[&_input]:text-[16px]'
                                    defaultValue={currentUser.data?.displayName}
                                    type="text"
                                    placeholder="Unesite ime..."
                                    required />
                                <Typography level="body3">
                                    Ovo ime će biti prikazano u vašem profilu i na svim vašim objavama.
                                </Typography>
                            </Stack>
                        </Row>
                        <CardActions className="justify-between">
                            <Typography level="body2">Član od: {memberSinceDisplay}</Typography>
                            <Button
                                size="sm"
                                variant="solid"
                                type="submit"
                                loading={updateUser.isPending}
                                disabled={updateUser.isPending}>
                                Spremi
                            </Button>
                        </CardActions>
                    </Stack>
                </CardContent>
            </form>
        </Card>
    );
}