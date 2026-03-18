'use client';

import { cx } from '@signalco/ui-primitives/cx';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useMemo } from 'react';
import {
    parseLSystemSymbols,
    serializeLSystemSymbol,
} from '../../lib/l-system';

interface RulePreviewProps {
    symbol: string;
    rule: string;
    left?: string[];
    right?: string[];
}

function getTokenClasses(token: string) {
    switch (token[0]) {
        case 'F':
        case 'S':
        case 'G':
            return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100';
        case 'L':
        case 'J':
            return 'border-lime-500/30 bg-lime-500/10 text-lime-900 dark:text-lime-100';
        case 'P':
        case 'R':
            return 'border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-100';
        case 'T':
            return 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100';
        case '+':
        case '-':
        case '&':
        case '^':
        case '/':
        case '\\':
            return 'border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100';
        default:
            return 'border-border bg-background text-foreground';
    }
}

function splitRuleStructure(rule: string) {
    const symbols = parseLSystemSymbols(rule, 1);
    const trunk: string[] = [];
    const branches: string[][] = [];
    let depth = 0;
    let activeBranch: string[] | null = null;

    for (const symbol of symbols) {
        if (symbol.char === '[') {
            if (depth === 0) {
                activeBranch = [];
            } else {
                activeBranch?.push(serializeLSystemSymbol(symbol));
            }
            depth += 1;
            continue;
        }

        if (symbol.char === ']') {
            depth -= 1;
            if (depth === 0) {
                if (activeBranch?.length) {
                    branches.push(activeBranch);
                }
                activeBranch = null;
            } else {
                activeBranch?.push(serializeLSystemSymbol(symbol));
            }
            continue;
        }

        const token = serializeLSystemSymbol(symbol);
        if (depth === 0) {
            trunk.push(token);
        } else {
            activeBranch?.push(token);
        }
    }

    return { trunk, branches };
}

function createStableTokenKeys(tokens: string[]) {
    const tokenOccurrences = new Map<string, number>();

    return tokens.map((token) => {
        const occurrence = (tokenOccurrences.get(token) ?? 0) + 1;
        tokenOccurrences.set(token, occurrence);

        return {
            key: `${token}|${occurrence}`,
            token,
        };
    });
}

function RuleToken({ token }: { token: string }) {
    return (
        <span
            className={cx(
                'rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium',
                getTokenClasses(token),
            )}
        >
            {token}
        </span>
    );
}

export function RulePreview({ symbol, rule, left, right }: RulePreviewProps) {
    const preview = useMemo(() => splitRuleStructure(rule), [rule]);
    const trunkTokens = useMemo(
        () => createStableTokenKeys(preview.trunk),
        [preview.trunk],
    );
    const branches = useMemo(() => {
        const branchOccurrences = new Map<string, number>();

        return preview.branches.map((branch) => {
            const signature = branch.join('|');
            const occurrence = (branchOccurrences.get(signature) ?? 0) + 1;
            branchOccurrences.set(signature, occurrence);

            return {
                key: `${signature}|${occurrence}`,
                tokens: createStableTokenKeys(branch),
            };
        });
    }, [preview.branches]);
    const isEmpty = !preview.trunk.length && !preview.branches.length;

    return (
        <div className="space-y-2 rounded-md border border-dashed bg-muted/20 px-3 py-2">
            <Typography level="body3" secondary>
                Izolirani pregled pravila
            </Typography>
            <div className="flex items-center gap-2">
                <span className="rounded-full border bg-background px-2 py-0.5 font-mono text-[11px] font-semibold">
                    {symbol}
                </span>
                <span className="text-xs text-muted-foreground">proizvodi</span>
                <div className="flex flex-1 flex-wrap gap-1">
                    {isEmpty ? (
                        <span className="text-[11px] italic text-muted-foreground">
                            Prazan izlaz
                        </span>
                    ) : trunkTokens.length ? (
                        trunkTokens.map(({ key, token }) => (
                            <RuleToken
                                key={`${symbol}-trunk-${key}`}
                                token={token}
                            />
                        ))
                    ) : (
                        <span className="text-[11px] italic text-muted-foreground">
                            Bez glavne osi
                        </span>
                    )}
                </div>
            </div>

            {branches.length > 0 && (
                <div className="space-y-1 pl-4">
                    {branches.map((branch) => (
                        <div
                            key={`${symbol}-branch-${branch.key}`}
                            className="flex items-start gap-2"
                        >
                            <div className="mt-2 h-px w-3 bg-border" />
                            <div className="flex flex-wrap gap-1">
                                {branch.tokens.map(({ key, token }) => (
                                    <RuleToken
                                        key={`${branch.key}-${key}`}
                                        token={token}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {(left?.length || right?.length) && (
                <div className="flex flex-wrap gap-3 border-t pt-2 text-[11px]">
                    {left?.length ? (
                        <div className="flex flex-wrap items-center gap-1">
                            <span className="text-muted-foreground">
                                Lijevo
                            </span>
                            {left.map((token) => (
                                <RuleToken
                                    key={`${symbol}-left-${token}`}
                                    token={token}
                                />
                            ))}
                        </div>
                    ) : null}
                    {right?.length ? (
                        <div className="flex flex-wrap items-center gap-1">
                            <span className="text-muted-foreground">Desno</span>
                            {right.map((token) => (
                                <RuleToken
                                    key={`${symbol}-right-${token}`}
                                    token={token}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}
