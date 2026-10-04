import { Row } from '@gredice/ui/Row';
import { CopySummaryButton } from './CopySummaryButton';
import { ScheduleDaySummary } from './ScheduleDaySummary';

interface ScheduleDayHeaderProps {
    approvedTasksCount: number;
    completedTasksCount: number;
    totalTasksCount: number;
    approvedDuration: number;
    completedDuration: number;
    totalDuration: number;
    summaryCopyText: string;
}

export function ScheduleDayHeader({
    approvedTasksCount,
    completedTasksCount,
    totalTasksCount,
    approvedDuration,
    completedDuration,
    totalDuration,
    summaryCopyText,
}: ScheduleDayHeaderProps) {
    return (
        <Row spacing={1} className="min-w-0 flex-wrap justify-end">
            <CopySummaryButton
                disabled={approvedTasksCount === 0}
                summaryText={summaryCopyText}
            />
            <ScheduleDaySummary
                approvedTasksCount={approvedTasksCount}
                completedTasksCount={completedTasksCount}
                totalTasksCount={totalTasksCount}
                approvedDuration={approvedDuration}
                completedDuration={completedDuration}
                totalDuration={totalDuration}
            />
        </Row>
    );
}
