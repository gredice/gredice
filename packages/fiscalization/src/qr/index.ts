import { toDataURL } from 'qrcode';

export async function generateQr({ date, totalAmount: amount, ...rest }: {
    jir: string;
    date: Date;
    totalAmount: number;
} | {
    zki: string;
    date: Date;
    totalAmount: number;
}) {
    // datv = GGGGMMDD_HHMM
    // izn = amount * 100 with no decimal point
    const datev = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}`;
    const izn = (amount * 100).toFixed(0);
    return await toDataURL(
        "zki" in rest
            ? `https://porezna.gov.hr/rn/?zki=${rest.zki}&datv=${datev}&izn=${izn}`
            : `https://porezna.gov.hr/rn/?jir=${rest.jir}&datv=${datev}&izn=${izn}`,
        {
            margin: 2,
            width: 256
        });
}
