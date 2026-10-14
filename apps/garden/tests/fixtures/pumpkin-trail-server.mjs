import { spawn } from 'node:child_process';

const origin = new URL(
    process.env.GREDICE_PUMPKIN_TRAIL_TEST_ORIGIN ?? 'http://127.0.0.1:5491',
);
if (
    origin.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(origin.hostname) ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
)
    throw new Error('Fixture requires a local HTTP origin');
const child = spawn(
    process.execPath,
    [
        'node_modules/next/dist/bin/next',
        'start',
        '-H',
        origin.hostname,
        '-p',
        origin.port,
    ],
    { stdio: 'inherit', env: { ...process.env, VERCEL_ENV: 'development' } },
);
for (const signal of ['SIGTERM', 'SIGINT'])
    process.on(signal, () => child.kill(signal));
child.on('exit', (code) => {
    process.exitCode = code ?? 1;
});
