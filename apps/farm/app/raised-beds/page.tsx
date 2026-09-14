import {
    type EntityStandardized,
    getEntitiesFormatted,
    getFarmUserRaisedBeds,
} from '@gredice/storage';
import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import { Card, CardContent } from '@gredice/ui/Card';
import { Typography } from '@gredice/ui/Typography';
import LoginDialog from '../../components/auth/LoginDialog';
import { auth } from '../../lib/auth/auth';
import { RaisedBedsOverview } from './RaisedBedsOverview';
import { getFieldPreviews } from './raisedBedFieldPreviews';

export const dynamic = 'force-dynamic';

async function RaisedBedsPageContent() {
    const { userId } = await auth(['farmer', 'admin']);
    const [raisedBeds, plantSorts] = await Promise.all([
        getFarmUserRaisedBeds(userId),
        getEntitiesFormatted<EntityStandardized>('plantSort'),
    ]);
    const activeRaisedBeds = raisedBeds.filter(
        (raisedBed) =>
            raisedBed.status === 'active' && Boolean(raisedBed.physicalId),
    );

    return (
        <div className="mx-auto w-full max-w-2xl space-y-3 p-2 sm:p-4">
            <Typography component="h1" level="h5" semiBold>
                Gredice
            </Typography>
            {activeRaisedBeds.length === 0 ? (
                <Card>
                    <CardContent noHeader>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Trenutno nema aktivnih gredica s fizičkim
                            identifikatorom za vaš korisnički račun.
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <RaisedBedsOverview
                    raisedBeds={activeRaisedBeds.map((raisedBed) => ({
                        id: raisedBed.id,
                        physicalId: raisedBed.physicalId,
                        name: raisedBed.name,
                        fields: getFieldPreviews(raisedBed, plantSorts),
                    }))}
                />
            )}
        </div>
    );
}

export default async function RaisedBedsPage() {
    const authFarmer = auth.bind(null, ['farmer', 'admin']);
    return (
        <div className="min-h-[100dvh] w-full bg-background">
            <AuthProtectedSection auth={authFarmer}>
                <RaisedBedsPageContent />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
