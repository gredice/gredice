// import { readFileSync } from 'node:fs';
// import https from 'https';
// import axios from 'axios';

// export async function demoClient(creds: { cert: string, password: string }, version: string, env: "educ" | "prod") {
//     const request = axios.create({
//         httpsAgent: new https.Agent({
//             ca: readFileSync('./certs/demo2014_root_ca.pem')
//                 .toString()
//                 .replace("-----BEGIN CERTIFICATE-----", "")
//                 .replace("-----END CERTIFICATE-----", "")
//                 .replace(/\s/g, ""),
//             // TODO: Remove
//             rejectUnauthorized: false, // For demo purposes, we ignore SSL errors
//         }),
//     });
//     const url = `./external/${version}-${env}/wsdl/FiskalizacijaService.wsdl`;
// }

// export async function prodClient(creds: { cert: string, password: string }, version: string, env: "educ" | "prod") {
//     const request = axios.create({
//         httpsAgent: new https.Agent({
//             ca: readFileSync('./certs/FinaRootCA.pem'),
//         })
//     });
//     const url = `./external/${version}-${env}/wsdl/FiskalizacijaService.wsdl`;

// }