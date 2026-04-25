export const merchantReturnPolicy = {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'HR',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 30,
    returnMethod: 'https://schema.org/KeepProduct',
    returnFees: 'https://schema.org/FreeReturn',
    refundType: [
        'https://schema.org/FullRefund',
        'https://schema.org/StoreCreditRefund',
    ],
} as const;
