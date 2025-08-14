import { Agent, request } from 'undici';

/**
 * Sends raw XML to the SOAP endpoint using HTTP POST
 */
export async function sendSoapRequest(signedXml: string, endpoint: string) {
    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
      ${signedXml}
  </soapenv:Body>
</soapenv:Envelope>`;

    const response = await request(endpoint, {
        method: 'POST',
        body: soapEnvelope,
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
        },
        dispatcher: new Agent({
            connect: {
                rejectUnauthorized: false,
            },
        }),
    });

    const responseText = await response.body.text();

    if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        if (responseText.includes("<tns:PorukaGreske>")) {
            const errorMatch = responseText.match(/<tns:PorukaGreske>([^<]+)<\/tns:PorukaGreske>/)
            if (errorMatch) {
                return { responseText, errors: [{ errorMessage: errorMatch[1] }] }
            }
        }

        throw new Error(`Error! Status: ${response.statusCode}. Response: ${responseText}`);
    }

    return { responseText };
}
