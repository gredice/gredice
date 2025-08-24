import { createInvoice } from '@gredice/storage';
import { redirect } from 'next/navigation';
import { auth } from '../../../lib/auth/auth';

export async function createInvoiceServerAction(formData: FormData) {
    'use server';

    await auth(['admin']);

    try {
        // Extract form data
        const accountId = formData.get('accountId') as string;
        const transactionId = formData.get('transactionId') as string;
        const currency = formData.get('currency') as string;
        const status = formData.get('status') as string;
        const billToName = formData.get('billToName') as string;
        const billToEmail = formData.get('billToEmail') as string;
        const billToAddress = formData.get('billToAddress') as string;
        const billToCity = formData.get('billToCity') as string;
        const billToState = formData.get('billToState') as string;
        const billToZip = formData.get('billToZip') as string;
        const billToCountry = formData.get('billToCountry') as string;
        const notes = formData.get('notes') as string;
        const terms = formData.get('terms') as string;
        const issueDate = formData.get('issueDate') as string;
        const dueDate = formData.get('dueDate') as string;
        const subtotal = formData.get('subtotal') as string;
        const taxAmount = formData.get('taxAmount') as string;
        const totalAmount = formData.get('totalAmount') as string;

        // Generate invoice number
        const year = new Date().getFullYear();
        const invoiceNumber = `PON-${year}-${Date.now().toString()}`;

        // Prepare invoice data
        const invoiceData = {
            invoiceNumber,
            accountId,
            transactionId: transactionId ? parseInt(transactionId, 10) : null,
            subtotal,
            taxAmount,
            totalAmount,
            currency,
            status,
            issueDate: new Date(issueDate),
            dueDate: new Date(dueDate),
            billToName: billToName || null,
            billToEmail,
            billToAddress: billToAddress || null,
            billToCity: billToCity || null,
            billToState: billToState || null,
            billToZip: billToZip || null,
            billToCountry: billToCountry || null,
            notes: notes || null,
            terms: terms || null,
        };

        // Extract items from form data
        const items = [];
        let itemIndex = 0;
        while (formData.get(`item_${itemIndex}_description`)) {
            const description = formData.get(
                `item_${itemIndex}_description`,
            ) as string;
            const quantity = formData.get(
                `item_${itemIndex}_quantity`,
            ) as string;
            const unitPrice = formData.get(
                `item_${itemIndex}_unitPrice`,
            ) as string;
            const totalPrice = formData.get(
                `item_${itemIndex}_totalPrice`,
            ) as string;

            if (description.trim()) {
                items.push({
                    description,
                    quantity,
                    unitPrice,
                    totalPrice,
                });
            }
            itemIndex++;
        }

        // Create invoice
        const invoiceId = await createInvoice(invoiceData, items);

        redirect(`/admin/invoices/${invoiceId}`);
    } catch (error) {
        console.error('Error creating invoice:', error);
        throw new Error('Failed to create invoice');
    }
}
