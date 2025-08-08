import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from './testDb';
import {
    createInvoice,
    getInvoice,
    getInvoices,
    getAllInvoices,
    getInvoiceByNumber,
    getInvoicesByStatus,
    getOverdueInvoices,
    updateInvoice,
    markInvoiceAsPaid,
    deleteInvoice,
    addInvoiceItem,
    getInvoiceItems,
    calculateInvoiceTotals,
    getReceipt,
    getReceiptByInvoice,
    getReceiptByNumber,
    updateReceiptFiscalization,
    getReceiptsByStatus,
    ReceiptCreationData,
    InsertInvoice,
    InsertInvoiceItem,
    createTransaction,
    InsertTransaction,
    isValidStatusTransition,
    canEditInvoice,
    canDeleteInvoice,
    canCancelInvoice,
    isOverdue,
    changeInvoiceStatus,
    cancelInvoice,
    softDeleteInvoice
} from '@gredice/storage';
import { createTestAccount } from './helpers/testHelpers';

async function baseInvoice(transactionId?: number): Promise<InsertInvoice> {
    const accountId = await createTestAccount();
    const currentDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(currentDate.getDate() + 30); // 30 days from now

    return {
        accountId,
        transactionId,
        subtotal: '100.00',
        taxAmount: '8.00',
        totalAmount: '108.00',
        currency: 'usd',
        status: 'draft',
        issueDate: currentDate,
        dueDate,
        billToName: 'Test Customer',
        billToEmail: 'test@example.com',
        billToAddress: '123 Test St',
        billToCity: 'Test City',
        billToState: 'TS',
        billToZip: '12345',
        billToCountry: 'US',
        notes: 'Test invoice',
        terms: 'Net 30'
    };
}

async function baseTransaction(): Promise<InsertTransaction> {
    return {
        accountId: await createTestAccount(),
        amount: 10800, // $108.00 in cents
        currency: 'usd',
        status: 'completed',
        stripePaymentId: 'stripe-test-' + Date.now()
    };
}

async function baseInvoiceItem(invoiceId: number): Promise<InsertInvoiceItem> {
    return {
        invoiceId,
        description: 'Test Product',
        quantity: '2.00',
        unitPrice: '50.00',
        totalPrice: '100.00',
        entityId: 'prod-123',
        entityTypeName: 'plant'
    };
}

test('createInvoice and getInvoice', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    const invoiceId = await createInvoice(invoiceData);
    const invoice = await getInvoice(invoiceId);

    assert.ok(invoice);
    assert.strictEqual(invoice.id, invoiceId);
    assert.ok(Boolean(invoice.invoiceNumber), 'Invoice number should be generated');
    assert.strictEqual(invoice.totalAmount, invoiceData.totalAmount);
    assert.strictEqual(invoice.status, 'draft');
});

test('createInvoice with items', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    const invoiceId = await createInvoice(invoiceData);

    // Add items after creating the invoice
    await addInvoiceItem({
        invoiceId,
        description: 'Product 1',
        quantity: '1.00',
        unitPrice: '50.00',
        totalPrice: '50.00',
        entityId: 'prod-1',
        entityTypeName: 'plant'
    });

    await addInvoiceItem({
        invoiceId,
        description: 'Product 2',
        quantity: '1.00',
        unitPrice: '50.00',
        totalPrice: '50.00',
        entityId: 'prod-2',
        entityTypeName: 'plant'
    });

    const invoice = await getInvoice(invoiceId);

    assert.ok(invoice);
    assert.strictEqual(invoice.invoiceItems.length, 2);
    assert.strictEqual(invoice.invoiceItems[0].description, 'Product 1');
    assert.strictEqual(invoice.invoiceItems[1].description, 'Product 2');
});

test('createInvoice linked to transaction', async () => {
    createTestDb();
    const transactionData = await baseTransaction();
    const transactionId = await createTransaction(transactionData);

    const invoiceData = await baseInvoice(transactionId);
    const invoiceId = await createInvoice(invoiceData);

    const invoice = await getInvoice(invoiceId);
    assert.ok(invoice);
    assert.strictEqual(invoice.transactionId, transactionId);
    assert.ok(invoice.transaction);
    assert.strictEqual(invoice.transaction.id, transactionId);
});

test('getInvoiceByNumber', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    const invoiceId = await createInvoice(invoiceData);
    const invoiceById = await getInvoice(invoiceId);

    assert.ok(invoiceById);
    const invoice = await getInvoiceByNumber(invoiceById.invoiceNumber);
    assert.ok(invoice);
    assert.strictEqual(invoice.id, invoiceId);
    assert.strictEqual(invoice.invoiceNumber, invoiceById.invoiceNumber);
});

test('getInvoices returns invoices for account', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    const invoiceId = await createInvoice(invoiceData);

    const invoices = await getInvoices(invoiceData.accountId);
    assert.ok(Array.isArray(invoices));
    assert.ok(invoices.some(inv => inv.id === invoiceId));
});

test('getAllInvoices returns all invoices', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    const invoiceId = await createInvoice(invoiceData);

    const invoices = await getAllInvoices();
    assert.ok(Array.isArray(invoices));
    assert.ok(invoices.some(inv => inv.id === invoiceId));
});

test('getInvoicesByTransaction', async () => {
    createTestDb();
    const transactionData = await baseTransaction();
    const transactionId = await createTransaction(transactionData);

    const invoiceData = await baseInvoice(transactionId);
    const invoiceId = await createInvoice(invoiceData);

    const invoices = await getAllInvoices({ transactionId });
    assert.ok(Array.isArray(invoices));
    assert.strictEqual(invoices.length, 1);
    assert.strictEqual(invoices[0].id, invoiceId);
});

test('getInvoicesByStatus', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    const invoiceId = await createInvoice(invoiceData);

    const draftInvoices = await getInvoicesByStatus('draft');
    assert.ok(Array.isArray(draftInvoices));
    assert.ok(draftInvoices.some(inv => inv.id === invoiceId));

    const paidInvoices = await getInvoicesByStatus('paid');
    assert.ok(Array.isArray(paidInvoices));
    assert.ok(!paidInvoices.some(inv => inv.id === invoiceId));
});

test('updateInvoice status', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    const invoiceId = await createInvoice(invoiceData);

    await updateInvoice({
        id: invoiceId,
        status: 'sent'
    });

    const updatedInvoice = await getInvoice(invoiceId);
    assert.ok(updatedInvoice);
    assert.strictEqual(updatedInvoice.status, 'sent');
});

test('markInvoiceAsPaid', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    const invoiceId = await createInvoice(invoiceData);

    const paidDate = new Date();
    const receiptData: ReceiptCreationData = {
        paymentMethod: 'card',
        paymentReference: 'stripe-payment-123',
        businessPin: '12345678901',
        businessName: 'Test Business',
        businessAddress: 'Test Address 123, Zagreb',
    };

    const receiptId = await markInvoiceAsPaid(invoiceId, receiptData, paidDate);

    const paidInvoice = await getInvoice(invoiceId);
    assert.ok(paidInvoice);
    assert.strictEqual(paidInvoice.status, 'paid');
    assert.ok(paidInvoice.paidDate);

    // Verify receipt was created
    const receipt = await getReceipt(receiptId);
    assert.ok(receipt);
    assert.strictEqual(receipt.invoiceId, invoiceId);
    assert.strictEqual(receipt.paymentMethod, 'card');
    assert.strictEqual(receipt.businessPin, '12345678901');
});

test('deleteInvoice (soft delete)', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    const invoiceId = await createInvoice(invoiceData);

    await deleteInvoice(invoiceId);

    const deletedInvoice = await getInvoice(invoiceId);
    assert.strictEqual(deletedInvoice, undefined);
});

test('invoice items operations', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    const invoiceId = await createInvoice(invoiceData);

    // Add item
    const itemData = await baseInvoiceItem(invoiceId);
    const itemId = await addInvoiceItem(itemData);

    // Get items
    const items = await getInvoiceItems(invoiceId);
    assert.ok(Array.isArray(items));
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].id, itemId);
    assert.strictEqual(items[0].description, 'Test Product');
});

test('calculateInvoiceTotals', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    const invoiceId = await createInvoice(invoiceData);

    // Add some items
    await addInvoiceItem({
        invoiceId,
        description: 'Item 1',
        quantity: '2.00',
        unitPrice: '25.00',
        totalPrice: '50.00'
    });

    await addInvoiceItem({
        invoiceId,
        description: 'Item 2',
        quantity: '1.00',
        unitPrice: '30.00',
        totalPrice: '30.00'
    });

    const totals = await calculateInvoiceTotals(invoiceId);
    assert.strictEqual(totals.subtotal, '80.00');
    assert.strictEqual(totals.itemCount, 2);
});

test('getOverdueInvoices finds overdue invoices', async () => {
    createTestDb();

    // Create an overdue invoice (due date in the past)
    const invoiceData = await baseInvoice();
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5); // 5 days ago

    invoiceData.status = 'sent';
    invoiceData.dueDate = pastDate;

    const invoiceId = await createInvoice(invoiceData);

    const overdueInvoices = await getOverdueInvoices();
    assert.ok(Array.isArray(overdueInvoices));
    assert.ok(overdueInvoices.some(inv => inv.id === invoiceId));
});

test('getReceiptByInvoice returns receipt for paid invoice', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    const invoiceId = await createInvoice(invoiceData);

    const receiptData: ReceiptCreationData = {
        paymentMethod: 'cash',
        businessPin: '12345678901',
        businessName: 'Test Business',
    };

    const receiptId = await markInvoiceAsPaid(invoiceId, receiptData);

    const receipt = await getReceiptByInvoice(invoiceId);
    assert.ok(receipt);
    assert.strictEqual(receipt.id, receiptId);
    assert.strictEqual(receipt.invoiceId, invoiceId);
    assert.strictEqual(receipt.paymentMethod, 'cash');
});

test('getReceiptByNumber finds receipt by number', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    const invoiceId = await createInvoice(invoiceData);

    const receiptData: ReceiptCreationData = {
        paymentMethod: 'bank_transfer',
        paymentReference: 'bank-ref-456',
        businessPin: '98765432109',
    };

    const receiptId = await markInvoiceAsPaid(invoiceId, receiptData);
    const receipt = await getReceipt(receiptId);

    const foundReceipt = await getReceiptByNumber(receipt!.receiptNumber);
    assert.ok(foundReceipt);
    assert.strictEqual(foundReceipt.id, receiptId);
    assert.strictEqual(foundReceipt.paymentReference, 'bank-ref-456');
});

test('updateReceiptFiscalization updates Croatian fiscalization data', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    const invoiceId = await createInvoice(invoiceData);

    const receiptData: ReceiptCreationData = {
        paymentMethod: 'card',
        businessPin: '12345678901',
        businessName: 'Croatian Business d.o.o.',
        businessAddress: 'Ilica 1, 10000 Zagreb',
        customerPin: '98765432109',
        customerName: 'Test Customer d.o.o.',
    };

    const receiptId = await markInvoiceAsPaid(invoiceId, receiptData);

    // Simulate fiscalization with Croatian tax authority
    const fiscalizationData = {
        jir: '12345678-1234-1234-1234-123456789012',
        zki: 'ab123456',
        cisStatus: 'confirmed' as const,
        cisReference: 'CIS-REF-789',
        cisTimestamp: new Date(),
    };

    await updateReceiptFiscalization(receiptId, fiscalizationData);

    const fiscalizedReceipt = await getReceipt(receiptId);
    assert.ok(fiscalizedReceipt);
    assert.strictEqual(fiscalizedReceipt.jir, '12345678-1234-1234-1234-123456789012');
    assert.strictEqual(fiscalizedReceipt.zki, 'ab123456');
    assert.strictEqual(fiscalizedReceipt.cisStatus, 'confirmed');
    assert.strictEqual(fiscalizedReceipt.cisReference, 'CIS-REF-789');
    assert.strictEqual(fiscalizedReceipt.customerPin, '98765432109');
});

test('getReceiptsByStatus filters receipts by CIS status', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    const invoiceId = await createInvoice(invoiceData);

    const receiptData: ReceiptCreationData = {
        paymentMethod: 'card',
        businessPin: '12345678901',
    };

    const receiptId = await markInvoiceAsPaid(invoiceId, receiptData);

    // Initially should be pending
    const pendingReceipts = await getReceiptsByStatus('pending');
    assert.ok(Array.isArray(pendingReceipts));
    assert.ok(pendingReceipts.some(r => r.id === receiptId));

    // Update to confirmed
    await updateReceiptFiscalization(receiptId, {
        cisStatus: 'confirmed',
        jir: '12345678-1234-1234-1234-123456789012',
    });

    const confirmedReceipts = await getReceiptsByStatus('confirmed');
    assert.ok(Array.isArray(confirmedReceipts));
    assert.ok(confirmedReceipts.some(r => r.id === receiptId));
});

test('receipt contains all financial data from invoice', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    invoiceData.subtotal = '150.00';
    invoiceData.taxAmount = '15.00';
    invoiceData.totalAmount = '165.00';
    invoiceData.currency = 'eur';

    const invoiceId = await createInvoice(invoiceData);

    const receiptData: ReceiptCreationData = {
        paymentMethod: 'card',
        businessPin: '12345678901',
    };

    const receiptId = await markInvoiceAsPaid(invoiceId, receiptData);
    const receipt = await getReceipt(receiptId);

    assert.ok(receipt);
    assert.strictEqual(receipt.subtotal, '150.00');
    assert.strictEqual(receipt.taxAmount, '15.00');
    assert.strictEqual(receipt.totalAmount, '165.00');
    assert.strictEqual(receipt.currency, 'eur');
});

// New invoice status management tests
test('isValidStatusTransition validates status transitions', async () => {
    // Valid transitions
    assert.ok(isValidStatusTransition('draft', 'pending'));
    assert.ok(isValidStatusTransition('draft', 'cancelled'));
    assert.ok(isValidStatusTransition('pending', 'sent'));
    assert.ok(isValidStatusTransition('pending', 'cancelled'));
    assert.ok(isValidStatusTransition('sent', 'paid'));

    // Invalid transitions
    assert.ok(!isValidStatusTransition('paid', 'cancelled'));
    assert.ok(!isValidStatusTransition('paid', 'sent'));
    assert.ok(!isValidStatusTransition('cancelled', 'draft'));
    assert.ok(!isValidStatusTransition('sent', 'draft'));
});

test('canEditInvoice returns correct permissions', async () => {
    assert.ok(canEditInvoice('draft'));
    assert.ok(canEditInvoice('pending'));
    assert.ok(!canEditInvoice('sent'));
    assert.ok(!canEditInvoice('paid'));
    assert.ok(!canEditInvoice('cancelled'));
});

test('canDeleteInvoice returns correct permissions', async () => {
    assert.ok(canDeleteInvoice('draft'));
    assert.ok(canDeleteInvoice('pending'));
    assert.ok(!canDeleteInvoice('sent'));
    assert.ok(!canDeleteInvoice('paid'));
    assert.ok(!canDeleteInvoice('cancelled'));
});

test('canCancelInvoice returns correct permissions', async () => {
    assert.ok(canCancelInvoice('draft'));
    assert.ok(canCancelInvoice('pending'));
    assert.ok(canCancelInvoice('sent'));
    assert.ok(!canCancelInvoice('paid'));
    assert.ok(!canCancelInvoice('cancelled'));
});

test('isOverdue correctly identifies overdue invoices', async () => {
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 5);
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 5);

    // Overdue invoice (sent and past due date)
    assert.ok(isOverdue({ status: 'sent', dueDate: pastDate }));

    // Not overdue - future due date
    assert.ok(!isOverdue({ status: 'sent', dueDate: futureDate }));

    // Not overdue - paid invoice
    assert.ok(!isOverdue({ status: 'paid', dueDate: pastDate, paidDate: new Date() }));

    // Not overdue - not sent yet
    assert.ok(!isOverdue({ status: 'draft', dueDate: pastDate }));
});

test('changeInvoiceStatus transitions statuses correctly', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    const invoiceId = await createInvoice(invoiceData);

    // Transition from draft to pending
    await changeInvoiceStatus(invoiceId, 'pending');
    let invoice = await getInvoice(invoiceId);
    assert.ok(invoice);
    assert.strictEqual(invoice.status, 'pending');

    // Transition from pending to sent
    await changeInvoiceStatus(invoiceId, 'sent');
    invoice = await getInvoice(invoiceId);
    assert.ok(invoice);
    assert.strictEqual(invoice.status, 'sent');
});

test('changeInvoiceStatus prevents invalid transitions', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    invoiceData.status = 'sent';
    const invoiceId = await createInvoice(invoiceData);

    // Try invalid transition from sent to draft
    await assert.rejects(
        () => changeInvoiceStatus(invoiceId, 'draft'),
        /Invalid status transition from sent to draft/
    );
});

test('cancelInvoice cancels eligible invoices', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    invoiceData.status = 'pending';
    const invoiceId = await createInvoice(invoiceData);

    await cancelInvoice(invoiceId);

    const invoice = await getInvoice(invoiceId);
    assert.ok(invoice);
    assert.strictEqual(invoice.status, 'cancelled');
});

test('cancelInvoice prevents cancelling paid invoices', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    invoiceData.status = 'paid';
    const invoiceId = await createInvoice(invoiceData);

    await assert.rejects(
        () => cancelInvoice(invoiceId),
        /Cannot cancel invoice with status paid/
    );
});

test('softDeleteInvoice deletes eligible invoices', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    const invoiceId = await createInvoice(invoiceData);

    await softDeleteInvoice(invoiceId);

    const invoice = await getInvoice(invoiceId);
    assert.strictEqual(invoice, undefined);
});

test('softDeleteInvoice prevents deleting sent/paid invoices', async () => {
    createTestDb();
    const invoiceData = await baseInvoice();
    invoiceData.status = 'sent';
    const invoiceId = await createInvoice(invoiceData);

    await assert.rejects(
        () => softDeleteInvoice(invoiceId),
        /Cannot delete invoice with status sent/
    );
});
