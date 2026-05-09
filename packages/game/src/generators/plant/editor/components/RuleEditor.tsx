'use client';

import { Add, Delete } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import type { Rule, RuleOption } from '../../lib/plant-definitions';
import { RulePreview } from './RulePreview';

interface RuleEditorProps {
    rules: Record<string, Rule>;
    onRulesChange: (newRules: Record<string, Rule>) => void;
}

function normalizeRuleSet(ruleSet: Rule): RuleOption[] {
    return Array.isArray(ruleSet) ? ruleSet : [{ rule: ruleSet, weight: 1 }];
}

function simplifyRuleSet(ruleSet: RuleOption[]): Rule {
    if (ruleSet.length !== 1) {
        return ruleSet;
    }

    const [singleRule] = ruleSet;
    if (
        singleRule.weight === 1 &&
        !singleRule.left?.length &&
        !singleRule.right?.length &&
        !singleRule.ignore?.length
    ) {
        return singleRule.rule;
    }

    return ruleSet;
}

export function RuleEditor({ rules, onRulesChange }: RuleEditorProps) {
    const parseContextInput = (value: string) => {
        const entries = value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);
        return entries.length > 0 ? entries : undefined;
    };

    const handleSymbolChange = (oldSymbol: string, newSymbol: string) => {
        const newRules = { ...rules };
        if (newSymbol && !newRules[newSymbol]) {
            newRules[newSymbol] = newRules[oldSymbol];
            delete newRules[oldSymbol];
            onRulesChange(newRules);
        }
    };

    const handleRulePartChange = (
        symbol: string,
        index: number,
        field: 'rule' | 'weight' | 'left' | 'right',
        value: string | number,
    ) => {
        const newRules = JSON.parse(JSON.stringify(rules)) as Record<
            string,
            Rule
        >;
        const ruleSet = normalizeRuleSet(newRules[symbol]);
        const ruleOption = ruleSet[index] ?? { rule: '', weight: 1 };

        if (field === 'left' || field === 'right') {
            const parsedValue = parseContextInput(String(value));
            if (parsedValue) {
                ruleOption[field] = parsedValue;
            } else {
                delete ruleOption[field];
            }
        } else if (field === 'weight') {
            ruleOption.weight = Number(value);
        } else {
            ruleOption.rule = String(value);
        }

        ruleSet[index] = ruleOption;
        newRules[symbol] = ruleSet;
        onRulesChange(newRules);
    };

    const addRulePart = (symbol: string) => {
        const newRules = JSON.parse(JSON.stringify(rules)) as Record<
            string,
            Rule
        >;
        const ruleSet = normalizeRuleSet(newRules[symbol]);
        ruleSet.push({ rule: '', weight: 1 });
        newRules[symbol] = ruleSet;
        onRulesChange(newRules);
    };

    const removeRulePart = (symbol: string, index: number) => {
        const newRules = JSON.parse(JSON.stringify(rules)) as Record<
            string,
            Rule
        >;
        const ruleSet = normalizeRuleSet(newRules[symbol]);
        ruleSet.splice(index, 1);
        newRules[symbol] = ruleSet.length > 0 ? simplifyRuleSet(ruleSet) : '';
        onRulesChange(newRules);
    };

    const addSymbol = () => {
        const newSymbol = 'NewSymbol';
        if (!rules[newSymbol]) {
            const newRules = { ...rules, [newSymbol]: '' };
            onRulesChange(newRules);
        }
    };

    const removeSymbol = (symbol: string) => {
        const newRules = { ...rules };
        delete newRules[symbol];
        onRulesChange(newRules);
    };

    return (
        <div className="space-y-4">
            {Object.entries(rules).map(([symbol, ruleSet]) => (
                <div key={symbol} className="p-3 border rounded-md space-y-3">
                    <Row spacing={1}>
                        <Input
                            value={symbol}
                            onChange={(e) =>
                                handleSymbolChange(symbol, e.target.value)
                            }
                            className="font-mono font-bold"
                            fullWidth
                        />
                        <Row>
                            <IconButton
                                title="Dodaj pravilo"
                                className="aspect-square"
                                variant="plain"
                                onClick={() => addRulePart(symbol)}
                            >
                                <Add className="size-4 shrink-0" />
                            </IconButton>
                            <IconButton
                                title="Ukloni simbol"
                                variant="plain"
                                className="text-destructive aspect-square"
                                onClick={() => removeSymbol(symbol)}
                            >
                                <Delete className="size-4 shrink-0" />
                            </IconButton>
                        </Row>
                    </Row>

                    {(() => {
                        const partOccurrences = new Map<string, number>();

                        return normalizeRuleSet(ruleSet).map(
                            (part: RuleOption, index) => {
                                const signature = JSON.stringify({
                                    rule: part.rule,
                                    weight: part.weight,
                                    left: part.left ?? [],
                                    right: part.right ?? [],
                                });
                                const occurrence =
                                    (partOccurrences.get(signature) ?? 0) + 1;
                                partOccurrences.set(signature, occurrence);

                                return (
                                    <div
                                        key={`${signature}|${occurrence}`}
                                        className="space-y-2 rounded-md bg-muted/20 p-2"
                                    >
                                        <div className="flex items-end gap-2">
                                            <Input
                                                value={part.rule}
                                                onChange={(e) =>
                                                    handleRulePartChange(
                                                        symbol,
                                                        index,
                                                        'rule',
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="L-System pravilo"
                                                className="min-w-0 font-mono"
                                                fullWidth
                                            />
                                            <IconButton
                                                title="Ukloni"
                                                variant="plain"
                                                className="aspect-square shrink-0 text-destructive"
                                                onClick={() =>
                                                    removeRulePart(
                                                        symbol,
                                                        index,
                                                    )
                                                }
                                            >
                                                <Delete className="size-4 shrink-0" />
                                            </IconButton>
                                        </div>
                                        <div className="grid gap-2 sm:grid-cols-[92px_minmax(0,1fr)_minmax(0,1fr)]">
                                            <Input
                                                type="number"
                                                value={part.weight}
                                                fullWidth
                                                onChange={(e) =>
                                                    handleRulePartChange(
                                                        symbol,
                                                        index,
                                                        'weight',
                                                        Number(
                                                            e.target.value || 0,
                                                        ),
                                                    )
                                                }
                                                placeholder="Težina"
                                            />
                                            <Input
                                                value={
                                                    part.left?.join(',') ?? ''
                                                }
                                                fullWidth
                                                onChange={(e) =>
                                                    handleRulePartChange(
                                                        symbol,
                                                        index,
                                                        'left',
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="Lijevo"
                                                className="font-mono"
                                            />
                                            <Input
                                                value={
                                                    part.right?.join(',') ?? ''
                                                }
                                                fullWidth
                                                onChange={(e) =>
                                                    handleRulePartChange(
                                                        symbol,
                                                        index,
                                                        'right',
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="Desno"
                                                className="font-mono"
                                            />
                                        </div>
                                        <RulePreview
                                            symbol={symbol}
                                            rule={part.rule}
                                            left={part.left}
                                            right={part.right}
                                        />
                                    </div>
                                );
                            },
                        );
                    })()}
                </div>
            ))}
            <Button fullWidth onClick={addSymbol}>
                Dodaj simbol
            </Button>
        </div>
    );
}
