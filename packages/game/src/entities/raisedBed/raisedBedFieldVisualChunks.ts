export type FieldVisualLayerBase = {
    key: string;
    /**
     * Must cover every render-relevant property of the layer. Equal signatures
     * intentionally preserve the previous layer object and its instance arrays.
     */
    signature: string;
};

export type FieldVisualChunk<Layer extends FieldVisualLayerBase> = {
    key: string;
    layers: readonly Layer[];
};

function assertUniqueKeys(
    keys: readonly string[],
    description: 'chunk' | 'layer',
) {
    const seen = new Set<string>();

    for (const key of keys) {
        if (seen.has(key)) {
            throw new Error(
                `Duplicate field visual ${description} key: ${key}`,
            );
        }
        seen.add(key);
    }
}

function reconcileChunkLayers<Layer extends FieldVisualLayerBase>(
    previous: FieldVisualChunk<Layer>,
    next: FieldVisualChunk<Layer>,
) {
    assertUniqueKeys(
        next.layers.map((layer) => layer.key),
        'layer',
    );
    const previousLayerByKey = new Map(
        previous.layers.map((layer) => [layer.key, layer]),
    );
    const layers = next.layers.map((layer) => {
        const previousLayer = previousLayerByKey.get(layer.key);

        return previousLayer?.signature === layer.signature
            ? previousLayer
            : layer;
    });
    const canReusePreviousChunk =
        previous.layers.length === layers.length &&
        previous.layers.every((layer, index) => layer === layers[index]);

    return canReusePreviousChunk
        ? previous
        : {
              key: next.key,
              layers,
          };
}

/**
 * Reconciles immutable render descriptions while preserving unchanged layer
 * and chunk references. This lets memoized renderers update GPU buffers only
 * for the spatial chunk and compatible layer whose signature changed.
 */
export function reconcileFieldVisualChunks<Layer extends FieldVisualLayerBase>(
    previous: readonly FieldVisualChunk<Layer>[] | undefined,
    next: readonly FieldVisualChunk<Layer>[],
): readonly FieldVisualChunk<Layer>[] {
    assertUniqueKeys(
        next.map((chunk) => chunk.key),
        'chunk',
    );
    for (const chunk of next) {
        assertUniqueKeys(
            chunk.layers.map((layer) => layer.key),
            'layer',
        );
    }

    if (!previous) {
        return next;
    }

    const previousChunkByKey = new Map(
        previous.map((chunk) => [chunk.key, chunk]),
    );
    const reconciled = next.map((chunk) => {
        const previousChunk = previousChunkByKey.get(chunk.key);

        return previousChunk
            ? reconcileChunkLayers(previousChunk, chunk)
            : chunk;
    });
    const canReusePreviousList =
        previous.length === reconciled.length &&
        previous.every((chunk, index) => chunk === reconciled[index]);

    return canReusePreviousList ? previous : reconciled;
}
