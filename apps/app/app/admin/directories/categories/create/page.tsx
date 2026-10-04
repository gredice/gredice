import { Button } from '@gredice/ui/Button';
import { Card } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    AdminDirectoryBreadcrumbs,
    AdminPageHeader,
} from '../../../../../components/admin/navigation';
import { auth } from '../../../../../lib/auth/auth';
import { createEntityTypeCategoryFromForm } from '../../../../(actions)/entityTypeCategoryActions';
import { EntityTypeCategoryFormFields } from '../EntityTypeCategoryFormFields';

export const dynamic = 'force-dynamic';

export default async function CreateEntityTypeCategoryPage() {
    await auth(['admin']);

    return (
        <Stack spacing={8}>
            <AdminPageHeader
                breadcrumbs={
                    <AdminDirectoryBreadcrumbs
                        items={[{ label: 'Nova kategorija' }]}
                    />
                }
                heading="Nova kategorija tipova zapisa"
            />

            <Stack spacing={4}>
                <Typography level="h2" className="text-2xl" semiBold>
                    Nova kategorija tipova zapisa
                </Typography>
                <Typography level="body1" secondary>
                    Stvorite novu kategoriju za organiziranje tipova zapisa u
                    direktoriju.
                </Typography>
            </Stack>

            <Card className="max-w-2xl">
                <Stack spacing={8} className="p-6">
                    <form action={createEntityTypeCategoryFromForm}>
                        <Stack spacing={8}>
                            <EntityTypeCategoryFormFields />
                            <Button
                                variant="solid"
                                type="submit"
                                className="w-fit"
                            >
                                Stvori kategoriju
                            </Button>
                        </Stack>
                    </form>
                </Stack>
            </Card>
        </Stack>
    );
}
