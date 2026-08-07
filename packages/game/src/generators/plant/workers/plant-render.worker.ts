import { GeneratedPlantTemplateCache } from '../hooks/generatedPlantTemplateCache';
import type { PackedPlantRenderWorkerRequest } from '../lib/plant-render-worker-types';
import { handlePlantRenderWorkerRequest } from './plant-render-worker-handler';

const workerScope = self as DedicatedWorkerGlobalScope;
const templateCache = new GeneratedPlantTemplateCache();

workerScope.onmessage = (
    event: MessageEvent<PackedPlantRenderWorkerRequest>,
) => {
    const { response, transferables } = handlePlantRenderWorkerRequest(
        event.data,
        undefined,
        templateCache,
    );
    workerScope.postMessage(response, transferables);
};
