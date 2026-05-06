import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useState } from 'react';
import { clientAuthenticated } from '@gredice/client';
import { useReferrals } from '../../hooks/useReferrals';

export function ReferralsTab() {
    const { data, refetch } = useReferrals();
    const [myCode, setMyCode] = useState('');
    const [useCode, setUseCode] = useState('');

    return (
        <Stack spacing={2}>
            <div className="text-sm">
                💮 Referral reward: {data?.rewardAmount ?? 10000} sunflowers
            </div>
            <div>
                <div className="text-xs">Account referral code</div>
                <div className="font-bold">{data?.myCode}</div>
                <div className="text-xs">
                    Referral link:{' '}
                    {typeof window !== 'undefined'
                        ? `${window.location.origin}?ref=${data?.myCode ?? ''}`
                        : ''}
                </div>
                <Input
                    value={myCode}
                    onChange={(e) => setMyCode(e.target.value)}
                    placeholder="Change my code"
                />
                <Button
                    onClick={async () => {
                        await clientAuthenticated().api.accounts.current.referrals.code.$post(
                            { json: { code: myCode } },
                        );
                        await refetch();
                    }}
                >
                    Save code
                </Button>
            </div>
            <div>
                <div className="text-xs">Use account referral code</div>
                <Input
                    value={useCode}
                    onChange={(e) => setUseCode(e.target.value)}
                    placeholder="Enter code"
                />
                <Button
                    onClick={async () => {
                        await clientAuthenticated().api.accounts.current.referrals.use.$post(
                            { json: { code: useCode } },
                        );
                        await refetch();
                    }}
                >
                    Apply code
                </Button>
            </div>
            <div>
                <div className="text-xs">Referred accounts</div>
                <ul>
                    {data?.referredAccounts?.map((u) => (
                        <li key={u.accountId}>
                            {u.accountId} {u.rewarded ? '✅' : '⏳'}
                        </li>
                    ))}
                </ul>
            </div>
        </Stack>
    );
}
