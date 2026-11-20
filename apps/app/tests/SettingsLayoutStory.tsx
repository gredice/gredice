import { SettingsCard } from '../app/admin/settings/_components/SettingsCard';
import { SettingsCardBody } from '../app/admin/settings/_components/SettingsCardBody';
import { SettingsLayout } from '../app/admin/settings/_components/SettingsLayout';
import { SettingsSection } from '../app/admin/settings/_components/SettingsSection';
import { settingsSectionGroups } from '../app/admin/settings/settingsSections';

const sections = settingsSectionGroups.flatMap((group) => [...group.sections]);
// The personal sections at the end are short, like on the real page, so they
// cannot scroll up to the top of the screen.
const shortSectionCount = 2;

export function SettingsLayoutStory() {
    return (
        // Matches the admin content panel that frames every admin page.
        <div className="border bg-[var(--admin-page-content-background)] p-3 md:p-4">
            <SettingsLayout>
                {sections.map((section, index) => (
                    <SettingsSection
                        key={section.id}
                        section={section}
                        description={`Opis odjeljka ${section.title}.`}
                    >
                        <SettingsCard title={`Postavka: ${section.title}`}>
                            <SettingsCardBody>
                                <label className="block text-sm">
                                    Polje: {section.title}
                                    <input
                                        className="block w-full rounded-md border px-3 py-2"
                                        name={`${section.id}-field`}
                                    />
                                </label>
                                <div
                                    className={
                                        index >=
                                        sections.length - shortSectionCount
                                            ? 'h-24'
                                            : 'h-[520px]'
                                    }
                                />
                                <button type="button">
                                    Spremi: {section.title}
                                </button>
                            </SettingsCardBody>
                        </SettingsCard>
                    </SettingsSection>
                ))}
            </SettingsLayout>
        </div>
    );
}
