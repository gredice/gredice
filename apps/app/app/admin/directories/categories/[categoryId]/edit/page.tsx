import { auth } from "../../../../../../lib/auth/auth";
import { getEntityTypeCategoryById } from "@gredice/storage";
import { notFound } from "next/navigation";
import { EditEntityTypeCategoryPage } from "./EditEntityTypeCategoryPage";

export const dynamic = 'force-dynamic';

export default async function EditEntityTypeCategoryPageWrapper({ params }: { params: Promise<{ categoryId: string }> }) {
    await auth(['admin']);

    const { categoryId } = await params;
    const category = await getEntityTypeCategoryById(parseInt(categoryId));

    if (!category) {
        notFound();
    }

    return <EditEntityTypeCategoryPage category={category} />;
}
