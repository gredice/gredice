import { clientAuthenticated } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { Card, CardActions, CardContent, CardHeader } from '@gredice/ui/Card';
import { Input } from '@gredice/ui/Input';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { useReferrals } from '../../hooks/useReferrals';

export function ReferralsManagementCard() {
    const { data, refetch } = useReferrals();
    const [code, setCode] = useState('');

    return (
        <Card>
            <CardHeader title="💮 Referral račun" />
            <CardContent>
                <Stack spacing={2}>
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
