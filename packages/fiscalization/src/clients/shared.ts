import https from 'node:https';
import axios from 'axios';
import { WSDL } from 'soap';
import type { UserSettings } from '../@types/UserSettings';
import { createClientAsync as createClientAsyncEduc } from '../generated/1-9-0-educ/fiskalizacijaservice';
import { createClientAsync as createClientAsyncProd } from '../generated/1-9-0-prod/fiskalizacijaservice';
import { signXml } from './signXml';

const testEndpoint = 'https://cistest.apis-it.hr:8449/FiskalizacijaServiceTest';
const prodEndpoint = 'https://cis.porezna-uprava.hr:8449/FiskalizacijaServic';
function getEndpoint(env: 'educ' | 'prod') {
    return env === 'educ' ? testEndpoint : prodEndpoint;
}

export async function fisClient(env: 'educ' | 'prod') {
    const request = axios.create({
        httpsAgent: new https.Agent({
            // ca: readFileSync('./certs/demo2014_root_ca.pem')
            //     .toString()
            //     .replace("-----BEGIN CERTIFICATE-----", "")
            //     .replace("-----END CERTIFICATE-----", "")
            //     .replace(/\s/g, ""),
            // TODO: For demo purposes, we ignore SSL errors
            rejectUnauthorized: false,
        }),
    });
    const wsdlBaseUrl = `https://cdn.gredice.com/fiscal/1-9-0-${env}/wsdl/`;
    const wsdlUrl = `https://cdn.gredice.com/fiscal/1-9-0-${env}/wsdl/FiskalizacijaService.wsdl`;

    const wsdlText = await request(wsdlUrl).then((r) => r.data);

    const wsdl = new WSDL(wsdlText, wsdlBaseUrl, {
        request,
        ignoredNamespaces: {
            namespaces: ['ds'],
            override: true,
        },
        useEmptyTag: true,
    });
    wsdl.options.attributesKey = 'attributes';
    await new Promise((resolve, reject) => {
        wsdl.onReady((err) => {
            if (err) {
                console.error('WSDL Error:', err);
                reject(err);
                return;
            }
            resolve(null);
        });
    });

    const endpoint = getEndpoint(env);
    const clientOptions = {
        request,
        ignoredNamespaces: {
            namespaces: ['ds'],
            override: true,
        },
        useEmptyTag: true,
    };
    const client =
        env === 'prod'
            ? await createClientAsyncProd(wsdlUrl, clientOptions, endpoint)
            : await createClientAsyncEduc(wsdlUrl, clientOptions, endpoint);

    client.wsdl.options = {
        ...client.wsdl.options,
        attributesKey: 'attributes',
    };

    return {
        wsdl,
        client,
    };
}

export type FisRequest<T> = T & {
    attributes: {
        Id: string;
    };
};

function unwrapXmlRoot(xml: string, localName: string) {
    const rootElementPattern = new RegExp(
        `<tns:${localName}[^>]*>([\\s\\S]*)<\\/tns:${localName}>`,
    );
    const rootElementMatch = xml.match(rootElementPattern);
    return rootElementMatch?.[1]?.trim() ?? xml;
}

export async function prepareXml<T>(
    localName: string,
    wsdl: WSDL,
    receiptRequestObj: FisRequest<T>,
    credentials: UserSettings['credentials'],
) {
    const xmlDoc = wsdl.objectToDocumentXML(
        localName,
        receiptRequestObj,
        'tns',
        'http://www.apis-it.hr/fin/2012/types/f73',
    );
    return unwrapXmlRoot(
        await signXml(xmlDoc, localName, credentials),
        localName,
    );
}
