'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Button } from "@signalco/ui-primitives/Button";
import { Input } from "@signalco/ui-primitives/Input";
import { Chip } from "@signalco/ui-primitives/Chip";
import { KnownPages } from "../../../../src/KnownPages";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Delete } from "@signalco/ui-icons";
import { DotIndicator } from '@signalco/ui-primitives/DotIndicator';

// Import actions based on mode
import { createInvoiceAction, getTransactionsAction, getShoppingCartsAction, getAccountDetailsAction, getShoppingCartItemsWithEntityNamesAction } from "../create/actions";
import { updateInvoiceAction } from "../[invoiceId]/edit/actions";
import { getInvoice } from "@gredice/storage";

const statusOptions = [
    { value: 'draft', label: 'Nacrt' },
    { value: 'pending', label: 'Na čekanju' },
    { value: 'sent', label: 'Poslan' },
];

const currencyOptions = [
    { value: 'eur', label: 'EUR (€)' },
];

interface InvoiceItem {
    id?: number;
    description: string;
    quantity: string;
    unitPrice: string;
    totalPrice: string;
}

interface InvoiceFormProps {
    mode: 'create' | 'edit';
    invoice?: Awaited<ReturnType<typeof getInvoice>>;
    onSuccess?: (invoiceId: number) => void;
}

export default function InvoiceForm({ mode, invoice, onSuccess }: InvoiceFormProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [showShoppingCartModal, setShowShoppingCartModal] = useState(false);
    const [transactions, setTransactions] = useState<NonNullable<Awaited<ReturnType<typeof getTransactionsAction>>['transactions']>>([]);
    const [shoppingCarts, setShoppingCarts] = useState<NonNullable<Awaited<ReturnType<typeof getShoppingCartsAction>>['shoppingCarts']>>([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [loadingShoppingCarts, setLoadingShoppingCarts] = useState(false);
    const [isAccountReadOnly, setIsAccountReadOnly] = useState(false);

    // Initialize form data based on mode
    const [formData, setFormData] = useState({
        accountId: mode === 'edit' ? (invoice?.accountId || '') : '',
        transactionId: mode === 'edit' ? (invoice?.transactionId?.toString() || '') : '',
        currency: mode === 'edit' ? (invoice?.currency || 'eur') : 'eur',
        status: mode === 'edit' ? (invoice?.status || 'draft') : 'draft',
        billToName: mode === 'edit' ? (invoice?.billToName || '') : '',
        billToEmail: mode === 'edit' ? (invoice?.billToEmail || '') : '',
        billToAddress: mode === 'edit' ? (invoice?.billToAddress || '') : '',
        billToCity: mode === 'edit' ? (invoice?.billToCity || '') : '',
        billToState: mode === 'edit' ? (invoice?.billToState || '') : '',
        billToZip: mode === 'edit' ? (invoice?.billToZip || '') : '',
        billToCountry: mode === 'edit' ? (invoice?.billToCountry || '') : '',
        notes: mode === 'edit' ? (invoice?.notes || '') : '',
        terms: mode === 'edit' ? (invoice?.terms || '') : '',
        issueDate: mode === 'edit'
            ? (invoice?.issueDate ? new Date(invoice.issueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
            : new Date().toISOString().split('T')[0],
        dueDate: mode === 'edit'
            ? (invoice?.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
        vatEnabled: mode === 'edit' ? (invoice?.taxAmount ? parseFloat(invoice.taxAmount) > 0 : false) : false,
    });

    // Initialize items based on mode
    const [items, setItems] = useState<InvoiceItem[]>(
        mode === 'edit' && (invoice?.invoiceItems?.length ?? 0) > 0
            ? invoice?.invoiceItems.map((item) => ({
                id: item.id,
                description: item.description || '',
                quantity: item.quantity?.toString() || '1',
                unitPrice: item.unitPrice?.toString() || '0',
                totalPrice: item.totalPrice?.toString() || '0',
            })) ?? []
            : [{ description: '', quantity: '1', unitPrice: '0', totalPrice: '0' }]
    );

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: field === 'vatEnabled' ? value === 'true' : value
        }));

        // Auto-populate account details when accountId changes (only in create mode)
        if (field === 'accountId' && value && mode === 'create') {
            populateAccountDetails(value);
        }

        // Reset read-only state when accountId is cleared
        if (field === 'accountId' && !value) {
            setIsAccountReadOnly(false);
        }
    };

    const populateAccountDetails = async (accountId: string) => {
        try {
            const result = await getAccountDetailsAction(accountId);
            if (result.success && result.account) {
                setFormData(prev => ({
                    ...prev,
                    billToEmail: result.account.email,
                    billToName: result.account.displayName || result.account.email,
                }));
                setIsAccountReadOnly(true);
            }
        } catch (error) {
            console.error('Error fetching account details:', error);
        }
    };

    const handleItemChange = (index: number, field: keyof InvoiceItem, value: string) => {
        setItems(prev => {
            const newItems = [...prev];
            newItems[index] = { ...newItems[index], [field]: value };

            // Auto-calculate total price for quantity and unit price changes
            if (field === 'quantity' || field === 'unitPrice') {
                const quantity = parseFloat(field === 'quantity' ? value : newItems[index].quantity) || 0;
                const unitPrice = parseFloat(field === 'unitPrice' ? value : newItems[index].unitPrice) || 0;
                newItems[index].totalPrice = (quantity * unitPrice).toFixed(2);
            }

            return newItems;
        });
    };

    const addItem = () => {
        setItems(prev => [...prev, { description: '', quantity: '1', unitPrice: '0', totalPrice: '0' }]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(prev => prev.filter((_, i) => i !== index));
        }
    };

    const calculateTotals = () => {
        const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);
        const taxRate = 0.25; // 25% VAT (Croatian standard rate)
        const taxAmount = formData.vatEnabled ? subtotal * taxRate : 0;
        const total = subtotal + taxAmount;

        return {
            subtotal: subtotal.toFixed(2),
            taxAmount: taxAmount.toFixed(2),
            total: total.toFixed(2)
        };
    };

    const fetchTransactions = async () => {
        setLoadingTransactions(true);
        try {
            const result = await getTransactionsAction();
            if (result.success) {
                setTransactions(result.transactions || []);
            } else {
                alert('Greška pri dohvaćanju transakcija: ' + result.error);
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
            alert('Greška pri dohvaćanju transakcija');
        } finally {
            setLoadingTransactions(false);
        }
    };

    const fetchShoppingCarts = async () => {
        setLoadingShoppingCarts(true);
        try {
            // Use the current accountId from formData if available
            const currentAccountId = formData.accountId || undefined;
            const result = await getShoppingCartsAction(currentAccountId);
            if (result.success) {
                setShoppingCarts(result.shoppingCarts || []);
            } else {
                alert('Greška pri dohvaćanju košarica: ' + result.error);
            }
        } catch (error) {
            console.error('Error fetching shopping carts:', error);
            alert('Greška pri dohvaćanju košarica');
        } finally {
            setLoadingShoppingCarts(false);
        }
    };

    const populateFromTransaction = async (transaction: NonNullable<Awaited<ReturnType<typeof getTransactionsAction>>['transactions']>[number]) => {
        setFormData(prev => ({
            ...prev,
            accountId: transaction.accountId || '',
            transactionId: transaction.id.toString(),
            currency: transaction.currency?.toUpperCase() || 'EUR',
            notes: `Ponuda za transakciju ${transaction.id}`,
        }));

        // Auto-populate account details
        if (transaction.accountId) {
            await populateAccountDetails(transaction.accountId);
        }

        // Create invoice item from transaction
        const transactionAmount = transaction.amount ? (transaction.amount / 100).toFixed(2) : '0'; // Convert from cents
        setItems([{
            description: `Transakcija ${transaction.stripePaymentId}`,
            quantity: '1',
            unitPrice: transactionAmount,
            totalPrice: transactionAmount
        }]);

        setShowTransactionModal(false);
    };

    const populateFromShoppingCart = async (cart: NonNullable<Awaited<ReturnType<typeof getShoppingCartsAction>>['shoppingCarts']>[number]) => {
        if (!cart.items || cart.items.length === 0) {
            alert('Košarica je prazna');
            return;
        }

        // Get enhanced items with entity names
        const enhancedItems = await getShoppingCartItemsWithEntityNamesAction(cart.items);

        setFormData(prev => ({
            ...prev,
            accountId: cart.accountId || '',
            currency: 'eur', // Always use EUR since we're filtering for EUR items
            notes: `Ponuda za košaricu ${cart.id}`,
        }));

        // Auto-populate account details
        if (cart.accountId) {
            await populateAccountDetails(cart.accountId);
        }

        // Convert shopping cart items to invoice items
        const invoiceItems = enhancedItems.map((item) => {
            return {
                description: item.entityName || `${item.entityTypeName}: ${item.entityId}`,
                quantity: '1',
                unitPrice: item.price.toFixed(2),
                totalPrice: item.price.toFixed(2)
            };
        });

        setItems(invoiceItems);
        setShowShoppingCartModal(false);
    };

    const { subtotal, taxAmount, total } = calculateTotals();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (mode === 'create') {
                const invoiceData = {
                    accountId: formData.accountId,
                    transactionId: formData.transactionId,
                    currency: formData.currency,
                    status: formData.status,
                    billToName: formData.billToName,
                    billToEmail: formData.billToEmail,
                    billToAddress: formData.billToAddress,
                    billToCity: formData.billToCity,
                    billToState: formData.billToState,
                    billToZip: formData.billToZip,
                    billToCountry: formData.billToCountry,
                    notes: formData.notes,
                    terms: formData.terms,
                    subtotal: subtotal.toString(),
                    taxAmount: taxAmount.toString(),
                    totalAmount: total.toString(),
                    issueDate: new Date(formData.issueDate),
                    dueDate: new Date(formData.dueDate),
                    items: items.filter(item => item.description.trim() !== '').map(item => ({
                        description: item.description,
                        quantity: item.quantity.toString(),
                        unitPrice: item.unitPrice.toString(),
                        totalPrice: (Number(item.quantity) * Number(item.unitPrice)).toString(),
                    }))
                };

                const result = await createInvoiceAction(invoiceData);

                if (result.success) {
                    if (onSuccess && result.invoiceId) {
                        onSuccess(result.invoiceId);
                    } else {
                        window.location.href = '/admin/invoices';
                    }
                } else {
                    alert('Greška prilikom kreiranja ponude: ' + result.error);
                }
            } else {
                if (!invoice) {
                    console.error('Invoice data is required for edit mode');
                    return;
                }

                // Edit mode
                const invoiceData = {
                    ...formData,
                    id: invoice.id,
                    subtotal: subtotal,
                    taxAmount: taxAmount,
                    totalAmount: total,
                    vatEnabled: formData.vatEnabled,
                    items: items.map(item => ({
                        id: item.id,
                        description: item.description,
                        quantity: parseFloat(item.quantity),
                        unitPrice: parseFloat(item.unitPrice),
                        totalPrice: parseFloat(item.totalPrice),
                    }))
                };

                const result = await updateInvoiceAction(invoiceData);
                if (result.success) {
                    if (onSuccess) {
                        onSuccess(invoice.id);
                    } else {
                        router.push(KnownPages.Invoice(invoice.id));
                    }
                } else {
                    alert('Greška pri ažuriranju ponude: ' + result.error);
                }
            }
        } catch (error) {
            console.error('Error submitting invoice:', error);
            alert(mode === 'create' ? 'Greška prilikom kreiranja ponude' : 'Greška pri ažuriranju ponude');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter status options for edit mode
    const availableStatusOptions = mode === 'edit'
        ? statusOptions.filter(option => option.value === 'draft' || option.value === 'pending')
        : statusOptions;

    return (
        <>
            <form onSubmit={handleSubmit}>
                <Stack spacing={4}>
                    <Row spacing={2} justifyContent="space-between" alignItems="center">
                        <Typography level="h1" className="text-2xl" semiBold>
                            {mode === 'create' ? 'Nova ponuda' : `Uredi ponudu ${invoice?.invoiceNumber}`}
                        </Typography>
                        <Row spacing={2}>
                            <Button
                                type="button"
                                variant="outlined"
                                color="neutral"
                                onClick={() => router.push(mode === 'create' || !invoice ? KnownPages.Invoices : KnownPages.Invoice(invoice.id))}
                            >
                                Odustani
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                color="primary"
                            >
                                {isSubmitting
                                    ? (mode === 'create' ? 'Kreiranje...' : 'Ažuriranje...')
                                    : (mode === 'create' ? 'Kreiraj ponudu' : 'Ažuriraj ponudu')
                                }
                            </Button>
                        </Row>
                    </Row>

                    <Row spacing={4} alignItems="stretch">
                        <Stack spacing={4} className="flex-1">
                            {/* Invoice Information */}
                            <Card>
                                <CardHeader>
                                    <Row spacing={2} justifyContent="space-between" alignItems="center">
                                        <CardTitle>Osnovni podaci</CardTitle>
                                        {mode === 'create' && (
                                            <Row spacing={2}>
                                                <Button
                                                    type="button"
                                                    variant="outlined"
                                                    size="sm"
                                                    onClick={() => {
                                                        setShowTransactionModal(true);
                                                        fetchTransactions();
                                                    }}
                                                >
                                                    📋 Poveži transakciju
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outlined"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (!formData.accountId.trim()) {
                                                            alert('Molimo unesite Account ID prije odabira košarice');
                                                            return;
                                                        }
                                                        setShowShoppingCartModal(true);
                                                        fetchShoppingCarts();
                                                    }}
                                                >
                                                    🛒 Poveži košaricu
                                                    {formData.accountId && (
                                                        <span className="ml-1 text-xs text-gray-500">
                                                            ({formData.accountId.slice(0, 8)}...)
                                                        </span>
                                                    )}
                                                </Button>
                                            </Row>
                                        )}
                                    </Row>
                                </CardHeader>
                                <CardContent>
                                    <Stack spacing={3}>
                                        {mode === 'create' && (
                                            <Row spacing={3}>
                                                <Stack spacing={1} className="flex-1">
                                                    <Typography level="body2" className="text-gray-600">Account ID</Typography>
                                                    <Input
                                                        value={formData.accountId}
                                                        onChange={(e) => handleInputChange('accountId', e.target.value)}
                                                        placeholder="Unesite account ID"
                                                        required
                                                    />
                                                </Stack>
                                                <Stack spacing={1} className="flex-1">
                                                    <Typography level="body2" className="text-gray-600">Transaction ID (neobavezno)</Typography>
                                                    <Input
                                                        value={formData.transactionId}
                                                        onChange={(e) => handleInputChange('transactionId', e.target.value)}
                                                        placeholder="ID povezane transakcije"
                                                        type="number"
                                                    />
                                                </Stack>
                                            </Row>
                                        )}
                                        <Row spacing={3}>
                                            <Stack spacing={1} className="flex-1">
                                                <Typography level="body2" className="text-gray-600">Valuta</Typography>
                                                <select
                                                    value={formData.currency}
                                                    onChange={(e) => handleInputChange('currency', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    {currencyOptions.map(option => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </Stack>
                                            <Stack spacing={1} className="flex-1">
                                                <Typography level="body2" className="text-gray-600">Status</Typography>
                                                <select
                                                    value={formData.status}
                                                    onChange={(e) => handleInputChange('status', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    {availableStatusOptions.map(option => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </Stack>
                                        </Row>
                                        <Row spacing={3}>
                                            <Stack spacing={1} className="flex-1">
                                                <Typography level="body2" className="text-gray-600">Datum izdavanja</Typography>
                                                <Input
                                                    type="date"
                                                    value={formData.issueDate}
                                                    onChange={(e) => handleInputChange('issueDate', e.target.value)}
                                                    required
                                                />
                                            </Stack>
                                            <Stack spacing={1} className="flex-1">
                                                <Typography level="body2" className="text-gray-600">Datum dospijeća</Typography>
                                                <Input
                                                    type="date"
                                                    value={formData.dueDate}
                                                    onChange={(e) => handleInputChange('dueDate', e.target.value)}
                                                    required
                                                />
                                            </Stack>
                                        </Row>
                                        <Row spacing={3}>
                                            <Stack spacing={1} className="flex-1">
                                                <Typography level="body2" className="text-gray-600">PDV</Typography>
                                                <label className="flex items-center space-x-2 p-3 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.vatEnabled}
                                                        onChange={(e) => handleInputChange('vatEnabled', e.target.checked.toString())}
                                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm">
                                                        {formData.vatEnabled ? 'PDV uključen (25%)' : 'PDV isključen'}
                                                    </span>
                                                </label>
                                            </Stack>
                                            <Stack spacing={1} className="flex-1">
                                                {/* Empty column for alignment */}
                                            </Stack>
                                        </Row>
                                    </Stack>
                                </CardContent>
                            </Card>

                            {/* Customer Information */}
                            <Card>
                                <CardHeader>
                                    <Row className="justify-between items-center">
                                        <CardTitle>Podaci o kupcu</CardTitle>
                                        {isAccountReadOnly && mode === 'create' && (
                                            <Button
                                                variant="outlined"
                                                size="sm"
                                                onClick={() => setIsAccountReadOnly(false)}
                                            >
                                                Ručno uređivanje
                                            </Button>
                                        )}
                                    </Row>
                                </CardHeader>
                                <CardContent>
                                    <Stack spacing={3}>
                                        <Stack spacing={1}>
                                            <Typography level="body2" className="text-gray-600">Naziv *</Typography>
                                            <Input
                                                value={formData.billToName}
                                                onChange={(e) => handleInputChange('billToName', e.target.value)}
                                                placeholder="Naziv kupca"
                                                required
                                                disabled={isAccountReadOnly}
                                            />
                                            {isAccountReadOnly && (
                                                <Typography level="body3" className="text-gray-500">
                                                    Automatski ispunjeno iz podataka ponude
                                                </Typography>
                                            )}
                                        </Stack>
                                        <Stack spacing={1}>
                                            <Typography level="body2" className="text-gray-600">Email</Typography>
                                            <Input
                                                type="email"
                                                value={formData.billToEmail}
                                                onChange={(e) => handleInputChange('billToEmail', e.target.value)}
                                                placeholder="email@example.com"
                                                disabled={isAccountReadOnly}
                                            />
                                            {isAccountReadOnly && (
                                                <Typography level="body3" className="text-gray-500">
                                                    Automatski ispunjeno iz podataka ponude
                                                </Typography>
                                            )}
                                        </Stack>
                                        <Stack spacing={1}>
                                            <Typography level="body2" className="text-gray-600">Adresa</Typography>
                                            <textarea
                                                value={formData.billToAddress}
                                                onChange={(e) => handleInputChange('billToAddress', e.target.value)}
                                                placeholder="Ulica i broj&#10;Poštanski broj Grad&#10;Država"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                                rows={3}
                                            />
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Stack>

                        <Stack spacing={4} className="flex-1">
                            {/* Summary and Invoice Details */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Sažetak</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Stack spacing={2}>
                                        <Row justifyContent="space-between">
                                            <Typography level="body2" className="text-gray-600">Osnovica</Typography>
                                            <Typography>€{subtotal}</Typography>
                                        </Row>
                                        {formData.vatEnabled && (
                                            <Row justifyContent="space-between">
                                                <Typography level="body2" className="text-gray-600">PDV (25%)</Typography>
                                                <Typography>€{taxAmount}</Typography>
                                            </Row>
                                        )}
                                        <Row justifyContent="space-between" className="border-t pt-2">
                                            <Typography semiBold>Ukupno</Typography>
                                            <Typography level="h3" semiBold>€{total}</Typography>
                                        </Row>
                                    </Stack>
                                </CardContent>
                            </Card>

                            {/* Notes and Terms */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Napomene i uvjeti</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Stack spacing={3}>
                                        <Stack spacing={1}>
                                            <Typography level="body2" className="text-gray-600">Napomene</Typography>
                                            <textarea
                                                value={formData.notes}
                                                onChange={(e) => handleInputChange('notes', e.target.value)}
                                                placeholder="Dodatne napomene..."
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                                rows={3}
                                            />
                                        </Stack>
                                        <Stack spacing={1}>
                                            <Typography level="body2" className="text-gray-600">Uvjeti</Typography>
                                            <textarea
                                                value={formData.terms}
                                                onChange={(e) => handleInputChange('terms', e.target.value)}
                                                placeholder="Uvjeti plaćanja..."
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                                rows={3}
                                            />
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Stack>
                    </Row>

                    {/* Invoice Items */}
                    <Card>
                        <CardHeader>
                            <Row justifyContent="space-between" alignItems="center">
                                <CardTitle>Stavke ponude</CardTitle>
                                <Button type="button" variant="link" onClick={addItem}>
                                    + Dodaj stavku
                                </Button>
                            </Row>
                        </CardHeader>
                        <CardContent>
                            <Stack spacing={2}>
                                {items.map((item, index) => (
                                    <Card key={index} className="border-l-4 border-l-blue-200">
                                        <CardContent className="pt-4">
                                            <Stack spacing={3}>
                                                <Row spacing={2} alignItems="start">
                                                    <Stack spacing={1} className="flex-1">
                                                        <Typography level="body2">Opis *</Typography>
                                                        <Input
                                                            value={item.description}
                                                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                                            placeholder="Opis proizvoda/usluge"
                                                            required
                                                        />
                                                    </Stack>
                                                    <IconButton
                                                        onClick={() => removeItem(index)}
                                                        disabled={items.length === 1}
                                                        className="mt-6"
                                                        aria-labelledby="delete-item"
                                                    >
                                                        <Delete />
                                                    </IconButton>
                                                </Row>
                                                <Row spacing={2}>
                                                    <Stack spacing={1} className="flex-1">
                                                        <Typography level="body2">Količina *</Typography>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={item.quantity}
                                                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                            required
                                                        />
                                                    </Stack>
                                                    <Stack spacing={1} className="flex-1">
                                                        <Typography level="body2">Jedinična cijena (€) *</Typography>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={item.unitPrice}
                                                            onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                                                            required
                                                        />
                                                    </Stack>
                                                    <Stack spacing={1} className="flex-1">
                                                        <Typography level="body2">Ukupno (€)</Typography>
                                                        <Input
                                                            value={item.totalPrice}
                                                            disabled
                                                            className="bg-gray-50"
                                                        />
                                                    </Stack>
                                                </Row>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                        </CardContent>
                    </Card>
                </Stack>
            </form>

            {/* Transaction Selection Modal - Only for create mode */}
            {mode === 'create' && showTransactionModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
                        <div className="p-6 border-b">
                            <Row spacing={2} justifyContent="space-between" alignItems="center">
                                <Typography level="h3" semiBold>Odaberite transakciju</Typography>
                                <Button variant="link" onClick={() => setShowTransactionModal(false)}>✕</Button>
                            </Row>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-96">
                            {loadingTransactions ? (
                                <div className="flex items-center justify-center">
                                    <DotIndicator color="neutral" />
                                    <Typography className="ml-2">Učitavanje transakcija...</Typography>
                                </div>
                            ) : transactions.length === 0 ? (
                                <Typography>Nema dostupnih transakcija</Typography>
                            ) : (
                                <Stack spacing={2}>
                                    {transactions.map((transaction) => (
                                        <Card key={transaction.id} className="cursor-pointer hover:bg-gray-50" onClick={() => populateFromTransaction(transaction)}>
                                            <CardContent>
                                                <Row spacing={2} justifyContent="space-between">
                                                    <Stack spacing={1}>
                                                        <Typography semiBold>#{transaction.id}</Typography>
                                                        <Typography level="body2" className="text-gray-600">
                                                            Account: {transaction.accountId}
                                                        </Typography>
                                                        <Typography level="body2" className="text-gray-600">
                                                            {transaction.stripePaymentId}
                                                        </Typography>
                                                    </Stack>
                                                    <Stack spacing={1} alignItems="start">
                                                        <Typography semiBold>
                                                            {((transaction.amount || 0) / 100).toFixed(2)} {(transaction.currency || 'EUR').toUpperCase()}
                                                        </Typography>
                                                        <Chip className="w-fit" color={transaction.status === 'paid' ? 'success' : 'neutral'}>
                                                            {transaction.status}
                                                        </Chip>
                                                    </Stack>
                                                </Row>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </Stack>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Shopping Cart Selection Modal - Only for create mode */}
            {mode === 'create' && showShoppingCartModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
                        <div className="p-6 border-b">
                            <Row spacing={2} justifyContent="space-between" alignItems="center">
                                <Stack spacing={1}>
                                    <Typography level="h3" semiBold>Odaberite košaricu</Typography>
                                    {formData.accountId && (
                                        <Typography level="body2" className="text-gray-600">
                                            Košarice za korisnički račun: {formData.accountId}
                                        </Typography>
                                    )}
                                </Stack>
                                <Button variant="link" onClick={() => setShowShoppingCartModal(false)}>✕</Button>
                            </Row>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-96">
                            {loadingShoppingCarts ? (
                                <div className="flex items-center justify-center">
                                    <DotIndicator color="neutral" />
                                    <Typography className="ml-2">Učitavanje košarica...</Typography>
                                </div>
                            ) : shoppingCarts.length === 0 ? (
                                <Typography>Nema dostupnih košarica</Typography>
                            ) : (
                                <Stack spacing={2}>
                                    {shoppingCarts.map((cart) => (
                                        <Card key={cart.id} className="cursor-pointer hover:bg-gray-50" onClick={() => populateFromShoppingCart(cart)}>
                                            <CardContent>
                                                <Row spacing={2} justifyContent="space-between">
                                                    <Stack spacing={1}>
                                                        <Typography semiBold>Košarica #{cart.id}</Typography>
                                                        <Typography level="body2" className="text-gray-600">
                                                            Account: {cart.accountId}
                                                        </Typography>
                                                        <Typography level="body2" className="text-gray-600">
                                                            Stavki: {cart.items?.length || 0}
                                                        </Typography>
                                                    </Stack>
                                                    <Stack spacing={1} alignItems="start">
                                                        <Typography semiBold>
                                                            {((cart.items?.reduce((sum: number, item) => sum + (item.amount || 0), 0) || 0) / 100).toFixed(2)}€
                                                        </Typography>
                                                        <Chip className="w-fit" color={cart.status === 'paid' ? 'success' : 'neutral'}>
                                                            {cart.status === 'paid' ? 'Plaćena' : (cart.status === 'new' ? 'Nova' : cart.status)}
                                                        </Chip>
                                                    </Stack>
                                                </Row>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </Stack>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
