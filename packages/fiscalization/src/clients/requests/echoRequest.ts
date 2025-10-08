import type { UserSettings } from '../../@types/UserSettings';
import type { String as EchoRequest } from '../../generated/1-9-0-educ/fiskalizacijaservice';
import { type FisRequest, fisClient } from '../shared';

export type EchoRequestResult =
    | {
          success: true;
          echo: string;
          responseText: string;
      }
    | {
          success: false;
          responseText: string;
          errors?: Array<{
              errorMessage: string | null | undefined;
              errorCode: string | null | undefined;
          }>;
      };

export async function echoRequest(
    message: string,
    settings: {
        userSettings: UserSettings;
    },
): Promise<EchoRequestResult> {
    const { userSettings } = settings;

    // Request specific variables
    const attributes = {
        attributes: {
            Id: 'echo-request',
        },
    };
    const localName = 'EchoRequest';

    // Echo request doesn't require signing, it's a simple connectivity test
    const echoRequestObj: FisRequest<EchoRequest> = {
        ...attributes,
    };

    // Prepare XML and client
    const { wsdl, client } = await fisClient(userSettings.environment);
    const xml = wsdl.objectToDocumentXML(
        localName,
        { ...echoRequestObj, _: message },
        'tns',
        'http://www.apis-it.hr/fin/2012/types/f73',
    );

    // Make the request
    const resp = await client.echoAsync({
        ...attributes,
        $xml: xml,
    } as EchoRequest);

    // Process the response
    const raw = resp?.[1];
    const echoResponse = resp?.[0];

    if (!echoResponse || typeof echoResponse !== 'object') {
        return {
            success: false,
            responseText: raw,
        };
    }

    // The echo service should return the same message we sent
    return {
        success: true,
        echo: message,
        responseText: raw,
    };
}
