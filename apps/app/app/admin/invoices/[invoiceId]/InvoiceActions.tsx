'use client';

import { Button } from "@signalco/ui-primitives/Button";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { ModalConfirm } from "@signalco/ui/ModalConfirm";
import { Edit, Delete, Send, Check, Clear, FileText } from "@signalco/ui-icons";
import { useState, useTransition, useEffect } from "react";
import { changeInvoiceStatusAction, cancelInvoiceAction, deleteInvoiceAction, createReceiptAction, getInvoiceReceiptAction } from "./actions";
import { canEditInvoice, canDeleteInvoice, canCancelInvoice, InvoiceStatus } from "./invoiceUtils";
import Link from "next/link";
import { KnownPages } from "../../../../src/KnownPages";

type Invoice = {
    id: number;
    status: string;
    invoiceNumber: string;
};

interface InvoiceActionsProps {
    invoice: Invoice;
}

export function InvoiceActions({ invoice }: InvoiceActionsProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [existingReceipt, setExistingReceipt] = useState<any>(null);
    const [receiptChecked, setReceiptChecked] = useState(false);

    const status = invoice.status as InvoiceStatus;
    const canEdit = canEditInvoice(status);
    const canDelete = canDeleteInvoice(status);
    const canCancel = canCancelInvoice(status);

    // Check for existing receipt when invoice is paid
    useEffect(() => {
        if (status === 'paid' && !receiptChecked) {
            startTransition(async () => {
                const result = await getInvoiceReceiptAction(invoice.id);
                if (result.success) {
                    setExistingReceipt(result.receipt);
                }
                setReceiptChecked(true);
            });
        }
    }, [status, invoice.id, receiptChecked]);

    const handleStatusChange = (newStatus: InvoiceStatus) => {
        startTransition(async () => {
            setError(null);
            const result = await changeInvoiceStatusAction(invoice.id, newStatus);
            if (!result.success) {
                setError(result.error || 'Failed to change status');
            }
        });
    };

    const handleCancel = () => {
        startTransition(async () => {
            setError(null);
            const result = await cancelInvoiceAction(invoice.id);
            if (!result.success) {
                setError(result.error || 'Failed to cancel invoice');
            }
        });
    };

    const handleDelete = () => {
        startTransition(async () => {
            setError(null);
            await deleteInvoiceAction(invoice.id);
        });
    };

    const handleCreateReceipt = () => {
        startTransition(async () => {
            setError(null);
            const result = await createReceiptAction(invoice.id);
            if (result && !result.success) {
                setError(result.error || 'Failed to create receipt');
            }
        });
    };

    return (
        <Stack spacing={2}>
            {error && (
                <Typography level="body2" className="text-red-600 bg-red-50 p-2 rounded">
                    {error}
                </Typography>
            )}

            <Row spacing={2} className="flex-wrap">
                {/* Edit Button */}
                {canEdit && (
                    <Button
                        variant="outlined"
                        startDecorator={<Edit className="size-4" />}
                        disabled={isPending}
                    >
                        <Link href={`${KnownPages.Invoice(invoice.id)}/edit`}>
                            Uredi
                        </Link>
                    </Button>
                )}

                {/* Status Transition Buttons */}
                {status === 'draft' && (
                    <Button
                        variant="soft"
                        startDecorator={<FileText className="size-4" />}
                        disabled={isPending}
                        onClick={() => handleStatusChange('pending')}
                    >
                        Postavi na čekanje
                    </Button>
                )}

                {status === 'pending' && (
                    <Button
                        variant="soft"
                        color="primary"
                        startDecorator={<Send className="size-4" />}
                        disabled={isPending}
                        onClick={() => handleStatusChange('sent')}
                    >
                        Pošalji
                    </Button>
                )}

                {status === 'sent' && (
                    <Button
                        variant="soft"
                        color="success"
                        startDecorator={<Check className="size-4" />}
                        disabled={isPending}
                        onClick={() => handleStatusChange('paid')}
                    >
                        Označi kao plaćeno
                    </Button>
                )}

                {/* Create Receipt Button - only when invoice is paid */}
                {status === 'paid' && receiptChecked && !existingReceipt && (
                    <Button
                        variant="soft"
                        color="primary"
                        startDecorator={<FileText className="size-4" />}
                        disabled={isPending}
                        onClick={handleCreateReceipt}
                    >
                        Stvori račun
                    </Button>
                )}

                {/* View Receipt Button - when receipt already exists */}
                {status === 'paid' && existingReceipt && (
                    <Button
                        variant="outlined"
                        startDecorator={<FileText className="size-4" />}
                        disabled={isPending}
                    >
                        <Link href={KnownPages.Receipt(existingReceipt.id)}>
                            Prikaži račun
                        </Link>
                    </Button>
                )}

                {/* Cancel Button */}
                {canCancel && (
                    <ModalConfirm
                        title="Potvrdi otkazivanje"
                        header={`Otkazivanje ponude ${invoice.invoiceNumber}`}
                        onConfirm={handleCancel}
                        trigger={(
                            <Button
                                variant="outlined"
                                color="warning"
                                startDecorator={<Clear className="size-4" />}
                                disabled={isPending}
                            >
                                Otkaži
                            </Button>
                        )}
                    >
                        <Typography>
                            Jeste li sigurni da želite otkazati ovu ponudu? Ova akcija se ne može poništiti.
                        </Typography>
                    </ModalConfirm>
                )}

                {/* Delete Button */}
                {canDelete && (
                    <ModalConfirm
                        title="Potvrdi brisanje"
                        header={`Brisanje ponude ${invoice.invoiceNumber}`}
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
                            Jeste li sigurni da želite obrisati ovu ponudu? Ova akcija se ne može poništiti.
                        </Typography>
                    </ModalConfirm>
                )}
            </Row>
        </Stack>
    );
}
