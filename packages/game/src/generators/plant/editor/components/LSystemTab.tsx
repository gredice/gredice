'use client';

import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { PlantControlsProps } from '../@types/plant-generator';
import { InfoHint } from './InfoHint';
import { LSystemLegend } from './LSystemLegend';
import { RuleEditor } from './RuleEditor';

export function LSystemTab({
    state,
    onDefinitionChange,
    onRulesChange,
    lSystemChain,
    lSystemSymbolCount,
}: PlantControlsProps) {
    return (
        <div className="space-y-4">
            <Row spacing={1} justifyContent="space-between" alignItems="center">
                <Typography level="body2" bold>
                    Pravila i simboli
                </Typography>
                <InfoHint
                    label="Pomoć za L-system"
                    title="Kako čitati i pisati pravila"
                >
                    <Typography level="body3">
                        Parametri se pišu kao `F(1.2,0.8)` ili `+(35)`. Za `F/S`
                        prvi broj mijenja duljinu segmenta, drugi debljinu. Za
                        rotacije prvi broj je kut u stupnjevima.
                    </Typography>
                    <Typography level="body3">
                        Polja `Lijevo` i `Desno` matchaju najbliži značajni
                        simbol oko trenutnog.
                    </Typography>
                    <LSystemLegend />
                </InfoHint>
            </Row>
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
            <div className="space-y-2">
                <Typography>
                    Lanac generiranja ({lSystemSymbolCount} simbola)
                </Typography>
                <div className="w-full p-2 bg-gray-100 dark:bg-gray-900 rounded-md text-xs break-all max-h-32 overflow-y-auto">
                    {lSystemChain}
                </div>
            </div>
        </div>
    );
}
