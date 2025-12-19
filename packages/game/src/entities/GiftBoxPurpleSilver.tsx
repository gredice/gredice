import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { GiftBox } from './helpers/GiftBox';

export function GiftBoxPurpleSilver(props: EntityInstanceProps) {
    return <GiftBox {...props} boxColor="#8B008B" ribbonColor="#C0C0C0" />;
}
