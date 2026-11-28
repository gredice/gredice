import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { GiftBox, giftBoxPalettes } from './helpers/GiftBox';

export function GiftBoxWhiteGreen(props: EntityInstanceProps) {
    return <GiftBox {...props} {...giftBoxPalettes.GiftBox_WhiteGreen} />;
}
