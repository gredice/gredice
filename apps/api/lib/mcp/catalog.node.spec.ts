import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    getMcpResourceCatalog,
    getMcpToolCatalog,
    getMcpToolNamesByDomain,
} from '../../app/api/mcp/catalog';

describe('MCP catalog contract scaffold', () => {
    test('exposes the current directories tool names in catalog order', () => {
        assert.deepEqual(getMcpToolNamesByDomain('directories'), [
            'directories/get-plants',
            'directories/get-plant',
            'directories/get-plant-sorts',
            'directories/search-entities',
            'directories/get-operations',
            'directories/get-seeds',
        ]);
    });

    test('keeps excluded tools out of the public catalog', () => {
        assert.equal(
            getMcpToolCatalog().some((tool) => tool.exposure === 'excluded'),
            false,
        );
    });

    test('documents static directory resource metadata', () => {
        assert.deepEqual(
            getMcpResourceCatalog().map((resource) => ({
                name: resource.name,
                exposure: resource.exposure,
                mimeType: resource.mimeType,
                uri: 'uri' in resource ? resource.uri : undefined,
                uriTemplate:
                    'uriTemplate' in resource
                        ? resource.uriTemplate
                        : undefined,
            })),
            [
                {
                    name: 'Directory entity types',
                    exposure: 'public-read',
                    mimeType: 'application/json',
                    uri: 'gredice://directories/entity-types',
                    uriTemplate: undefined,
                },
                {
                    name: 'Directory entity schema',
                    exposure: 'public-read',
                    mimeType: 'application/json',
                    uri: undefined,
                    uriTemplate:
                        'gredice://directories/entity-types/{entityTypeName}',
                },
            ],
        );
    });
});
