import type {
    AutomationDefinitionStatus,
    AutomationRunStatus,
    AutomationStepStatus,
} from '@gredice/storage';
import { cx } from '@gredice/ui/utils';
import {
    automationRunStatusMeta,
    automationStatusMeta,
    automationStepStatusMeta,
} from './presentation';

type StatusTone =
    | 'primary'
    | 'secondary'
    | 'error'
    | 'warning'
    | 'info'
    | 'success'
    | 'neutral';

const dotClassNames: Record<StatusTone, string> = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
    success: 'bg-green-500',
    neutral: 'bg-muted-foreground',
};

export function isAutomationRunLive(status: AutomationRunStatus) {
    return status === 'queued' || status === 'running' || status === 'retrying';
}

function isAutomationStepLive(status: AutomationStepStatus) {
    return status === 'pending' || status === 'running';
}

function AutomationStatusIndicator({
    className,
    label,
    pulse,
    tone,
}: {
    className?: string;
    label: string;
    pulse?: boolean;
    tone: StatusTone;
}) {
    return (
        <span
            className={cx(
                'inline-flex min-w-0 items-center gap-2 text-sm font-medium',
                className,
            )}
        >
            <span className="relative inline-flex size-2.5 shrink-0">
                {pulse ? (
                    <span
                        aria-hidden="true"
                        className={cx(
                            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
                            dotClassNames[tone],
                        )}
                    />
                ) : null}
                <span
                    aria-hidden="true"
                    className={cx(
                        'relative inline-flex size-2.5 rounded-full',
                        dotClassNames[tone],
                    )}
                />
            </span>
            <span className="truncate">{label}</span>
        </span>
    );
}

export function AutomationDefinitionStatusIndicator({
    className,
    status,
}: {
    className?: string;
    status: AutomationDefinitionStatus;
}) {
    const meta = automationStatusMeta(status);

    return (
        <AutomationStatusIndicator
            className={className}
            label={meta.label}
            tone={meta.color}
        />
    );
}

export function AutomationRunStatusIndicator({
    className,
    status,
}: {
    className?: string;
    status: AutomationRunStatus;
}) {
    const meta = automationRunStatusMeta(status);

    return (
        <AutomationStatusIndicator
            className={className}
            label={meta.label}
            pulse={isAutomationRunLive(status)}
            tone={meta.color}
        />
    );
}

export function AutomationStepStatusIndicator({
    className,
    status,
}: {
    className?: string;
    status: AutomationStepStatus;
}) {
    const meta = automationStepStatusMeta(status);

    return (
        <AutomationStatusIndicator
            className={className}
            label={meta.label}
            pulse={isAutomationStepLive(status)}
            tone={meta.color}
        />
    );
}
