import { getAccountReferralState } from '@gredice/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { AccountReferralsForm } from './AccountReferralsForm';

type AccountReferralsCardProps = {
    accountId: string;
};

export async function AccountReferralsCard({
    accountId,
}: AccountReferralsCardProps) {
    const referralState = await getAccountReferralState(accountId);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Preporuke</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
                <AccountReferralsForm
                    accountId={accountId}
                    currentCode={referralState.myCode}
                    usedReferral={referralState.usedReferral}
                />
            </CardContent>
        </Card>
    );
}
