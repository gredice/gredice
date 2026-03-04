import { WSDL } from 'soap';
import { Agent, request as undiciRequest } from 'undici';
import type { UserSettings } from '../@types/UserSettings';
import { createClientAsync as createClientAsyncEduc } from '../generated/1-9-0-educ/fiskalizacijaservice';
import { createClientAsync as createClientAsyncProd } from '../generated/1-9-0-prod/fiskalizacijaservice';
import { signXml } from './signXml';

const testEndpoint = 'https://cistest.apis-it.hr:8449/FiskalizacijaServiceTest';
const prodEndpoint = 'https://cis.porezna-uprava.hr:8449/FiskalizacijaServic';
function getEndpoint(env: 'educ' | 'prod') {
    return env === 'educ' ? testEndpoint : prodEndpoint;
}

interface RequestConfig {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    data?: string | Buffer;
    transformResponse?:
        | ((data: string) => string)
        | ((data: string) => string)[];
    responseType?: string;
    [key: string]: unknown;
}

/**
 * Minimal axios-compatible request function using undici.
 * The soap library expects an AxiosInstance-like callable for its internal HTTP client.
 */
export function createSoapRequest(agent: Agent) {
    return async (urlOrConfig: string | RequestConfig) => {
        const config: RequestConfig =
            typeof urlOrConfig === 'string'
                ? { url: urlOrConfig }
                : urlOrConfig;

        const response = await undiciRequest(config.url, {
            method: (config.method ?? 'GET') as 'GET' | 'POST',
            headers: config.headers,
            body: config.data ?? undefined,
            dispatcher: agent,
        });

        let responseData: unknown;
        if (config.responseType === 'arraybuffer') {
            responseData = Buffer.from(await response.body.arrayBuffer());
        } else if (config.responseType === 'stream') {
            responseData = response.body;
        } else {
            responseData = await response.body.text();
        }

        if (config.transformResponse) {
            const transforms = Array.isArray(config.transformResponse)
                ? config.transformResponse
                : [config.transformResponse];
            for (const transform of transforms) {
                responseData = transform(responseData as string);
            }
        }

        return {
            data: responseData,
            status: response.statusCode,
            headers: response.headers,
        };
    };
}

export async function fisClient(env: 'educ' | 'prod') {
    const agent = new Agent({
        connect: {
            // TODO: For demo purposes, we ignore SSL errors
            rejectUnauthorized: false,
        },
    });
    const request = createSoapRequest(agent);

    const wsdlBaseUrl = `https://cdn.gredice.com/fiscal/1-9-0-${env}/wsdl/`;
    const wsdlUrl = `https://cdn.gredice.com/fiscal/1-9-0-${env}/wsdl/FiskalizacijaService.wsdl`;

    const wsdlText = await request(wsdlUrl).then((r) => r.data);

    const wsdl = new WSDL(wsdlText, wsdlBaseUrl, {
        // soap types expect AxiosInstance but our undici wrapper is runtime-compatible
        // biome-ignore lint/suspicious/noExplicitAny: soap requires AxiosInstance type but undici wrapper is compatible at runtime
        request: request as any,
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
        // biome-ignore lint/suspicious/noExplicitAny: soap requires AxiosInstance type but undici wrapper is compatible at runtime
        request: request as any,
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
