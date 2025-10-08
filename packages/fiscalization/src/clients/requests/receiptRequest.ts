import { randomUUID } from 'node:crypto';
import type { PosSettings } from '../../@types/PosSettings';
import type { PosUser } from '../../@types/PosUser';
import type { UserSettings } from '../../@types/UserSettings';
import type { RacunZahtjev } from '../../generated/1-9-0-educ/fiskalizacijaservice';
import { generateZki } from '../generateZki';
import { soapDateTime } from '../helpers/soapDateTime';
import { type FisRequest, fisClient, prepareXml } from '../shared';

export type Receipt = {
    date: Date;
    receiptNumber: string;
    totalAmount: number;

    lateFiscalization?: boolean; // Optional, defaults to false
};

export type ReceiptRequestResult =
    | {
          success: true;
          dateTime: Date;
          receiptNumber: string;
          jir: string;
          zki: string;
          responseText: string;
          errors?: never;
      }
    | {
          success: false;
          zki: string;
          responseText: string;
          errors?: Array<{ errorMessage: string | null | undefined }>;
      };

export async function receiptRequest(
    receipt: Receipt,
    settings: {
        userSettings: UserSettings;
        posSettings: PosSettings;
        posUser: PosUser;
    },
): Promise<ReceiptRequestResult> {
    const { userSettings, posSettings, posUser } = settings;

    // Request specific variables
    const attributes = {
        attributes: {
            Id: 'racun-zahtjev',
        },
    };
    const localName = 'RacunZahtjev';

    // Receipt payload
    const composedReceipt = {
        pin: userSettings.pin,
        ...posSettings,
        ...posUser,
        ...receipt,
    };
    const receiptDateTime = soapDateTime(composedReceipt.date);
    const zki = generateZki(
        composedReceipt,
        userSettings.credentials.cert,
        userSettings.credentials.password,
    );
    const receiptRequestObj: FisRequest<RacunZahtjev> = {
        ...attributes,
        Zaglavlje: {
            IdPoruke: randomUUID(),
            DatumVrijeme: soapDateTime(new Date()),
        },
        Racun: {
            Oib: composedReceipt.pin,
            USustPdv: userSettings.useVat,
            DatVrijeme: receiptDateTime,
            OznSlijed: userSettings.receiptNumberOnDevice ? 'N' : 'P',
            BrRac: {
                BrOznRac: composedReceipt.receiptNumber,
                OznPosPr: composedReceipt.premiseId,
                OznNapUr: composedReceipt.posId,
            },
            IznosUkupno: composedReceipt.totalAmount.toFixed(2),
            NacinPlac: 'K',
            OibOper: composedReceipt.posPin,
            ZastKod: zki,
            NakDost: composedReceipt.lateFiscalization ?? false,
        },
    };

    // Prepare signed XML and client
    const { wsdl, client } = await fisClient(userSettings.environment);
    const signedXml = await prepareXml(
        localName,
        wsdl,
        receiptRequestObj,
        userSettings.credentials,
    );

    // Make the request
    const resp = await client.racuniAsync({
        ...attributes,
        $xml: signedXml,
    } as RacunZahtjev);

    // Process the response
    const jir = resp?.[0]?.Jir;
    const raw = resp?.[1];
    if (!jir) {
        const greska = resp?.[0]?.Greske?.Greska;
        return {
            success: false,
            zki,
            errors: greska
                ? (Array.isArray(greska) ? greska : [greska]).map((g) => ({
                      errorMessage: g.PorukaGreske,
                      errorCode: g.SifraGreske,
                  }))
                : undefined,
            responseText: raw,
        };
    } else {
        return {
            dateTime: composedReceipt.date,
            receiptNumber: composedReceipt.receiptNumber,
            jir,
            zki,
            responseText: raw,
            success: true,
        };
    }
}
