import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { GiftBox } from './helpers/GiftBox';

export function GiftBoxRedWhite(props: EntityInstanceProps) {
    return (
        <GiftBox
            {...props}
            boxColor="#ff0000"
            ribbonColor="#ffffff"
            boxMetalness={0.5}
            boxRoughness={1.0}
        />
    );
}
