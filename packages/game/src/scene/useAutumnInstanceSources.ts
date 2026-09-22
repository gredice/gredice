import { useLayoutEffect } from 'react';
import { Group } from 'three';
import type { EntityBlockInstance } from '../entities/EntityInstancesBlock';
import { useRegisterAutumnSources } from './AutumnSources';

/** Reuses the instance path's stack heights, rotations and drag-preview offsets. */
export function useAutumnInstanceSources(
    instances: EntityBlockInstance[] | undefined,
) {
    const register = useRegisterAutumnSources();
    useLayoutEffect(() => {
        const unregister = instances?.map((instance) => {
            const object = new Group();
            object.position.fromArray(instance.position);
            object.rotation.y = (instance.rotation * Math.PI) / 2;
            object.updateMatrixWorld();
            return register({ id: instance.block.id, object });
        });
        return () => {
            for (const dispose of unregister ?? []) dispose();
        };
    }, [instances, register]);
}
