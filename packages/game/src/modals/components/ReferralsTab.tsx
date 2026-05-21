import { clientAuthenticated } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Stack } from '@gredice/ui/Stack';
import { useState } from 'react';
import { useReferrals } from '../../hooks/useReferrals';

export function ReferralsTab() {
    const { data, refetch } = useReferrals();
    const [myCode, setMyCode] = useState('');
    const [useCode, setUseCode] = useState('');

    return (
        <Stack spacing={2}>
            <div className="text-sm">
                💮 Nagrada preporuke: {data?.rewardAmount ?? 10000} suncokreta
            </div>
            <div>
                <div className="text-xs">Kod za preporuku računa</div>
                <div className="font-bold">{data?.myCode}</div>
                <div className="text-xs">
                    Poveznica za preporuku:{' '}
                    {typeof window !== 'undefined'
                        ? `${window.location.origin}?ref=${data?.myCode ?? ''}`
                        : ''}
                </div>
                <Input
                    value={myCode}
                    onChange={(e) => setMyCode(e.target.value)}
                    placeholder="Promijeni moj kod"
                />
                <Button
                    onClick={async () => {
                        await clientAuthenticated().api.accounts.current.referrals.code.$post(
                            { json: { code: myCode } },
                        );
                        await refetch();
                    }}
                >
                    Spremi kod
                </Button>
            </div>
            <div>
                <div className="text-xs">Iskoristi kod za preporuku</div>
                <Input
                    value={useCode}
                    onChange={(e) => setUseCode(e.target.value)}
                    placeholder="Unesi kod"
                />
                <Button
                    onClick={async () => {
                        await clientAuthenticated().api.accounts.current.referrals.use.$post(
                            { json: { code: useCode } },
                        );
                        await refetch();
                    }}
                >
                    Primijeni kod
                </Button>
            </div>
            <div>
                <div className="text-xs">Preporučeni računi</div>
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
