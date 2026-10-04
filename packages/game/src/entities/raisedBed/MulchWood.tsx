import type { EntityInstanceProps } from '../../types/runtime/EntityInstanceProps';
import { MulchPatchEntity } from './MulchPatch';

export function MulchWood(props: EntityInstanceProps) {
    return <MulchPatchEntity {...props} />;
}
