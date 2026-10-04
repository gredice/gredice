import type { EntityInstanceProps } from '../../types/runtime/EntityInstanceProps';
import { MulchPatchEntity } from './MulchPatch';

export function MulchCoconut(props: EntityInstanceProps) {
    return <MulchPatchEntity {...props} />;
}
