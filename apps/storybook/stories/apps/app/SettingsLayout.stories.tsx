import { SettingsCard } from '@apps/app/app/admin/settings/_components/SettingsCard';
import { SettingsCardBody } from '@apps/app/app/admin/settings/_components/SettingsCardBody';
import { SettingsCardFooter } from '@apps/app/app/admin/settings/_components/SettingsCardFooter';
import { SettingsFormMessage } from '@apps/app/app/admin/settings/_components/SettingsFormMessage';
import { SettingsLayout } from '@apps/app/app/admin/settings/_components/SettingsLayout';
import { SettingsSection } from '@apps/app/app/admin/settings/_components/SettingsSection';
import { settingsSectionGroups } from '@apps/app/app/admin/settings/settingsSections';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const sections = settingsSectionGroups.flatMap((group) => [...group.sections]);

// Stands in for the admin content panel that frames the page.
const panelClassName =
    'bg-[var(--admin-page-content-background)] p-3 [--admin-page-content-background:hsl(var(--background))] md:p-4';

const meta = {
    title: 'apps/app/Admin/Settings/SettingsLayout',
    component: SettingsLayout,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'SettingsLayout is the frame of the admin settings page. Its section links (SettingsSectionNav) sit beside the content when there is room and become a sticky scrolling row above it otherwise, following the available width rather than the screen. Each SettingsSection holds the setting cards of one section.',
            },
        },
    },
    args: {
        children: sections.map((section) => (
            <SettingsSection
                key={section.id}
                section={section}
                description={`Postavke odjeljka „${section.title}”.`}
            >
                <SettingsCard
                    title={`Postavka: ${section.title}`}
                    description="Opis postavke i onoga na što utječe."
                >
                    <form>
                        <SettingsCardBody>
                            <div className="max-w-xl">
                                <Input
                                    name={`${section.id}-value`}
                                    label="Vrijednost"
                                    placeholder="npr. C1234567890"
                                    fullWidth
                                />
                            </div>
                        </SettingsCardBody>
                        <SettingsCardFooter>
                            <SettingsFormMessage state={null} />
                            <Button type="button">Spremi</Button>
                        </SettingsCardFooter>
                    </form>
                </SettingsCard>
            </SettingsSection>
        )),
    },
    render: (args) => (
        <div className={panelClassName}>
            <SettingsLayout {...args} />
        </div>
    ),
} satisfies Meta<typeof SettingsLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

/** With room, the section links are a sticky column beside the content. */
export const Default: Story = {};

/**
 * Without room, for example on a phone or beside the open admin navigation,
 * the section links are a sticky row that scrolls sideways.
 */
export const Narrow: Story = {
    render: (args) => (
        <div className="max-w-md border-x">
            <div className={panelClassName}>
                <SettingsLayout {...args} />
            </div>
        </div>
    ),
};
