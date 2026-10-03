import { useBlockRotate } from '../src/hooks/useBlockRotate';
import { useCurrentGarden } from '../src/hooks/useCurrentGarden';

export function ChestnutRoastingCartRotationControls() {
    const { data: garden } = useCurrentGarden();
    const mutation = useBlockRotate();
    const block = garden?.stacks
        .flatMap((stack) => stack.blocks)
        .find((block) => block.id === 'cart');
    return (
        <div>
            <button
                type="button"
                onClick={() =>
                    mutation.mutate({
                        blockId: 'cart',
                        rotation: (block?.rotation ?? 0) + 1,
                    })
                }
            >
                Okreni kolica
            </button>
            <output data-testid="rotation">{block?.rotation}</output>
            <output data-testid="rotation-error">
                {mutation.error?.message}
            </output>
        </div>
    );
}
