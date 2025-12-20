import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { GiftBox } from './helpers/GiftBox';

export function GiftBoxWhiteGreen(props: EntityInstanceProps) {
    return <GiftBox {...props} boxColor="#FFFFFF" ribbonColor="#006400" />;
}
