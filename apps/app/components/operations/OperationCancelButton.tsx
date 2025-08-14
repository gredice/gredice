"use client";

import { Button } from "@signalco/ui-primitives/Button";
import { Close } from "@signalco/ui-icons";
import { CancelOperationModal } from "../../app/admin/schedule/CancelOperationModal";

interface OperationCancelButtonProps {
    operation: {
        id: number;
        entityId: number;
        scheduledDate?: Date;
        status: string;
    };
    operationLabel: string;
}

export function OperationCancelButton({ operation, operationLabel }: OperationCancelButtonProps) {
    // Only show cancel button for new and planned operations
    if (operation.status === 'completed' || operation.status === 'failed' || operation.status === 'canceled') {
        return null;
    }

    return (
        <CancelOperationModal
            operation={operation}
            operationLabel={operationLabel}
            trigger={
                <Button
                    variant="plain"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Otkaži operaciju"
                >
                    <Close className="size-3" />
                </Button>
            }
        />
    );
}
