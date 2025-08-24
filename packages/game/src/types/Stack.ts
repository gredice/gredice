import type { Vector3 } from 'three';
import type { Block } from './Block';

export type Stack = {
    position: Vector3;
    blocks: Block[];
};
