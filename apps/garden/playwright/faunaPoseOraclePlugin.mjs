import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// TypeScript 7 ships its parser bridge as a dependency of the pinned compiler.
const compilerRequire = createRequire(
    import.meta.resolve('typescript/package.json'),
);
const ts = compilerRequire('@typescript/typescript6');
export const faunaPoseReferenceCommit =
    '54278326213053ce318c7ea071c8bb94cb6d5257';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const oracle = path.join(root, 'packages/game/tests/faunaPoseOracle.ts');
const entries = new Map([
    ['Cow.tsx', ['updateCowPose']],
    [
        'farmAnimals/FarmAnimals.tsx',
        [
            'updateChickenPose',
            'updateGoatPose',
            'updatePigletPose',
            'updateSheepPose',
        ],
    ],
    ['birds/Birds.tsx', ['updateBirdLegPose', 'updateGroundPeckPose']],
    ['dogs/Dogs.tsx', ['updateDogWalkPose']],
    ['rabbits/Rabbit.tsx', ['animateRabbitRig']],
    ['bees/Bees.tsx', ['updateBeeRig']],
    ['butterflies/Butterflies.tsx', ['updateButterflyRig']],
    ['ladybugs/Ladybugs.tsx', ['updateLadybugRig']],
    ['slugs/Slugs.tsx', ['updateRig']],
]);
const hash = (text) => createHash('sha256').update(text).digest('hex');
const reference = (file) =>
    execFileSync('git', ['show', `${faunaPoseReferenceCommit}:${file}`], {
        cwd: root,
        encoding: 'utf8',
    });

function declarations(text, file) {
    const source = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
    );
    const functions = new Map();
    const variables = new Map();
    const imports = new Map();
    for (const node of source.statements) {
        if (ts.isFunctionDeclaration(node) && node.name)
            functions.set(node.name.text, node);
        if (ts.isVariableStatement(node))
            for (const declaration of node.declarationList.declarations)
                if (ts.isIdentifier(declaration.name))
                    variables.set(declaration.name.text, declaration);
        if (ts.isImportDeclaration(node)) {
            const names = node.importClause?.namedBindings;
            if (names && ts.isNamedImports(names))
                for (const specifier of names.elements)
                    imports.set(specifier.name.text, node.moduleSpecifier.text);
        }
    }
    return { source, functions, variables, imports };
}
function identifiers(node) {
    const result = new Set();
    function visit(child) {
        if (ts.isIdentifier(child)) result.add(child.text);
        ts.forEachChild(child, visit);
    }
    visit(node);
    return result;
}

/** Enabled only for the explicitly requested supplemental replay. */
export function faunaPoseOraclePlugin() {
    const enabled =
        process.env.FAUNA_TRAJECTORY_MODE === 'baseline' ||
        Boolean(process.env.FAUNA_TRAJECTORY_REFERENCE);
    return {
        name: 'frozen-fauna-pose-oracle',
        enforce: 'pre',
        transform(code, id) {
            if (!enabled) return null;
            const file = path.relative(root, id.split('?')[0]);
            const relative = file.replace(
                /^packages\/game\/src\/entities\//,
                '',
            );
            if (relative === 'animals/FaunaRuntimeProvider.tsx') {
                const callback =
                    '(state, frame) => callbackRef.current(state, frame.delta),';
                assert.ok(
                    code.includes(callback),
                    'Missing actual fixed-step callback receipt point',
                );
                return {
                    code: `import { recordFaunaSimulationStep as __recordFaunaSimulationStep } from ${JSON.stringify(oracle)};\n${code.replace(callback, '(state, frame) => { __recordFaunaSimulationStep(frame, actorRef?.current); return callbackRef.current(state, frame.delta); },')}`,
                    map: null,
                };
            }
            const names = entries.get(relative);
            if (!names) return null;
            if (relative === 'butterflies/Butterflies.tsx') {
                assert.equal(
                    code.split('\n        updateButterflyRig({').length,
                    2,
                );
                code = code.replace(
                    '\n        updateButterflyRig({',
                    '\n        __recordFaunaActorRoot(butterflyModel.scene, group);\n        updateButterflyRig({',
                );
            }
            if (
                relative === 'ladybugs/Ladybugs.tsx' &&
                code.includes('const poseSample = poseProgressRef.current;')
            ) {
                code = code.replace(
                    'updateLadybugRig({\n            delta,',
                    'updateLadybugRig({\n            __poseProgress: { ...poseSample },\n            delta,',
                );
            }
            const oldText = reference(file);
            const old = declarations(oldText, file),
                current = declarations(code, file);
            const replacements = [];
            const additions = [];
            for (const name of names) {
                const oldFunction = old.functions.get(name),
                    actualFunction = current.functions.get(name);
                assert.ok(
                    oldFunction && actualFunction,
                    `Missing actual/reference pose function ${file}:${name}`,
                );
                const helperHashes = {};
                const visited = new Set([name]);
                function inspect(node) {
                    for (const identifier of identifiers(node)) {
                        if (visited.has(identifier)) continue;
                        visited.add(identifier);
                        const dependency =
                            old.functions.get(identifier) ??
                            old.variables.get(identifier);
                        if (dependency) {
                            const actual =
                                current.functions.get(identifier) ??
                                current.variables.get(identifier);
                            assert.ok(
                                actual,
                                `Missing pose dependency ${identifier}`,
                            );
                            assert.equal(
                                actual.getText(current.source),
                                dependency.getText(old.source),
                                `Changed oracle dependency ${file}:${identifier}`,
                            );
                            helperHashes[`${file}:${identifier}`] = hash(
                                dependency.getText(old.source),
                            );
                            inspect(dependency);
                        } else {
                            const source = old.imports.get(identifier);
                            if (!source?.startsWith('.')) continue;
                            const resolved = path.resolve(
                                path.dirname(path.join(root, file)),
                                source,
                            );
                            const dependencyFile = ['.ts', '.tsx']
                                .map((extension) => `${resolved}${extension}`)
                                .find((candidate) => {
                                    try {
                                        readFileSync(candidate);
                                        return true;
                                    } catch {
                                        return false;
                                    }
                                });
                            assert.ok(
                                dependencyFile,
                                `Unresolved pose dependency ${source}`,
                            );
                            const dependencyPath = path.relative(
                                root,
                                dependencyFile,
                            );
                            const frozen = reference(dependencyPath);
                            assert.equal(
                                readFileSync(dependencyFile, 'utf8'),
                                frozen,
                                `Changed imported pose dependency ${dependencyPath}`,
                            );
                            helperHashes[dependencyPath] = hash(frozen);
                        }
                    }
                }
                inspect(oldFunction);
                const frozenBody = oldFunction.getText(old.source);
                const actualBody = actualFunction.getText(current.source);
                // The nullable initial-flight adapter is the sole deliberate
                // pose-body change; the frozen calculation remains unchanged.
                if (name !== 'updateButterflyRig')
                    assert.equal(
                        actualBody,
                        frozenBody,
                        `Changed pose body ${file}:${name}`,
                    );
                const actualName = `__faunaActual_${name}`,
                    legacyName = `__faunaLegacy_${name}`;
                replacements.push({
                    start: actualFunction.getStart(current.source),
                    end: actualFunction.end,
                    text: actualBody.replace(
                        `function ${name}`,
                        `function ${actualName}`,
                    ),
                });
                additions.push(
                    frozenBody.replace(
                        `function ${name}`,
                        `function ${legacyName}`,
                    ),
                );
                const metadata = {
                    file,
                    name,
                    referenceCommit: faunaPoseReferenceCommit,
                    referenceHash: hash(frozenBody),
                    actualHash: hash(actualBody),
                    helperHashes,
                };
                additions.push(
                    `function ${name}(...args: Parameters<typeof ${actualName}>): ReturnType<typeof ${actualName}> { return __invokeFaunaPoseOracle(${JSON.stringify(metadata)}, args, ${actualName}, ${legacyName}); }`,
                );
            }
            let result = code;
            for (const replacement of replacements.sort(
                (a, b) => b.start - a.start,
            ))
                result =
                    result.slice(0, replacement.start) +
                    replacement.text +
                    result.slice(replacement.end);
            return {
                code: `import { invokeFaunaPoseOracle as __invokeFaunaPoseOracle, recordFaunaActorRoot as __recordFaunaActorRoot } from ${JSON.stringify(oracle)};\n${result}\n${additions.join('\n')}`,
                map: null,
            };
        },
    };
}
