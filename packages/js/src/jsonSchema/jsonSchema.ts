export type JsonSchema = { [key: string]: string | JsonSchema };

/**
 * Unwraps the schema string to schema object model.
 *
 * Format:
 *   key1:type,key2:type,...
 *   key is name of the property
 *   type is one of: string | number | boolean | schema
 *   when type is schema it is wrapped in {} like 'key1:{subkey1:string,subkey2:{subsubkey1:string}}
 * @param schema The schema string
 * @returns The unwrapped schema model.
 */
export function unwrapSchema(schema: string): JsonSchema {
    const result: JsonSchema = {};
    let depth = 0;
    let currentPair = '';

    for (let i = 0; i < schema.length; i++) {
        const char = schema[i];

        if (char === ',' && depth === 0) {
            processPair(currentPair);
            currentPair = '';
        } else {
            if (char === '{') depth++;
            if (char === '}') depth--;
            currentPair += char;
        }
    }

    if (currentPair) {
        processPair(currentPair);
    }

    function processPair(pair: string) {
        const [key, type] = pair.split(/:(.+)/); // Split only at the first colon
        if (!key || typeof type !== 'string') return;
        if (type.startsWith('{') && type.endsWith('}')) {
            result[key] = unwrapSchema(type.slice(1, -1));
        } else {
            result[key] = type;
        }
    }

    return result;
}