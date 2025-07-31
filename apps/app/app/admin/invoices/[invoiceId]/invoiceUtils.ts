// Client-safe invoice utility functions
export type InvoiceStatus = 'draft' | 'pending' | 'sent' | 'paid' | 'cancelled';

export function isValidStatusTransition(currentStatus: InvoiceStatus, newStatus: InvoiceStatus): boolean {
    const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
        'draft': ['pending', 'cancelled'],
        'pending': ['sent', 'cancelled'],
        'sent': ['paid'],
        'paid': [], // Cannot transition from paid
        'cancelled': [] // Cannot transition from cancelled
    };

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}

export function canEditInvoice(status: InvoiceStatus): boolean {
    return status === 'draft' || status === 'pending';
}

export function canDeleteInvoice(status: InvoiceStatus): boolean {
    return status === 'draft' || status === 'pending';
}

export function canCancelInvoice(status: InvoiceStatus): boolean {
    return status === 'draft' || status === 'pending' || status === 'sent';
}

export function isOverdue(invoice: { status: string; dueDate: Date; paidDate?: Date | null }): boolean {
    if (invoice.status === 'paid' || invoice.paidDate) {
        return false;
    }
    return invoice.status === 'sent' && new Date() > new Date(invoice.dueDate);
}
