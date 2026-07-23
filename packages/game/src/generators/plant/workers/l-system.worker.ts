import { GeneratedPlantTemplateCache } from '../hooks/generatedPlantTemplateCache';
import type { LSystemWorkerMessageRequest } from '../lib/l-system-worker-types';
import { handleLSystemWorkerRequest } from './l-system-worker-handler';

const workerScope = self as DedicatedWorkerGlobalScope;
const templateCache = new GeneratedPlantTemplateCache();

workerScope.onmessage = (event: MessageEvent<LSystemWorkerMessageRequest>) => {
    const { response, transferables } = handleLSystemWorkerRequest(
        event.data,
        undefined,
        templateCache,
    );

    workerScope.postMessage(response, transferables);
};
