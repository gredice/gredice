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
import { createInvoiceAction, getTransactionsAction, getShoppingCartsAction, getAccountDetailsAction, getShoppingCartItemsWithEntityNamesAction } from "./actions";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Delete } from "@signalco/ui-icons";
import { DotIndicator } from '@signalco/ui-primitives/DotIndicator';

const statusOptions = [
    { value: 'draft', label: 'Nacrt' },
    { value: 'pending', label: 'Na čekanju' },
    { value: 'sent', label: 'Poslan' },
];

const currencyOptions = [
    { value: 'eur', label: 'EUR (€)' },
];

interface InvoiceItem {
    description: string;
    quantity: string;
    unitPrice: string;
    totalPrice: string;
}

export default function CreateInvoiceForm() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [showShoppingCartModal, setShowShoppingCartModal] = useState(false);
    const [transactions, setTransactions] = useState<NonNullable<Awaited<ReturnType<typeof getTransactionsAction>>['transactions']>>([]);
    const [shoppingCarts, setShoppingCarts] = useState<NonNullable<Awaited<ReturnType<typeof getShoppingCartsAction>>['shoppingCarts']>>([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [loadingShoppingCarts, setLoadingShoppingCarts] = useState(false);
    const [isAccountReadOnly, setIsAccountReadOnly] = useState(false);
    const [formData, setFormData] = useState({
        accountId: '',
        transactionId: '',
        currency: 'eur',
        status: 'draft',
        billToName: '',
        billToEmail: '',
        billToAddress: '',
        billToCity: '',
        billToState: '',
        billToZip: '',
        billToCountry: '',
        notes: '',
        terms: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
        vatEnabled: false, // VAT is disabled by default
    });

    const [items, setItems] = useState<InvoiceItem[]>([
        { description: '', quantity: '1', unitPrice: '0', totalPrice: '0' }
    ]);

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: field === 'vatEnabled' ? value === 'true' : value
        }));

        // Auto-populate account details when accountId changes
        if (field === 'accountId' && value) {
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
                window.location.href = '/admin/invoices';
            } else {
                alert('Greška prilikom kreiranja ponude: ' + result.error);
            }
        } catch (error) {
            console.error('Error creating invoice:', error);
            alert('Greška prilikom kreiranja ponude');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <form onSubmit={handleSubmit}>
                <Stack spacing={4}>
                    <Row spacing={2} justifyContent="space-between" alignItems="center">
                        <Typography level="h1" className="text-2xl" semiBold>Nova ponuda</Typography>
                        <Row spacing={2}>
                            <Button
                                type="button"
                                variant="outlined"
                                color="neutral"
                                onClick={() => router.push(KnownPages.Invoices)}
                            >
                                Odustani
                            </Button>
                            <Button
                                type="submit"
                                variant="solid"
                                color="primary"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Kreiranje...' : 'Kreiraj ponudu'}
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
                                    </Row>
                                </CardHeader>
                                <CardContent>
                                    <Stack spacing={3}>
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
                                                    {statusOptions.map(option => (
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
                                        {isAccountReadOnly && (
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
                                            <Typography level="body2" className="text-gray-600">Email *</Typography>
                                            <Input
                                                type="email"
                                                value={formData.billToEmail}
                                                onChange={(e) => handleInputChange('billToEmail', e.target.value)}
                                                placeholder="email@example.com"
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
                                            <Typography level="body2" className="text-gray-600">Adresa</Typography>
                                            <textarea
                                                value={formData.billToAddress}
                                                onChange={(e: any) => handleInputChange('billToAddress', e.target.value)}
                                                placeholder="Ulica i broj&#10;Poštanski broj, Grad"
                                                rows={3}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </Stack>
                                        <Row spacing={3}>
                                            <Stack spacing={1} className="flex-1">
                                                <Typography level="body2" className="text-gray-600">Grad</Typography>
                                                <Input
                                                    value={formData.billToCity}
                                                    onChange={(e) => handleInputChange('billToCity', e.target.value)}
                                                    placeholder="Grad"
                                                />
                                            </Stack>
                                            <Stack spacing={1} className="flex-1">
                                                <Typography level="body2" className="text-gray-600">Županija</Typography>
                                                <Input
                                                    value={formData.billToState}
                                                    onChange={(e) => handleInputChange('billToState', e.target.value)}
                                                    placeholder="Županija"
                                                />
                                            </Stack>
                                        </Row>
                                        <Row spacing={3}>
                                            <Stack spacing={1} className="flex-1">
                                                <Typography level="body2" className="text-gray-600">Poštanski broj</Typography>
                                                <Input
                                                    value={formData.billToZip}
                                                    onChange={(e) => handleInputChange('billToZip', e.target.value)}
                                                    placeholder="10000"
                                                />
                                            </Stack>
                                            <Stack spacing={1} className="flex-1">
                                                <Typography level="body2" className="text-gray-600">Država</Typography>
                                                <Input
                                                    value={formData.billToCountry}
                                                    onChange={(e) => handleInputChange('billToCountry', e.target.value)}
                                                    placeholder="Hrvatska"
                                                />
                                            </Stack>
                                        </Row>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Stack>

                        <Stack spacing={4} className="flex-1">
                            {/* Invoice Items */}
                            <Card>
                                <CardHeader>
                                    <Row justifyContent="space-between" alignItems="center">
                                        <CardTitle>Stavke ponude</CardTitle>
                                        <Button type="button" variant="outlined" size="sm" onClick={addItem}>
                                            Dodaj stavku
                                        </Button>
                                    </Row>
                                </CardHeader>
                                <CardContent>
                                    <Stack spacing={1}>
                                        {items.map((item, index) => (
                                            <Card key={index}>
                                                <CardContent>
                                                    <Row spacing={2}>
                                                        <div className="self-start">
                                                            <DotIndicator
                                                                color="neutral"
                                                                size={18}
                                                                content={<Typography level="body3" className="text-white">{(index + 1).toString()}</Typography>}
                                                            />
                                                        </div>
                                                        <Stack spacing={1}>
                                                            <Typography level="body2" className="text-gray-600">Opis *</Typography>
                                                            <Input
                                                                value={item.description}
                                                                onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                                                placeholder="Opis proizvoda ili usluge"
                                                                required
                                                            />
                                                        </Stack>
                                                        <Stack spacing={1}>
                                                            <Typography level="body2" className="text-gray-600">Količina</Typography>
                                                            <Input
                                                                type="number"
                                                                step="1"
                                                                min="0"
                                                                value={item.quantity}
                                                                className="max-w-16"
                                                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                                required
                                                            />
                                                        </Stack>
                                                        <Stack spacing={1} className="flex-1">
                                                            <Typography level="body2" className="text-gray-600">Jedinična cijena</Typography>
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
                                                            <Typography level="body2" className="text-gray-600">Ukupno</Typography>
                                                            <Input
                                                                type="number"
                                                                value={item.totalPrice}
                                                                readOnly
                                                                className="bg-gray-50"
                                                            />
                                                        </Stack>
                                                        {items.length > 1 && (
                                                            <IconButton
                                                                className="self-start"
                                                                type="button"
                                                                variant="outlined"
                                                                size="xs"
                                                                title="Ukloni stavku"
                                                                onClick={() => removeItem(index)}
                                                            >
                                                                <Delete />
                                                            </IconButton>
                                                        )}
                                                    </Row>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </Stack>
                                </CardContent>
                            </Card>

                            {/* Totals */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Ukupni iznosi</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Stack spacing={2}>
                                        <Row justifyContent="space-between">
                                            <Typography level="body2" className="text-gray-600">Osnovica:</Typography>
                                            <Typography>{formData.currency === 'eur' ? '€' : formData.currency} {subtotal}</Typography>
                                        </Row>
                                        {formData.vatEnabled && (
                                            <Row justifyContent="space-between">
                                                <Typography level="body2" className="text-gray-600">PDV (25%):</Typography>
                                                <Typography>{formData.currency === 'eur' ? '€' : formData.currency} {taxAmount}</Typography>
                                            </Row>
                                        )}
                                        <Row justifyContent="space-between" className="border-t pt-2">
                                            <Typography semiBold>Ukupno:</Typography>
                                            <Typography level="h3" semiBold>{formData.currency === 'eur' ? '€' : formData.currency} {total}</Typography>
                                        </Row>
                                    </Stack>
                                </CardContent>
                            </Card>

                            {/* Additional Information */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Dodatne informacije</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Stack spacing={3}>
                                        <Stack spacing={1}>
                                            <Typography level="body2" className="text-gray-600">Napomene</Typography>
                                            <textarea
                                                value={formData.notes}
                                                onChange={(e: any) => handleInputChange('notes', e.target.value)}
                                                placeholder="Interne napomene o ponudi"
                                                rows={3}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </Stack>
                                        <Stack spacing={1}>
                                            <Typography level="body2" className="text-gray-600">Uvjeti plaćanja</Typography>
                                            <textarea
                                                value={formData.terms}
                                                onChange={(e: any) => handleInputChange('terms', e.target.value)}
                                                placeholder="Uvjeti plaćanja i ostali uvjeti"
                                                rows={3}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Stack>
                    </Row>
                </Stack>
            </form>

            <TransactionModal
                show={showTransactionModal}
                onClose={() => setShowTransactionModal(false)}
                transactions={transactions}
                loading={loadingTransactions}
                onSelect={populateFromTransaction}
            />

            <ShoppingCartModal
                show={showShoppingCartModal}
                onClose={() => setShowShoppingCartModal(false)}
                shoppingCarts={shoppingCarts}
                loading={loadingShoppingCarts}
                onSelect={populateFromShoppingCart}
                accountId={formData.accountId}
            />
        </>
    );
}

// Transaction Selection Modal Component
function TransactionModal({
    show,
    onClose,
    transactions,
    loading,
    onSelect
}: {
    show: boolean;
    onClose: () => void;
    transactions: any[];
    loading: boolean;
    onSelect: (transaction: any) => void;
}) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
                <div className="p-6 border-b">
                    <Row spacing={2} justifyContent="space-between" alignItems="center">
                        <Stack spacing={1}>
                            <Typography level="h3" semiBold>Odaberite transakciju</Typography>
                            {transactions.length > 0 && (
                                <Typography level="body2" className="text-gray-600">
                                    {transactions.filter(t => (t.invoices?.length || 0) === 0).length} bez ponude • {transactions.length} ukupno
                                </Typography>
                            )}
                        </Stack>
                        <Button variant="link" onClick={onClose}>✕</Button>
                    </Row>
                </div>
                <div className="p-6 overflow-y-auto max-h-96">
                    {loading ? (
                        <Typography>Učitavanje transakcija...</Typography>
                    ) : transactions.length === 0 ? (
                        <Typography>Nema dostupnih transakcija</Typography>
                    ) : (
                        <Stack spacing={2}>
                            {transactions.map((transaction) => {
                                const invoiceCount = transaction.invoices?.length || 0;
                                const hasNoInvoices = invoiceCount === 0;

                                return (
                                    <Card
                                        key={transaction.id}
                                        className={`cursor-pointer hover:bg-gray-50 transition-colors ${hasNoInvoices ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-blue-500'
                                            }`}
                                        onClick={() => onSelect(transaction)}
                                    >
                                        <CardContent>
                                            <Row spacing={2} justifyContent="space-between">
                                                <Stack spacing={1}>
                                                    <Row spacing={2} alignItems="center">
                                                        <Typography semiBold>#{transaction.id}</Typography>
                                                        {hasNoInvoices && (
                                                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">
                                                                ✨ Bez ponude
                                                            </span>
                                                        )}
                                                        {!hasNoInvoices && (
                                                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                                                                📋 {invoiceCount} ponuda{invoiceCount > 1 ? 'e' : ''}
                                                            </span>
                                                        )}
                                                    </Row>
                                                    <Typography level="body2" className="text-gray-600">
                                                        Stripe: {transaction.stripePaymentId}
                                                    </Typography>
                                                    <Row spacing={2} alignItems="center">
                                                        <Typography level="body2" className="text-gray-600">
                                                            Status: {transaction.status}
                                                        </Typography>
                                                        {hasNoInvoices && (
                                                            <Typography level="body2" className="text-green-600 font-medium">
                                                                • Dostupna za fakturiranje
                                                            </Typography>
                                                        )}
                                                    </Row>
                                                </Stack>
                                                <Stack spacing={1} alignItems="start">
                                                    <Typography semiBold className="text-lg">
                                                        {transaction.currency?.toUpperCase()} {(transaction.amount / 100).toFixed(2)}
                                                    </Typography>
                                                    <Typography level="body2" className="text-gray-600">
                                                        {new Date(transaction.createdAt).toLocaleDateString('hr-HR')}
                                                    </Typography>
                                                </Stack>
                                            </Row>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </Stack>
                    )}
                </div>
            </div>
        </div>
    );
}

// Shopping Cart Selection Modal Component
function ShoppingCartModal({
    show,
    onClose,
    shoppingCarts,
    loading,
    onSelect,
    accountId
}: {
    show: boolean;
    onClose: () => void;
    shoppingCarts: any[];
    loading: boolean;
    onSelect: (cart: any) => void;
    accountId?: string;
}) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
                <div className="p-6 border-b">
                    <Row spacing={2} justifyContent="space-between" alignItems="center">
                        <Stack spacing={1}>
                            <Typography level="h3" semiBold>Odaberite košaricu</Typography>
                            {accountId && (
                                <Typography level="body2" className="text-gray-600">
                                    Košarice za korisnički račun: {accountId}
                                </Typography>
                            )}
                            {shoppingCarts.length > 0 && (
                                <Typography level="body2" className="text-gray-600">
                                    {shoppingCarts.length} dostupn{shoppingCarts.length === 1 ? 'a' : 'ih'} košaric{shoppingCarts.length === 1 ? 'a' : 'a'} • poredane po novijima
                                </Typography>
                            )}
                        </Stack>
                        <Button variant="link" onClick={onClose}>✕</Button>
                    </Row>
                </div>
                <div className="p-6 overflow-y-auto max-h-96">
                    {loading ? (
                        <Typography>Učitavanje košarica...</Typography>
                    ) : shoppingCarts.length === 0 ? (
                        <Stack spacing={2} alignItems="center">
                            <Typography>
                                {accountId
                                    ? `Nema dostupnih košarica za korisnički račun ${accountId}`
                                    : 'Nema dostupnih košarica'
                                }
                            </Typography>
                            {accountId && (
                                <Typography level="body2" className="text-gray-600 text-center">
                                    Unesite Account ID u osnovnim podacima ponude da vidite dostupne košarice
                                </Typography>
                            )}
                        </Stack>
                    ) : (
                        <Stack spacing={2}>
                            {shoppingCarts.map((cart) => (
                                <Card key={cart.id} className="cursor-pointer hover:bg-gray-50" onClick={() => onSelect(cart)}>
                                    <CardContent>
                                        <Row spacing={2} justifyContent="space-between">
                                            <Stack spacing={1}>
                                                <Row spacing={2} alignItems="center">
                                                    <Typography semiBold>Košarica #{cart.id}</Typography>
                                                    <Chip className="w-fit" color={cart.status === 'paid' ? 'success' : 'neutral'}>
                                                        {cart.status === 'paid' ? 'Plaćena' : (cart.status === 'new' ? 'Nova' : cart.status)}
                                                    </Chip>
                                                </Row>
                                                <Typography level="body2" className="text-gray-600">
                                                    Account: {cart.accountId}
                                                </Typography>
                                                <Typography level="body2" className="text-gray-600">
                                                    Stavki: {cart.items?.length || 0}
                                                </Typography>
                                            </Stack>
                                            <Stack spacing={1} alignItems="start">
                                                <Typography semiBold>
                                                    {((cart.items?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 0) / 100).toFixed(2)} EUR
                                                </Typography>
                                                <Typography level="body2" className="text-gray-600">
                                                    {new Date(cart.createdAt).toLocaleDateString('hr-HR')}
                                                </Typography>
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
    );
}
