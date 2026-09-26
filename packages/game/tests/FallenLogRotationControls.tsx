import { useBlockRotate } from '../src/hooks/useBlockRotate';
import { useCurrentGarden } from '../src/hooks/useCurrentGarden';

export function FallenLogRotationControls() {
    const { data: garden } = useCurrentGarden();
    const mutation = useBlockRotate();
    const block = garden?.stacks
        .flatMap((stack) => stack.blocks)
        .find((block) => block.id === 'log');
    return (
        <div>
            <button
                type="button"
                onClick={() =>
                    mutation.mutate({
                        blockId: 'log',
                        rotation: (block?.rotation ?? 0) + 1,
                    })
                }
            >
                Okreni deblo
            </button>
            <output data-testid="rotation">{block?.rotation}</output>
            <output data-testid="rotation-error">
                {mutation.error?.message}
            </output>
        </div>
    );
}
