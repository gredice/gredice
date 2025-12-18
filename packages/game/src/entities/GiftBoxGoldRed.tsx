import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { GiftBox } from './helpers/GiftBox';

export function GiftBoxGoldRed(props: EntityInstanceProps) {
    return <GiftBox {...props} boxColor="#FFD700" ribbonColor="#DC143C" />;
}
