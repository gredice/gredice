'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Button } from "@signalco/ui-primitives/Button";
import { Input } from "@signalco/ui-primitives/Input";
import { KnownPages } from "../../../../../src/KnownPages";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Delete } from "@signalco/ui-icons";
import { updateInvoiceAction } from "./actions";

const statusOptions = [
    { value: 'draft', label: 'Nacrt' },
    { value: 'pending', label: 'Na čekanju' },
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
    sku?: string;
    unit?: string;
    taxRate?: string;
}

interface EditInvoiceFormProps {
    invoice: any; // Type from the invoice query
}

export function EditInvoiceForm({ invoice }: EditInvoiceFormProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        currency: invoice.currency || 'eur',
        status: invoice.status || 'draft',
        billToName: invoice.billToName || '',
        billToEmail: invoice.billToEmail || '',
        billToAddress: invoice.billToAddress || '',
        billToCity: invoice.billToCity || '',
        billToState: invoice.billToState || '',
        billToZip: invoice.billToZip || '',
        billToCountry: invoice.billToCountry || '',
        notes: invoice.notes || '',
        terms: invoice.terms || '',
        issueDate: invoice.issueDate ? new Date(invoice.issueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        vatEnabled: invoice.taxAmount ? parseFloat(invoice.taxAmount) > 0 : false,
    });

    const [items, setItems] = useState<InvoiceItem[]>(
        invoice.invoiceItems?.length > 0
            ? invoice.invoiceItems.map((item: any) => ({
                id: item.id,
                description: item.description || '',
                quantity: item.quantity?.toString() || '1',
                unitPrice: item.unitPrice?.toString() || '0',
                totalPrice: item.totalPrice?.toString() || '0',
                sku: item.sku || '',
                unit: item.unit || '',
                taxRate: item.taxRate?.toString() || '',
            }))
            : [{ description: '', quantity: '1', unitPrice: '0', totalPrice: '0' }]
    );

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: field === 'vatEnabled' ? value === 'true' : value
        }));
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const totals = calculateTotals();

            const invoiceData = {
                ...formData,
                id: invoice.id,
                subtotal: totals.subtotal,
                taxAmount: totals.taxAmount,
                totalAmount: totals.total,
                vatEnabled: formData.vatEnabled,
                items: items.map(item => ({
                    id: item.id,
                    description: item.description,
                    quantity: parseFloat(item.quantity),
                    unitPrice: parseFloat(item.unitPrice),
                    totalPrice: parseFloat(item.totalPrice),
                    sku: item.sku || null,
                    unit: item.unit || null,
                    taxRate: item.taxRate ? parseFloat(item.taxRate) : null,
                }))
            };

            const result = await updateInvoiceAction(invoiceData);
            if (result.success) {
                router.push(KnownPages.Invoice(invoice.id));
            } else {
                alert('Greška pri ažuriranju ponude: ' + result.error);
            }
        } catch (error) {
            console.error('Error updating invoice:', error);
            alert('Greška pri ažuriranju ponude');
        } finally {
            setIsSubmitting(false);
        }
    };

    const totals = calculateTotals();

    return (
        <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
                <Row spacing={2} alignItems="center" justifyContent="space-between">
                    <Typography level="h1" className="text-2xl" semiBold>
                        Uredi ponudu {invoice.invoiceNumber}
                    </Typography>
                    <Row spacing={2}>
                        <Button
                            variant="link"
                            onClick={() => router.push(KnownPages.Invoice(invoice.id))}
                            type="button"
                        >
                            Odustani
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Ažuriranje...' : 'Ažuriraj ponudu'}
                        </Button>
                    </Row>
                </Row>

                <Row spacing={4} alignItems="stretch">
                    <Stack spacing={3} className="flex-1">
                        {/* Basic Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Osnovni podaci</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Stack spacing={3}>
                                    <Row spacing={3}>
                                        <Stack spacing={1} className="flex-1">
                                            <Typography level="body2">Status</Typography>
                                            <select
                                                value={formData.status}
                                                onChange={(e) => handleInputChange('status', e.target.value)}
                                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                {statusOptions.map(option => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </Stack>
                                        <Stack spacing={1} className="flex-1">
                                            <Typography level="body2">Valuta</Typography>
                                            <select
                                                value={formData.currency}
                                                onChange={(e) => handleInputChange('currency', e.target.value)}
                                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                {currencyOptions.map(option => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </Stack>
                                    </Row>
                                    <Row spacing={3}>
                                        <Stack spacing={1} className="flex-1">
                                            <Typography level="body2">Datum izdavanja</Typography>
                                            <Input
                                                type="date"
                                                value={formData.issueDate}
                                                onChange={(e) => handleInputChange('issueDate', e.target.value)}
                                                required
                                            />
                                        </Stack>
                                        <Stack spacing={1} className="flex-1">
                                            <Typography level="body2">Datum dospijeća</Typography>
                                            <Input
                                                type="date"
                                                value={formData.dueDate}
                                                onChange={(e) => handleInputChange('dueDate', e.target.value)}
                                                required
                                            />
                                        </Stack>
                                    </Row>
                                    <Stack spacing={1}>
                                        <Row spacing={2} alignItems="center">
                                            <input
                                                type="checkbox"
                                                id="vatEnabled"
                                                checked={formData.vatEnabled}
                                                onChange={(e) => handleInputChange('vatEnabled', e.target.checked.toString())}
                                                className="w-4 h-4"
                                            />
                                            <Typography level="body2">Uključi PDV (25%)</Typography>
                                        </Row>
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </Card>

                        {/* Billing Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Podaci o kupcu</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Stack spacing={3}>
                                    <Row spacing={3}>
                                        <Stack spacing={1} className="flex-1">
                                            <Typography level="body2">Naziv *</Typography>
                                            <Input
                                                value={formData.billToName}
                                                onChange={(e) => handleInputChange('billToName', e.target.value)}
                                                placeholder="Naziv kupca"
                                                required
                                            />
                                        </Stack>
                                        <Stack spacing={1} className="flex-1">
                                            <Typography level="body2">Email</Typography>
                                            <Input
                                                type="email"
                                                value={formData.billToEmail}
                                                onChange={(e) => handleInputChange('billToEmail', e.target.value)}
                                                placeholder="email@example.com"
                                            />
                                        </Stack>
                                    </Row>
                                    <Stack spacing={1}>
                                        <Typography level="body2">Adresa</Typography>
                                        <textarea
                                            value={formData.billToAddress}
                                            onChange={(e) => handleInputChange('billToAddress', e.target.value)}
                                            placeholder="Ulica i broj&#10;Poštanski broj Grad&#10;Država"
                                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                            rows={3}
                                        />
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Stack>

                    <Stack spacing={3} className="flex-1">
                        {/* Summary */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Sažetak</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Stack spacing={2}>
                                    <Row justifyContent="space-between">
                                        <Typography level="body2" className="text-gray-600">Osnovica</Typography>
                                        <Typography>€{totals.subtotal}</Typography>
                                    </Row>
                                    {formData.vatEnabled && (
                                        <Row justifyContent="space-between">
                                            <Typography level="body2" className="text-gray-600">PDV (25%)</Typography>
                                            <Typography>€{totals.taxAmount}</Typography>
                                        </Row>
                                    )}
                                    <Row justifyContent="space-between" className="border-t pt-2">
                                        <Typography semiBold>Ukupno</Typography>
                                        <Typography level="h3" semiBold>€{totals.total}</Typography>
                                    </Row>
                                </Stack>
                            </CardContent>
                        </Card>

                        {/* Notes */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Napomene i uvjeti</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Stack spacing={3}>
                                    <Stack spacing={1}>
                                        <Typography level="body2">Napomene</Typography>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => handleInputChange('notes', e.target.value)}
                                            placeholder="Dodatne napomene..."
                                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                            rows={3}
                                        />
                                    </Stack>
                                    <Stack spacing={1}>
                                        <Typography level="body2">Uvjeti</Typography>
                                        <textarea
                                            value={formData.terms}
                                            onChange={(e) => handleInputChange('terms', e.target.value)}
                                            placeholder="Uvjeti plaćanja..."
                                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
                                                <Stack spacing={1}>
                                                    <Typography level="body2">SKU</Typography>
                                                    <Input
                                                        value={item.sku || ''}
                                                        onChange={(e) => handleItemChange(index, 'sku', e.target.value)}
                                                        placeholder="SKU"
                                                        className="w-24"
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
                                                    <Typography level="body2">Jedinica</Typography>
                                                    <Input
                                                        value={item.unit || ''}
                                                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                                                        placeholder="kom, kg, h..."
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
                                                    <Typography level="body2">PDV stopa (%)</Typography>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                        value={item.taxRate || ''}
                                                        onChange={(e) => handleItemChange(index, 'taxRate', e.target.value)}
                                                        placeholder="25"
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
    );
}
