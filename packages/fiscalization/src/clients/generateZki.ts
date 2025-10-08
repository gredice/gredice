import { createHash } from 'node:crypto';
import { soapDateTime } from './helpers/soapDateTime';
import { getPkcs12KeyPair } from './pkcs12';

export function generateZki(
    {
        pin,
        date,
        receiptNumber,
        premiseId,
        posId,
        totalAmount,
    }: {
        pin: string;
        date: Date;
        receiptNumber: string | number;
        premiseId: string;
        posId: string;
        totalAmount: number;
    },
    p12Buffer: string,
    password: string,
) {
    const { keyPem } = getPkcs12KeyPair(p12Buffer, password);
    return createHash('md5')
        .update(
            [
                keyPem,
                pin,
                soapDateTime(date),
                receiptNumber,
                premiseId,
                posId,
                totalAmount,
            ].join(''),
        )
        .digest('hex');
}
