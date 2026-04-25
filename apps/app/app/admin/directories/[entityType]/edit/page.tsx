import {
    getEntityTypeByNameWithCategory,
    getEntityTypeCategories,
} from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Stack } from '@signalco/ui-primitives/Stack';
import { notFound } from 'next/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { auth } from '../../../../../lib/auth/auth';
import { KnownPages } from '../../../../../src/KnownPages';
import { EntityTypeEditForm } from './EntityTypeEditForm';

export const dynamic = 'force-dynamic';

export default async function EditEntityTypePage({
    params,
}: PageProps<'/admin/directories/[entityType]/edit'>) {
    await auth(['admin']);
    const { entityType: entityTypeName } = await params;

    const entityType = await getEntityTypeByNameWithCategory(entityTypeName);
    if (!entityType) {
        notFound();
    }

    const categories = await getEntityTypeCategories();

    return (
        <Stack spacing={4}>
            <Breadcrumbs
                items={[
                    {
                        label: <AdminBreadcrumbLevelSelector />,
                        href: KnownPages.Directories,
                    },
                    {
                        label: entityType.label,
                        href: KnownPages.DirectoryEntityType(entityTypeName),
                    },
                    { label: 'Uredi' },
                ]}
            />
            <EntityTypeEditForm
                entityType={entityType}
                categories={categories}
            />
        </Stack>
    );
}
