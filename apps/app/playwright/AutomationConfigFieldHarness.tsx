import type {
    AutomationJsonObject,
    AutomationModuleMetadata,
} from '@gredice/storage';
import { useState } from 'react';
import { AutomationConfigFieldInput } from '../app/admin/automations/AutomationConfigFieldInput';
import { jsonConfigDraftKey } from '../app/admin/automations/automationConfigFieldValues';
import { useAutomationJsonConfigDrafts } from '../app/admin/automations/useAutomationJsonConfigDrafts';

const harnessModule: AutomationModuleMetadata = {
    key: 'harness.configFields',
    kind: 'trigger',
    title: 'Config fields',
    description: 'Config field harness',
    category: 'Harness',
    dryRunSupported: false,
    mutatesData: false,
    retryable: false,
    configFields: [
        {
            key: 'daysOfWeek',
            label: 'Days of week',
            type: 'multiselect',
            options: [
                { value: 'monday', label: 'Monday', aliases: ['mon', '1'] },
                { value: 'tuesday', label: 'Tuesday', aliases: ['tue', '2'] },
                { value: 'wednesday', label: 'Wednesday', aliases: ['wed'] },
                { value: 'friday', label: 'Friday', aliases: ['fri'] },
            ],
        },
        { key: 'operations', label: 'Operations', type: 'json' },
        { key: 'anchorDate', label: 'Anchor date', type: 'date' },
        { key: 'startTime', label: 'Start time', type: 'time' },
        { key: 'startsAt', label: 'Starts at', type: 'datetime' },
        {
            key: 'timeZone',
            label: 'Time zone',
            type: 'timeZone',
            placeholder: 'Europe/Zagreb',
        },
    ],
};

export function AutomationConfigFieldHarness({
    initialConfig,
}: {
    initialConfig: AutomationJsonObject;
}) {
    const [config, setConfig] = useState(initialConfig);
    const [open, setOpen] = useState(true);
    const { drafts, setDraft } = useAutomationJsonConfigDrafts();

    return (
        <div className="w-[400px] space-y-4 p-4">
            <button type="button" onClick={() => setOpen((value) => !value)}>
                {open ? 'Zatvori panel' : 'Otvori panel'}
            </button>
            {open
                ? harnessModule.configFields.map((field) => {
                      const draftKey = jsonConfigDraftKey('node-1', field.key);

                      return (
                          <AutomationConfigFieldInput
                              key={draftKey}
                              module={harnessModule}
                              field={field}
                              value={config[field.key]}
                              onChange={(value) =>
                                  setConfig((current) => ({
                                      ...current,
                                      [field.key]: value,
                                  }))
                              }
                              jsonDraft={drafts[draftKey]}
                              onJsonDraftChange={(draft) =>
                                  setDraft(draftKey, draft)
                              }
                          />
                      );
                  })
                : null}
            <pre data-testid="config">{JSON.stringify(config)}</pre>
        </div>
    );
}
