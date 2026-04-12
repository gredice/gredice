import { spawn } from 'node:child_process';
import { access, copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type ParsedArgs = Map<string, string | boolean>;

type AtlasManifestPage = {
    index: number;
};

type AtlasManifest = {
    pages?: AtlasManifestPage[];
};

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../../..');

function parseArgs(argv: string[]): ParsedArgs {
    const parsed = new Map<string, string | boolean>();

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (!argument?.startsWith('--')) {
            continue;
        }

        const [rawKey, inlineValue] = argument.slice(2).split('=', 2);
        if (inlineValue !== undefined) {
            parsed.set(rawKey, inlineValue);
            continue;
        }

        const next = argv[index + 1];
        if (!next || next.startsWith('--')) {
            parsed.set(rawKey, true);
            continue;
        }

        parsed.set(rawKey, next);
        index += 1;
    }

    return parsed;
}

function getStringArg(
    parsed: ParsedArgs,
    key: string,
    fallback?: string,
): string {
    const value = parsed.get(key);
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }

    if (fallback !== undefined) {
        return fallback;
    }

    throw new Error(`Missing required argument --${key}`);
}

function getNumberArg(
    parsed: ParsedArgs,
    key: string,
    fallback: number,
): number {
    const value = parsed.get(key);
    if (typeof value !== 'string') {
        return fallback;
    }

    const parsedNumber = Number(value);
    if (!Number.isFinite(parsedNumber)) {
        throw new Error(`Argument --${key} must be a number.`);
    }

    return parsedNumber;
}

function resolveFromRepositoryRoot(targetPath: string): string {
    return path.isAbsolute(targetPath)
        ? targetPath
        : path.resolve(repositoryRoot, targetPath);
}

function stripKnownExtension(filePath: string) {
    return filePath.replace(/\.(png|json|ktx2)$/u, '');
}

function getPageBasePath(basePath: string, pageIndex: number) {
    return pageIndex === 0 ? basePath : `${basePath}.${pageIndex}`;
}

function getPagePngPath(basePath: string, pageIndex: number) {
    return `${getPageBasePath(basePath, pageIndex)}.png`;
}

function getPageKtx2Path(basePath: string, pageIndex: number) {
    return `${getPageBasePath(basePath, pageIndex)}.ktx2`;
}

function readThreeVersionFromGamePackage(packageJsonText: string): string {
    const gamePackage = JSON.parse(packageJsonText) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
    };

    const threeVersion =
        gamePackage.devDependencies?.three ?? gamePackage.dependencies?.three;

    if (!threeVersion) {
        throw new Error('Unable to determine the installed three.js version.');
    }

    return threeVersion;
}

async function resolveBasisTranscoderFiles() {
    const gamePackageJsonPath = path.join(
        repositoryRoot,
        'packages/game/package.json',
    );
    const gamePackageJsonText = await readFile(gamePackageJsonPath, 'utf8');
    const threeVersion = readThreeVersionFromGamePackage(gamePackageJsonText);
    const basisDirectory = path.join(
        repositoryRoot,
        'node_modules/.pnpm',
        `three@${threeVersion}`,
        'node_modules/three/examples/jsm/libs/basis',
    );
    const basisTranscoderJsPath = path.join(
        basisDirectory,
        'basis_transcoder.js',
    );
    const basisTranscoderWasmPath = path.join(
        basisDirectory,
        'basis_transcoder.wasm',
    );

    await access(basisTranscoderJsPath);
    await access(basisTranscoderWasmPath);

    return {
        basisTranscoderJsPath,
        basisTranscoderWasmPath,
    };
}

async function copyBasisTranscoderFiles(outputDirectory: string) {
    const { basisTranscoderJsPath, basisTranscoderWasmPath } =
        await resolveBasisTranscoderFiles();

    await mkdir(outputDirectory, { recursive: true });
    await copyFile(
        basisTranscoderJsPath,
        path.join(outputDirectory, 'basis_transcoder.js'),
    );
    await copyFile(
        basisTranscoderWasmPath,
        path.join(outputDirectory, 'basis_transcoder.wasm'),
    );
}

function runToktx(toktxBinary: string, argumentsList: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const toktxProcess = spawn(toktxBinary, argumentsList, {
            cwd: repositoryRoot,
            stdio: 'inherit',
        });

        toktxProcess.on('error', (error) => {
            reject(error);
        });

        toktxProcess.on('close', (exitCode) => {
            if (exitCode === 0) {
                resolve();
                return;
            }

            reject(
                new Error(`toktx exited with code ${exitCode ?? 'unknown'}.`),
            );
        });
    });
}

async function resolveCompressionTargets(
    inputPath: string,
    outputPath?: string,
) {
    if (!inputPath.endsWith('.json')) {
        return [
            {
                inputPngPath: inputPath,
                outputKtx2Path:
                    outputPath ?? inputPath.replace(/\.[^.]+$/u, '.ktx2'),
            },
        ];
    }

    const manifestText = await readFile(inputPath, 'utf8');
    const manifest = JSON.parse(manifestText) as AtlasManifest;
    const basePath = stripKnownExtension(inputPath);
    const pageIndices =
        manifest.pages && manifest.pages.length > 0
            ? manifest.pages.map((page) => page.index)
            : [0];

    return pageIndices.map((pageIndex) => ({
        inputPngPath: getPagePngPath(basePath, pageIndex),
        outputKtx2Path: getPageKtx2Path(basePath, pageIndex),
    }));
}

async function main() {
    const parsedArgs = parseArgs(process.argv.slice(2));
    const inputPath = resolveFromRepositoryRoot(
        getStringArg(parsedArgs, 'input'),
    );
    const outputArg = parsedArgs.get('output');
    const outputPath =
        typeof outputArg === 'string'
            ? resolveFromRepositoryRoot(outputArg)
            : undefined;
    const transcoderOutputDirectory = resolveFromRepositoryRoot(
        getStringArg(
            parsedArgs,
            'transcoder-output-dir',
            'apps/garden/public/assets/basis',
        ),
    );
    const toktxBinary = getStringArg(
        parsedArgs,
        'toktx-bin',
        process.env.TOKTX_BIN || 'toktx',
    );
    const uastcQuality = getNumberArg(parsedArgs, 'uastc-quality', 2);
    const uastcRdoLambda = getNumberArg(parsedArgs, 'uastc-rdo', 1.25);
    const zstdLevel = getNumberArg(parsedArgs, 'zstd', 5);

    const compressionTargets = await resolveCompressionTargets(
        inputPath,
        outputPath,
    );

    for (const target of compressionTargets) {
        await mkdir(path.dirname(target.outputKtx2Path), { recursive: true });
        await rm(target.outputKtx2Path, { force: true });

        const toktxArguments = [
            '--t2',
            '--encode',
            'uastc',
            '--uastc_quality',
            String(uastcQuality),
            '--uastc_rdo_l',
            String(uastcRdoLambda),
            '--zcmp',
            String(zstdLevel),
            '--genmipmap',
            '--assign_oetf',
            'srgb',
            '--assign_primaries',
            'bt709',
            '--',
            target.outputKtx2Path,
            target.inputPngPath,
        ];

        await runToktx(toktxBinary, toktxArguments);
    }

    await copyBasisTranscoderFiles(transcoderOutputDirectory);

    console.info('Compressed atlas and copied Basis transcoders:');
    for (const target of compressionTargets) {
        console.info(
            `  KTX2: ${path.relative(repositoryRoot, target.outputKtx2Path)}`,
        );
    }
    console.info(
        `  Basis: ${path.relative(repositoryRoot, transcoderOutputDirectory)}`,
    );
}

main().catch((error: unknown) => {
    if (
        error instanceof Error &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
        console.error(
            'toktx was not found. Install KTX-Software and ensure `toktx` is on PATH, or pass --toktx-bin.',
        );
        process.exitCode = 1;
        return;
    }

    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
