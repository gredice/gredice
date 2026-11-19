'use client';

import { Button } from '@gredice/ui/Button';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { InlineLoginDialog } from '../../components/auth/InlineLoginDialog';
import { Card } from '../../components/shared/Card';

/** Explains why the list is empty for a signed-out visitor and offers sign-in. */
export function MySuggestionsSignedOut() {
    const [loginOpen, setLoginOpen] = useState(false);

    return (
        <Card className="p-6">
            <Stack spacing={3}>
                <Typography component="h2" level="h6" semiBold>
                    Prijavi se da vidiš svoje prijedloge
                </Typography>
                <Typography level="body2">
                    Prijedlozi su vezani uz tvoj račun. Nakon prijave ovdje
                    pratiš što je na pregledu, što je objavljeno i što ti je
                    moderator odgovorio.
                </Typography>
                <Button
                    className="self-start"
                    onClick={() => setLoginOpen(true)}
                    type="button"
                >
                    Prijavi se
                </Button>
            </Stack>
            <InlineLoginDialog
                description="Prijavi se da vidiš svoje prijedloge."
                onOpenChange={setLoginOpen}
                open={loginOpen}
            />
        </Card>
    );
}
