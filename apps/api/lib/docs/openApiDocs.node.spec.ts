import assert from 'node:assert/strict';
import test from 'node:test';
import type { OpenAPIV3_1 } from 'openapi-types';
import {
    buildAttributeDefinitionProperties,
    type DirectoryAttributeDefinition,
    UnsupportedCmsAttributeDataTypeError,
} from './openApiDocs';

function attributeDefinition(
    value: Pick<
        DirectoryAttributeDefinition,
        'category' | 'dataType' | 'entityTypeName' | 'name'
    > &
        Partial<
            Pick<
                DirectoryAttributeDefinition,
                'description' | 'multiple' | 'required'
            >
        >,
): DirectoryAttributeDefinition {
    return {
        description: null,
        multiple: false,
        required: false,
        ...value,
    };
}

function schemaObject(
    value: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject | undefined,
): OpenAPIV3_1.SchemaObject {
    assert.ok(value);
    assert.ok(!('$ref' in value));
    return value;
}

test('buildAttributeDefinitionProperties maps CMS data types to formatted entity schema', async () => {
    const result = await buildAttributeDefinitionProperties(
        [
            attributeDefinition({
                category: 'information',
                dataType: 'text',
                entityTypeName: 'plant',
                name: 'name',
                required: true,
            }),
            attributeDefinition({
                category: 'attributes',
                dataType: 'range|0|100',
                entityTypeName: 'plant',
                name: 'growthWindow',
            }),
            attributeDefinition({
                category: 'attributes',
                dataType: 'json|header:string,content:markdown',
                entityTypeName: 'plant',
                multiple: true,
                name: 'tips',
            }),
            attributeDefinition({
                category: 'attributes',
                dataType: 'ref:stage',
                entityTypeName: 'plant',
                multiple: true,
                name: 'stages',
            }),
        ],
        async (entityTypeName) => {
            assert.equal(entityTypeName, 'stage');
            return [
                attributeDefinition({
                    category: 'information',
                    dataType: 'text',
                    entityTypeName: 'stage',
                    name: 'name',
                    required: true,
                }),
            ];
        },
    );

    assert.deepEqual(result.requiredCategories, ['information']);

    const information = schemaObject(result.properties.information);
    assert.deepEqual(information.required, ['name']);
    assert.deepEqual(schemaObject(information.properties?.name).type, 'string');

    const attributes = schemaObject(result.properties.attributes);
    const growthWindow = schemaObject(attributes.properties?.growthWindow);
    assert.equal(growthWindow.type, 'object');
    assert.deepEqual(growthWindow.required, ['min', 'max']);
    assert.equal(schemaObject(growthWindow.properties?.min).type, 'number');
    assert.equal(schemaObject(growthWindow.properties?.max).type, 'number');

    const tips = schemaObject(attributes.properties?.tips);
    assert.equal(tips.type, 'array');
    const tipItem = schemaObject(tips.items);
    assert.deepEqual(tipItem.required, ['header', 'content']);
    assert.equal(schemaObject(tipItem.properties?.header).type, 'string');
    assert.equal(schemaObject(tipItem.properties?.content).type, 'string');

    const stages = schemaObject(attributes.properties?.stages);
    assert.equal(stages.type, 'array');
    const stageItem = schemaObject(stages.items);
    assert.deepEqual(stageItem.required, ['id', 'information']);
    assert.equal(schemaObject(stageItem.properties?.id).type, 'number');
});

test('buildAttributeDefinitionProperties fails clearly for unsupported CMS data types', async () => {
    await assert.rejects(
        () =>
            buildAttributeDefinitionProperties([
                attributeDefinition({
                    category: 'attributes',
                    dataType: 'color',
                    entityTypeName: 'plant',
                    name: 'accent',
                }),
            ]),
        (error) => {
            assert.ok(error instanceof UnsupportedCmsAttributeDataTypeError);
            assert.match(
                error.message,
                /Unsupported CMS attribute data type "color" for plant\.attributes\.accent\./,
            );
            return true;
        },
    );
});
