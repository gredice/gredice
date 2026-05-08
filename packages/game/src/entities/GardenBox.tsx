import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { GardenBox as GardenBoxBase } from './helpers/GardenBox';

export function GardenBox(props: EntityInstanceProps) {
    return <GardenBoxBase {...props} bodyColor="#8B5A2B" trimColor="#5E3A1D" />;
}
