import { randomUUID } from "node:crypto";
import { soapDateTime } from "../helpers/soapDateTime";
import { generateZki } from "../zki";
import { signXml } from "./signXml";
import { sendSoapRequest } from "./shared";
import { RacunZahtjev } from "../generated/1-9-0-educ/fiskalizacijaservice";
import { UserSettings } from "../@types/UserSettings";
import { PosSettings } from "../@types/PosSettings";
import { PosUser } from "../@types/PosUser";

export type Receipt = {
    date: Date;
    receiptNumber: string;
    totalAmount: number;

    lateFiscalization?: boolean; // Optional, defaults to false
}

const testEndpoint = 'https://cistest.apis-it.hr:8449/FiskalizacijaServiceTest';
const prodEndpoint = 'https://cis.porezna-uprava.hr:8449/FiskalizacijaServic';
function getEndpoint(env: "educ" | "prod") {
    return env === "educ" ? testEndpoint : prodEndpoint;
}

export async function receiptRequest(receipt: Receipt, settings: {
    userSettings: UserSettings;
    posSettings: PosSettings;
    posUser: PosUser;
}) {
    const { userSettings, posSettings, posUser } = settings;
    const composedReceipt = {
        pin: userSettings.pin,
        ...posSettings,
        ...posUser,
        ...receipt
    }
    const receiptDateTime = soapDateTime(composedReceipt.date);
    const zki = generateZki(composedReceipt, userSettings.credentials.cert, userSettings.credentials.password);
    const receiptRequestObj: RacunZahtjev | any = {
        Zaglavlje: {
            IdPoruke: randomUUID(),
            DatumVrijeme: soapDateTime(new Date()),
        },
        Racun: {
            Oib: composedReceipt.pin,
            USustPdv: userSettings.useVat,
            DatVrijeme: receiptDateTime,
            OznSlijed: userSettings.receiptNumberOnDevice ? "N" : "P",
            BrRac: {
                BrOznRac: composedReceipt.receiptNumber,
                OznPosPr: composedReceipt.premiseId,
                OznNapUr: composedReceipt.posId,
            },
            IznosUkupno: composedReceipt.totalAmount.toFixed(2),
            NacinPlac: 'K',
            OibOper: composedReceipt.posPin,
            ZastKod: zki,
            NakDost: composedReceipt.lateFiscalization
        }
    };

    const signedXml = await signXml(receiptRequestObj, userSettings.credentials);
    if (!signedXml) {
        throw new Error("Failed to sign the XML request");
    }

    // Use the public endpoint property provided by the client
    const responseText = await sendSoapRequest(signedXml, getEndpoint(userSettings.environment));
    if (typeof responseText === 'object' && 'errors' in responseText) {
        throw new Error(`Request failed: ${responseText.errors.map((e: any) => e.errorMessage).join(', ')}`);
    }

    // Parse the SOAP response to extract the result
    let jir: string | null = null;
    if (responseText.includes("<tns:Jir>")) {
        const jirMatch = responseText.match(/<tns:Jir>([^<]+)<\/tns:Jir>/)
        if (jirMatch) {
            jir = jirMatch[1] ?? null;
        }
    }
    if (!jir) {
        throw new Error("JIR not found in the response");
    }

    return {
        dateTime: composedReceipt.date,
        receiptNumber: `${composedReceipt.receiptNumber}/${composedReceipt.premiseId}/${composedReceipt.posId}`,
        jir,
        zki
    }
}
