import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardActions,
    CardContent,
    CardHeader,
} from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { clientAuthenticated } from '@gredice/client';
import { useReferrals } from '../../hooks/useReferrals';

export function ReferralsManagementCard() {
    const { data, refetch } = useReferrals();
    const [code, setCode] = useState('');

    return (
        <Card>
            <CardHeader title="💮 Referral račun" />
            <CardContent>
                <Stack spacing={1}>
                    <Typography level="body2">
                        Vaš kod: {data?.myCode}
                    </Typography>
                    <Typography level="body3">
                        Link: {data?.referralLink}
                    </Typography>
                    <Input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="Promijeni kod računa"
                    />
                </Stack>
            </CardContent>
            <CardActions>
                <Button
                    size="sm"
                    onClick={async () => {
                        await clientAuthenticated().api.accounts.current.referrals.code.$post(
                            { json: { code } },
                        );
                        await refetch();
                    }}
                >
                    Spremi kod
                </Button>
            </CardActions>
        </Card>
    );
}
