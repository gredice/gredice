'use client';

import { Card } from '@gredice/ui/Card';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Switch } from '@gredice/ui/Switch';
import { Typography } from '@gredice/ui/Typography';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useUpdateUser } from '../../hooks/useUpdateUser';

export function WhatsNewNotificationToggle() {
    const { data: currentUser, isError, isPending } = useCurrentUser();
    const updateUser = useUpdateUser();
    const widgetEnabled = !currentUser?.whatsNewPopupDisabled;
    const disabled = isPending || updateUser.isPending || !currentUser;

    return (
        <Card className="bg-card p-2">
            <Row
                alignItems="center"
                className="gap-4"
                justifyContent="space-between"
            >
                <Stack spacing={0.5} className="min-w-0 flex-1">
                    <Typography level="body1" semiBold>
                        Što je novo u vrtu
                    </Typography>
                    <Typography level="body3" secondary>
                        Prikaži mali widget s najnovijom objavom u igri.
                    </Typography>
                    {isError ? (
                        <Typography level="body3" secondary>
                            Postavka widgeta nije učitana.
                        </Typography>
                    ) : null}
                    {updateUser.isError ? (
                        <Typography level="body3" secondary>
                            Postavka widgeta nije spremljena.
                        </Typography>
                    ) : null}
                </Stack>
                <Switch
                    aria-label="Prikaži widget Što je novo u vrtu"
                    checked={widgetEnabled}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                        updateUser.mutate({
                            whatsNewPopupDisabled: !checked,
                        })
                    }
                />
            </Row>
        </Card>
    );
}
