"use client";

import { Button } from "@signalco/ui-primitives/Button";
import { Calendar } from "@signalco/ui-icons";
import { RescheduleOperationModal } from "../../app/admin/schedule/RescheduleOperationModal";

interface OperationRescheduleButtonProps {
    operation: {
        id: number;
        entityId: number;
        scheduledDate?: Date;
        status: string;
    };
    operationLabel: string;
}

export function OperationRescheduleButton({ operation, operationLabel }: OperationRescheduleButtonProps) {
    // Only show reschedule button for new and planned operations
    if (operation.status === 'completed' || operation.status === 'failed') {
        return null;
    }

    return (
        <RescheduleOperationModal
            operation={operation}
            operationLabel={operationLabel}
            trigger={
                <Button
                    variant="plain"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    title={operation.scheduledDate ? "Prerasporedi operaciju" : "Zakaži operaciju"}
                >
                    <Calendar className="size-3" />
                </Button>
            }
        />
    );
}
