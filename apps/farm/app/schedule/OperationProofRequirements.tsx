import { Camera, FileText } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { ComponentType, SVGProps } from 'react';
import {
    isScheduleOperationRequirementVisible,
    type ScheduleOperationCompletionRequirements,
} from './scheduleOperationRequirements';

type RequirementItem = {
    Icon: ComponentType<SVGProps<SVGSVGElement>>;
    key: 'images' | 'notes';
    text: string;
};

interface OperationProofRequirementsProps {
    className?: string;
    id?: string;
    requirements: ScheduleOperationCompletionRequirements;
    showTitle?: boolean;
}

function getRequirementItems(
    requirements: ScheduleOperationCompletionRequirements,
) {
    const items: RequirementItem[] = [];

    if (isScheduleOperationRequirementVisible(requirements.images)) {
        items.push({
            Icon: Camera,
            key: 'images',
            text:
                requirements.images === 'required'
                    ? 'Dodaj fotografiju (obavezno)'
                    : 'Dodaj fotografiju (opcionalno)',
        });
    }

    if (isScheduleOperationRequirementVisible(requirements.notes)) {
        items.push({
            Icon: FileText,
            key: 'notes',
            text:
                requirements.notes === 'required'
                    ? 'Dodaj napomenu (obavezno)'
                    : 'Dodaj napomenu (opcionalno)',
        });
    }

    return items;
}

export function OperationProofRequirements({
    className,
    id,
    requirements,
    showTitle = true,
}: OperationProofRequirementsProps) {
    const items = getRequirementItems(requirements);
    if (items.length === 0) {
        return null;
    }
    const hasRequiredRequirement =
        requirements.images === 'required' || requirements.notes === 'required';

    return (
        <div
            aria-label="Zahtjevi dokaza završetka"
            className={cx(
                'rounded-md border px-2.5 py-2',
                hasRequiredRequirement
                    ? 'border-amber-200/80 bg-amber-50/70 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                    : 'border-border bg-muted/40 text-foreground',
                className,
            )}
            role="note"
        >
            {showTitle && (
                <Typography level="body2" semiBold className="text-inherit">
                    Dokaz završetka
                </Typography>
            )}
            <ul className={cx('space-y-1', showTitle && 'mt-1')} id={id}>
                {items.map(({ Icon, key, text }) => (
                    <li
                        className="flex min-w-0 items-start gap-2 text-sm leading-5"
                        key={key}
                    >
                        <Icon
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0"
                        />
                        <span className="min-w-0 [overflow-wrap:anywhere]">
                            {text}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
