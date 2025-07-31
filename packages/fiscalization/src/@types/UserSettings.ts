export type UserSettings = {
    pin: string; // User's PIN for the receipt
    useVat: boolean; // Whether to use VAT in the receipt
    receiptNumberOnDevice: boolean; // Whether the receipt number is generated on the
    environment: 'educ' | 'prod'; // Environment for the request
    credentials: {
        cert: string; // PKCS#12 certificate in binary format
        password: string; // Password for the PKCS#12 certificate
    }
}
