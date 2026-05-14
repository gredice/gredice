# @gredice/fiscalization

JS/Typescript implementation of Croatian fiscalization system.

> [!IMPORTANT]
> **Disclaimer**: This is not an official implementation, but rather a community driven project. It is based on official documentation and is intended to be used as a reference for developers who are implementing fiscalization in their applications.

Actual version of implemented fiscalization system is 2.5 (as of 2025-10-23). Official technical and other documentation and be found here: [Fiscalization System 2.5](https://porezna.gov.hr/fiskalizacija/gotovinski-racuni/tehnicki-podaci/o/tehnicki-podaci).

## Example usage

```typescript
import { receiptRequest } from '@gredice/fiscalization'; 
import type { Receipt, UserSettings, PosSettings, PosUser } from '@gredice/fiscalization';
import { readFileSync } from "node:fs";
import { Agent, setGlobalDispatcher } from "undici";

setGlobalDispatcher(new Agent({
    connect: {
        ca: readFileSync('./certs/demo2014_root_ca.pem', 'utf8')
            .toString()
            .replace("-----BEGIN CERTIFICATE-----", "")
            .replace("-----END CERTIFICATE-----", "")
            .replace(/\s/g, ""),
        rejectUnauthorized: false
    }
}));

const userSettings: UserSettings = {
    pin: '12345678912',
    useVat: false,
    receiptNumberOnDevice: false,
    environment: 'educ',
    credentials: {
        cert: readFileSync('./certs/cert.p12', 'binary'),
        password: 'FINAdemocert123!'
    }
}

// TODO: Retrieve from POS settings
const posSettings: PosSettings = {
    posId: '1',
    premiseId: 'WEB',
}

// TODO: Retrieve from current POS user
const posUser: PosUser = {
    posPin: userSettings.pin, // Company PIN used when fiscalizing as WEB
}

const receipt: Receipt = {
    date: new Date(),
    totalAmount: 100.50,
    receiptNumber: '1'
};

const { jir, zki } = await receiptRequest(receipt, {
    userSettings,
    posSettings,
    posUser
});
```

## Generate Typescript client from WSDL

To generate Typescript client from WSDL files, use the following command:

```bash
wsdl-tsclient ./external/fiscal/1-9-0-prod/wsdl/FiskalizacijaService.wsdl -o ./src/generated/1-9-0-prod
```
