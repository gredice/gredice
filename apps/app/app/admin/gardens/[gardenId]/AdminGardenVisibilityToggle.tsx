'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { ExternalLink, Warning } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Switch } from '@gredice/ui/Switch';
import { Typography } from '@gredice/ui/Typography';
import { useState, useTransition } from 'react';
import { updateGardenVisibilityAction } from './actions';

type AdminGardenVisibilityToggleProps = {
    gardenId: number;
    isPublic: boolean;
    publicUrl: string;
};

export function AdminGardenVisibilityToggle({
    gardenId,
    isPublic,
    publicUrl,
}: AdminGardenVisibilityToggleProps) {
    const [checked, setChecked] = useState(isPublic);
    const [message, setMessage] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleChange(nextPublic: boolean) {
        setChecked(nextPublic);
        setMessage(null);
        startTransition(async () => {
            const result = await updateGardenVisibilityAction({
                gardenId,
                isPublic: nextPublic,
            });
            if (!result.success) {
                setChecked(!nextPublic);
                setMessage(result.message);
            }
        });
    }

    return (
        <Stack spacing={3} className="p-4">
            <Row spacing={3} className="justify-between">
                <Stack spacing={0} className="min-w-0">
                    <Typography level="body2" semiBold>
                        Public visibility
                    </Typography>
                    <Typography level="body3" className="text-muted-foreground">
                        {checked
                            ? 'Garden is visible on www.'
                            : 'Garden is private.'}
                    </Typography>
                </Stack>
                <Switch
                    aria-label="Public garden visibility"
                    checked={checked}
                    disabled={isPending}
                    onCheckedChange={handleChange}
                />
            </Row>
            {checked ? (
                <Button
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    variant="outlined"
                    size="sm"
                    startDecorator={<ExternalLink className="size-4" />}
                >
                    Open public page
                </Button>
            ) : null}
            {message ? (
                <Alert
                    color="danger"
                    startDecorator={<Warning className="size-4 shrink-0" />}
                >
                    <Typography level="body2">{message}</Typography>
                </Alert>
            ) : null}
        </Stack>
    );
}
