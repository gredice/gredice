import {
    generateLSystemStringWithGenerations,
    type LSystemSymbol,
} from '../lib/l-system';
import type {
    LSystemWorkerRequest,
    LSystemWorkerResponse,
} from '../lib/l-system-worker-types';
import { SeededRNG } from '../lib/rng';

const workerScope = self as DedicatedWorkerGlobalScope;

function generateSymbols({
    axiom,
    rules,
    iterations,
    seed,
}: LSystemWorkerRequest['tasks'][number]): LSystemSymbol[] {
    return generateLSystemStringWithGenerations(
        axiom,
        rules,
        iterations,
        new SeededRNG(seed),
    );
}

workerScope.onmessage = (event: MessageEvent<LSystemWorkerRequest>) => {
    const response: LSystemWorkerResponse = {
        id: event.data.id,
        results: event.data.tasks.map(generateSymbols),
    };

    workerScope.postMessage(response);
};
