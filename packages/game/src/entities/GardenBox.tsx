import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { GardenBox as GardenBoxBase } from './helpers/GardenBox';

export function GardenBox(props: EntityInstanceProps) {
    return <GardenBoxBase {...props} />;
}
