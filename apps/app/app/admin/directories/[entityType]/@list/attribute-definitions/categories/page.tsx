import { AttributeDefinitionsList } from "../AttributeDefinitionsList";

export const dynamic = 'force-dynamic';

export default async function AttributeDefinitionsCategoriesListParallel({ params }: { params: Promise<{ entityType: string }> }) {
    const { entityType } = await params;

    return (
        <AttributeDefinitionsList entityTypeName={entityType} />
    )
}