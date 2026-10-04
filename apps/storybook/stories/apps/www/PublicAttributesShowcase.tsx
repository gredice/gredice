import { cx } from '@gredice/ui/utils';
import { PublicAttributeExamples } from './PublicAttributeExamples';

export function PublicAttributesShowcase({
    dark = false,
    missing = false,
}: {
    dark?: boolean;
    missing?: boolean;
}) {
    return (
        <main
            className={cx(
                'min-h-screen bg-background text-foreground',
                dark && 'dark',
            )}
        >
            <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
                <h1 className="text-2xl font-semibold">
                    Public attribute artwork
                </h1>
                <PublicAttributeExamples missing={missing} />
            </div>
        </main>
    );
}
