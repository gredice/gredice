import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { GiftBox } from './helpers/GiftBox';

export function GiftBoxGreenGold(props: EntityInstanceProps) {
    return <GiftBox {...props} boxColor="#228B22" ribbonColor="#FFD700" />;
}
