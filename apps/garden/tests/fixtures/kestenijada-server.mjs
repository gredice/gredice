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
await new Promise((resolve) => server.listen(5488, '127.0.0.1', resolve));
const now = Date.now();
const child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '-p', '5486'],
    {
        stdio: 'inherit',
        env: {
            ...process.env,
            VERCEL_ENV: 'development',
            GREDICE_API_HOST: 'http://127.0.0.1:5488',
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
