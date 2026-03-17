import type { LSystemSymbol } from './l-system';
import type { Rule } from './plant-definitions';

export interface LSystemGenerationTask {
    axiom: string;
    rules: Record<string, Rule>;
    iterations: number;
    seed: string;
}

export interface LSystemWorkerRequest {
    id: number;
    tasks: LSystemGenerationTask[];
}

export interface LSystemWorkerResponse {
    id: number;
    results: LSystemSymbol[][];
}

export function getLSystemGenerationTaskKey(task: LSystemGenerationTask) {
    return JSON.stringify([task.axiom, task.rules, task.iterations, task.seed]);
}
