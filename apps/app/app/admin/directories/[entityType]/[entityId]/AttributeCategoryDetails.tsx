import type {
    SelectAttributeDefinition,
    SelectAttributeDefinitionCategory,
    SelectAttributeValue,
} from '@gredice/storage';
import { Stack } from '@signalco/ui-primitives/Stack';
import { NoDataPlaceholder } from '../../../../../components/shared/placeholders/NoDataPlaceholder';
import { AttributeCategoryDefinitionItem } from './AttributeCategoryDefinitionItem';

export type AttributeTabsProps = {
    entity: {
        id: number;
        entityTypeName: string;
        attributes: SelectAttributeValue[];
    };
    category: SelectAttributeDefinitionCategory;
    attributeDefinitions: SelectAttributeDefinition[];
};

export function AttributeCategoryDetails({
    entity,
    category,
    attributeDefinitions,
}: AttributeTabsProps) {
    const categoryAttributes = attributeDefinitions.filter(
        (a) => a.category === category.name,
    );
    return (
        <Stack spacing={2}>
            {categoryAttributes.length === 0 && (
                <div className="pt-12 pb-8">
                    <NoDataPlaceholder>
                        Nema definiranih atributa u kategoriji {category.label}.
                    </NoDataPlaceholder>
                </div>
            )}
            {categoryAttributes.map((attributeDefinition) => {
                return (
                    <AttributeCategoryDefinitionItem
                        key={attributeDefinition.id}
                        entity={entity}
                        attributeDefinition={attributeDefinition}
                    />
                );
            })}
        </Stack>
    );
}
