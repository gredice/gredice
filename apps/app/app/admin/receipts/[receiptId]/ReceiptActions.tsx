'use client';

import { Button } from "@signalco/ui-primitives/Button";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { ModalConfirm } from "@signalco/ui/ModalConfirm";
import { Delete } from "@signalco/ui-icons";
import { useState, useTransition } from "react";
import { deleteReceiptAction } from "./actions";

type Receipt = {
    id: number;
    receiptNumber: string;
    cisStatus: string;
};

interface ReceiptActionsProps {
    receipt: Receipt;
}

export function ReceiptActions({ receipt }: ReceiptActionsProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // Don't allow deletion of fiscalized receipts (those with JIR)
    const canDelete = receipt.cisStatus === 'pending' || receipt.cisStatus === 'failed';

    const handleDelete = () => {
        startTransition(async () => {
            setError(null);
            const result = await deleteReceiptAction(receipt.id);
            if (result && !result.success) {
                setError(result.error || 'Failed to delete receipt');
            }
        });
    };

    return (
        <Row spacing={2} className="flex-wrap">
            {error && (
                <Typography level="body2" className="text-red-600 bg-red-50 p-2 rounded w-full">
                    {error}
                </Typography>
            )}

            {/* Delete Button - only for non-fiscalized receipts */}
            {canDelete && (
                <ModalConfirm
                    title="Potvrdi brisanje"
                    header={`Brisanje fiskalnog računa ${receipt.receiptNumber}`}
                    onConfirm={handleDelete}
                    trigger={(
                        <Button
                            variant="outlined"
                            color="danger"
                            startDecorator={<Delete className="size-4" />}
                            disabled={isPending}
                        >
                            Obriši
                        </Button>
                    )}
                >
                    <Typography>
                        Jeste li sigurni da želite obrisati ovaj fiskalni račun? Ova akcija se ne može poništiti.
                    </Typography>
                </ModalConfirm>
            )}

            {/* Info message for fiscalized receipts */}
            {!canDelete && (
                <Typography level="body2" className="text-amber-600 bg-amber-50 p-2 rounded">
                    Fiskalizirani računi se ne mogu obrisati.
                </Typography>
            )}
        </Row>
    );
}
