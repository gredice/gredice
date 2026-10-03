import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { getLocalSandboxBlockData } from '../../../../packages/game/src/localSandboxBlockData.ts';
import { kestenijadaItems } from '../../../../packages/js/src/kestenijada/index.ts';

const offers = getLocalSandboxBlockData()
    .filter((row) =>
        kestenijadaItems.some((item) => item.name === row.information.name),
    )
    .map((row, i) => ({ ...row, id: 900 + i, prices: { sunflowers: 10 } }));
const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url?.startsWith('/api/directories/entities/block'))
        res.end(JSON.stringify(offers));
    else {
        res.statusCode = 404;
        res.end('{}');
    }
});
const appOrigin = new URL(
    process.env.GREDICE_KESTENIJADA_TEST_ORIGIN ?? 'http://127.0.0.1:5486',
);
if (
    appOrigin.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(appOrigin.hostname) ||
    appOrigin.pathname !== '/' ||
    appOrigin.search ||
    appOrigin.hash ||
    appOrigin.username ||
    appOrigin.password
)
    throw new Error('Fixture requires a local HTTP origin');
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const apiAddress = server.address();
if (!apiAddress || typeof apiAddress === 'string')
    throw new Error('Fixture API did not bind');
const now = Date.now();
const child = spawn(
    process.execPath,
    [
        'node_modules/next/dist/bin/next',
        'start',
        '-H',
        appOrigin.hostname,
        '-p',
        appOrigin.port || '80',
    ],
    {
        stdio: 'inherit',
        env: {
            ...process.env,
            VERCEL_ENV: 'development',
            GREDICE_API_HOST: `http://127.0.0.1:${apiAddress.port}`,
            GREDICE_KESTENIJADA_EVENT_CONFIG: JSON.stringify({
                enabled: true,
                assetsVerified: true,
                startsAt: new Date(now - 3600000).toISOString(),
                endsAt: new Date(now + 3600000).toISOString(),
            }),
        },
    },
);
for (const signal of ['SIGTERM', 'SIGINT'])
    process.on(signal, () => {
        child.kill(signal);
        server.close();
    });
child.on('exit', (code) => {
    server.close();
    process.exitCode = code ?? 1;
});
