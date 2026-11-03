import { Children, isValidElement, type ReactNode } from 'react';

/**
 * Resolves a `trigger` prop into the element passed to a Base UI trigger's
 * `render` prop, or `undefined` when the trigger should be rendered as the
 * trigger's children instead.
 *
 * Elements created in Server Components can reach client components as lazy
 * nodes while their client modules are still loading, so `isValidElement`
 * alone can differ between SSR and hydration. `Children.toArray` unwraps
 * those lazy nodes (suspending until they resolve).
 */
export function getTriggerRender(trigger: ReactNode) {
    const nodes = Children.toArray(trigger);
    const [node] = nodes;
    return nodes.length === 1 && isValidElement(node) ? node : undefined;
}
