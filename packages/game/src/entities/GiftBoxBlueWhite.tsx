import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { GiftBox } from './helpers/GiftBox';

export function GiftBoxBlueWhite(props: EntityInstanceProps) {
    return <GiftBox {...props} boxColor="#1E90FF" ribbonColor="#FFFFFF" />;
}
