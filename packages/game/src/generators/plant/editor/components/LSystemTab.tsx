'use client';

import { Input } from '@signalco/ui-primitives/Input';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { PlantControlsProps } from '../@types/plant-generator';
import { LSystemLegend } from './LSystemLegend';
import { RuleEditor } from './RuleEditor';

export function LSystemTab({
    state,
    onDefinitionChange,
    onRulesChange,
    lSystemChain,
}: PlantControlsProps) {
    return (
        <div className="space-y-4">
            <Input
                label="Baza"
                value={state.definition.axiom}
                onChange={(e) => onDefinitionChange('axiom', e.target.value)}
                className="font-mono"
            />
            <RuleEditor
                rules={state.definition.rules}
                onRulesChange={onRulesChange}
            />
            <LSystemLegend />
            <div className="space-y-2">
                <Typography>
                    Lanac generiranja ({lSystemChain.length})
                </Typography>
                <div className="w-full p-2 bg-gray-100 dark:bg-gray-900 rounded-md text-xs break-all max-h-32 overflow-y-auto">
                    {lSystemChain}
                </div>
            </div>
        </div>
    );
}
