'use client';

import { Add, Delete } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import type { Rule } from '../../lib/plant-definitions';

interface RuleEditorProps {
    rules: Record<string, Rule>;
    onRulesChange: (newRules: Record<string, Rule>) => void;
}

export function RuleEditor({ rules, onRulesChange }: RuleEditorProps) {
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
        field: 'rule' | 'weight',
        value: string | number,
    ) => {
        const newRules = JSON.parse(JSON.stringify(rules));
        const ruleSet = newRules[symbol];
        if (Array.isArray(ruleSet)) {
            ruleSet[index][field] = value;
        } else {
            newRules[symbol] = value;
        }
        onRulesChange(newRules);
    };

    const addRulePart = (symbol: string) => {
        const newRules = JSON.parse(JSON.stringify(rules));
        let ruleSet = newRules[symbol];
        if (typeof ruleSet === 'string') {
            ruleSet = [{ rule: ruleSet, weight: 1 }];
        }
        if (Array.isArray(ruleSet)) {
            ruleSet.push({ rule: '', weight: 1 });
        }
        newRules[symbol] = ruleSet;
        onRulesChange(newRules);
    };

    const removeRulePart = (symbol: string, index: number) => {
        const newRules = JSON.parse(JSON.stringify(rules));
        const ruleSet = newRules[symbol];
        if (Array.isArray(ruleSet)) {
            ruleSet.splice(index, 1);
            if (ruleSet.length === 1) {
                newRules[symbol] = ruleSet[0].rule;
            } else {
                newRules[symbol] = ruleSet;
            }
        }
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

                    {Array.isArray(ruleSet) ? (
                        ruleSet.map((part, index) => (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: Allowed here, since rules are array/index based
                                key={index}
                                className="flex items-center gap-2"
                            >
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
                                    className="font-mono"
                                    fullWidth
                                />
                                <Input
                                    type="number"
                                    value={part.weight}
                                    className="w-20"
                                    onChange={(e) =>
                                        handleRulePartChange(
                                            symbol,
                                            index,
                                            'weight',
                                            Number(e.target.value),
                                        )
                                    }
                                    placeholder="Težina..."
                                />
                                <IconButton
                                    title="Ukloni"
                                    variant="plain"
                                    className="text-destructive aspect-square"
                                    onClick={() =>
                                        removeRulePart(symbol, index)
                                    }
                                >
                                    <Delete className="size-4 shrink-0" />
                                </IconButton>
                            </div>
                        ))
                    ) : (
                        <Input
                            value={ruleSet}
                            onChange={(e) =>
                                onRulesChange({
                                    ...rules,
                                    [symbol]: e.target.value,
                                })
                            }
                            placeholder="L-System pravilo"
                            className="font-mono"
                        />
                    )}
                </div>
            ))}
            <Button fullWidth onClick={addSymbol}>
                Dodaj simbol
            </Button>
        </div>
    );
}
