import { getEntityTypeByNameWithCategory, getEntityTypeCategories } from "@gredice/storage";
import { auth } from "../../../../../lib/auth/auth";
import { notFound } from "next/navigation";
import { EntityTypeEditForm } from "./EntityTypeEditForm";

export const dynamic = 'force-dynamic';

export default async function EditEntityTypePage({ params }: { params: { entityType: string } }) {
    await auth(['admin']);

    const entityType = await getEntityTypeByNameWithCategory(params.entityType);
    if (!entityType) {
        notFound();
    }

    const categories = await getEntityTypeCategories();

    return <EntityTypeEditForm entityType={entityType} categories={categories} />;
}
