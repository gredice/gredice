import 'server-only';

import type {
    DirectoryEntityDataMap,
    DirectoryEntityTypeName,
} from '@gredice/directory-types';
import { getEntitiesFormatted } from '@gredice/storage';

/**
 * Read published directory entities from the shared storage layer.
 *
 * Static generation must not depend on the public API: an HTTP/WAF failure can
 * otherwise look like an empty catalogue and publish valid routes as 404s.
 */
export function getDirectoryEntitiesData<
    TEntityTypeName extends DirectoryEntityTypeName,
>(entityTypeName: TEntityTypeName) {
    return getEntitiesFormatted<DirectoryEntityDataMap[TEntityTypeName]>(
        entityTypeName,
    );
}
