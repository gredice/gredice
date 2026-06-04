'use client';

import { Card } from '@gredice/ui/Card';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
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
                <Stack spacing={0.5}>
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
                <button
                    aria-checked={widgetEnabled}
                    aria-label="Prikaži widget Što je novo u vrtu"
                    className={cx(
                        'relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                        widgetEnabled
                            ? 'border-primary bg-primary'
                            : 'border-border bg-muted',
                    )}
                    disabled={disabled}
                    onClick={() =>
                        updateUser.mutate({
                            whatsNewPopupDisabled: widgetEnabled,
                        })
                    }
                    role="switch"
                    type="button"
                >
                    <span
                        className={cx(
                            'absolute top-0.5 size-5 rounded-full bg-background shadow-xs transition-transform',
                            widgetEnabled
                                ? 'translate-x-[1.25rem]'
                                : 'translate-x-0.5',
                        )}
                    />
                </button>
            </Row>
        </Card>
    );
}
