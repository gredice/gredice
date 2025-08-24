import { cx } from '@signalco/ui-primitives/cx';
import { Stack } from '@signalco/ui-primitives/Stack';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@signalco/ui-primitives/Tooltip';
import type { HTMLAttributes } from 'react';

export function AiWatermark({
    children,
    reason,
    aiPrompt,
    aiModel,
    className,
    ...rest
}: HTMLAttributes<HTMLDivElement> & {
    reason: string;
    aiPrompt?: string;
    aiModel?: string;
}) {
    return (
        <div className={cx('relative h-full', className)} {...rest}>
            {children}
            <Tooltip>
                <TooltipTrigger>
                    <div className="absolute bottom-0 right-0 p-2 font-extrabold text-sm text-gray-400/60 cursor-help">
                        AI
                    </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                    <Stack spacing={1}>
                        <div className="text-sm text-gray-500">
                            <span className="font-extrabold text-sm text-gray-400/60">
                                AI
                            </span>{' '}
                            Ova slika je generirana uz pomoć umjetne
                            inteligencije.
                        </div>
                        <div>
                            <div className="text-sm text-gray-500">
                                Namjena AI generiranog sadržaja:
                            </div>
                            <div className="text-sm text-gray-600 font-semibold">
                                {reason}
                            </div>
                        </div>
                        {aiPrompt && (
                            <div>
                                <div className="text-xs text-gray-500">
                                    AI upit:
                                </div>
                                <div className="text-xs text-gray-600 font-mono">
                                    {aiPrompt}
                                </div>
                            </div>
                        )}
                        {aiModel && (
                            <div>
                                <div className="text-xs text-gray-500">
                                    AI model:
                                </div>
                                <div className="text-xs text-gray-600 font-mono">
                                    {aiModel}
                                </div>
                            </div>
                        )}
                        <div className="text-xs text-gray-500">
                            Slike generirane uz pomoć umjetne inteligencije mogu
                            sadržavati greške i nepreciznosti. Molimo vas da ih
                            koristite s oprezom i da ne donosite važne odluke na
                            temelju njih. Ako primijetite bilo kakve greške ili
                            nepreciznosti, molimo vas da nas obavijestite.
                        </div>
                    </Stack>
                </TooltipContent>
            </Tooltip>
        </div>
    );
}