import {
    getEntityTypeByNameWithCategory,
    getEntityTypeCategories,
} from '@gredice/storage';
import { notFound } from 'next/navigation';
import { auth } from '../../../../../lib/auth/auth';
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
        <EntityTypeEditForm entityType={entityType} categories={categories} />
    );
}
