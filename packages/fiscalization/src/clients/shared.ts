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

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "text/xml; charset=utf-8",
        },
        body: soapEnvelope
    });

    const responseText = await response.text();

    if (!response.ok) {
        if (responseText.includes("<tns:PorukaGreske>")) {
            const errorMatch = responseText.match(/<tns:PorukaGreske>([^<]+)<\/tns:PorukaGreske>/)
            if (errorMatch) {
                return { errors: [{ errorMessage: errorMatch[1] }] }
            }
        }

        throw new Error(`Error! Status: ${response.status}. Response: ${responseText}`);
    }

    return responseText;
}
