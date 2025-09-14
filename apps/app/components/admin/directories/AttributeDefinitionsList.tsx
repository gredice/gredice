import {
    getAttributeDefinitionCategories,
    getAttributeDefinitions,
} from '@gredice/storage';
import { AttributeDefinitionsListClient } from './AttributeDefinitionsListClient';

export async function AttributeDefinitionsList({
    entityTypeName,
}: {
    entityTypeName: string;
}) {
    const [attributeDefinitions, attributeDefinitionCategories] =
        await Promise.all([
            getAttributeDefinitions(entityTypeName),
            getAttributeDefinitionCategories(entityTypeName),
        ]);

    return (
        <AttributeDefinitionsListClient
            entityTypeName={entityTypeName}
            attributeDefinitions={attributeDefinitions}
            attributeDefinitionCategories={attributeDefinitionCategories}
        />
    );
}
