import type { EntityInstanceProps } from '../../types/runtime/EntityInstanceProps';
import { MulchPatchEntity } from './MulchPatch';

export function MulchHey(props: EntityInstanceProps) {
    return <MulchPatchEntity {...props} />;
}
