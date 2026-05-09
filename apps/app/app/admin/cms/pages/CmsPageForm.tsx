"use client";

import type { SelectCmsPage } from '@gredice/storage';
import { SectionsView } from '@signalco/cms-core/SectionsView';
import { cmsPageSectionComponents } from '@gredice/storage/cmsPageSections';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useActionState, useEffect, useId, useMemo, useRef, useState } from 'react';
import { sectionsComponentRegistry } from '../../../../components/shared/sectionsComponentRegistry';
import type { CmsPageAutosaveState, CmsPageFormState } from './actions';

type CmsPageFormProps = {
  page?: SelectCmsPage;
  action: (
    previousState: CmsPageFormState,
    formData: FormData,
  ) => Promise<CmsPageFormState>;
  submitLabel: string;
  autosaveAction?: (formData: FormData) => Promise<CmsPageAutosaveState>;
};

type CmsPageSectionData = {
  component: string;
  [key: string]: unknown;
};

type CmsPageEditableSection = {
  id: string;
  data: CmsPageSectionData;
};

const cmsPageStateItems = [
  { value: "draft", label: "Draft" },
  {
    value: "published",
    label: "Objavljeno",
  },
];

const cmsPageSectionItems = cmsPageSectionComponents.map((component) => ({
    value: component.component,
    label: component.label,
}));

const cmsPageSectionComponentsByName = new Map(
    cmsPageSectionComponents.map((component) => [
        component.component,
        component,
    ]),
);

function parseSections(content?: string | null) {
  if (!content) {
    return { isStructured: true, sections: [] };
  }

  try {
    const parsed: unknown = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      return { isStructured: false, sections: [] };
    }

    return {
      isStructured: true,
      sections: parsed.filter(
        (section): section is CmsPageSectionData =>
          Boolean(section) &&
          typeof section === "object" &&
          "component" in section &&
          typeof section.component === "string",
      ),
    };
  } catch {
    return { isStructured: false, sections: [] };
  }
}

function formatJsonContent(content: string) {
  if (!content.trim()) {
    return "";
  }

  const parsed: unknown = JSON.parse(content);
  return JSON.stringify(parsed, null, 2);
}

function editableSection(
  section: CmsPageSectionData,
  occurrence: number,
): CmsPageEditableSection {
  return {
    id: `${section.component}-${occurrence}`,
    data: section,
  };
}

function newSection(
  component: string,
  idPrefix: string,
  id: number,
): CmsPageEditableSection {
  return {
    id: `${idPrefix}-${id}`,
    data: { component },
  };
}

function editableSections(sections: CmsPageSectionData[]) {
  const sectionCounts = new Map<string, number>();
  return sections.map((section) => {
    const occurrence = sectionCounts.get(section.component) ?? 0;
    sectionCounts.set(section.component, occurrence + 1);
    return editableSection(section, occurrence);
  });
}

function stringifySections(sections: CmsPageEditableSection[]) {
  const data = sections.map((section) => section.data);
  return data.length > 0 ? JSON.stringify(data, null, 2) : "";
}

function sectionValue(section: CmsPageEditableSection, key: string) {
  const value = section.data[key];
  return typeof value === "string" ? value : "";
}

function moveSection(
  sections: CmsPageEditableSection[],
  sectionId: string,
  offset: number,
) {
  const index = sections.findIndex((section) => section.id === sectionId);
  const targetIndex = index + offset;
  if (index < 0 || targetIndex < 0 || targetIndex >= sections.length) {
    return sections;
  }

  const next = [...sections];
  const movingSections = next.splice(index, 1);
  if (movingSections.length !== 1) {
    return sections;
  }

  const [movingSection] = movingSections;
  if (!movingSection) {
    return sections;
  }

  next.splice(targetIndex, 0, movingSection);
  return next;
}

function copySection(
    section: CmsPageEditableSection,
    id: string,
): CmsPageEditableSection {
    return {
        id,
        data: JSON.parse(JSON.stringify(section.data)) as CmsPageSectionData,
    };
}

function validateSection(section: CmsPageEditableSection) {
    const fields =
        cmsPageSectionComponentsByName.get(section.data.component)?.fields ??
        [];
    return fields
        .filter((field) => field.required)
        .filter((field) => {
            const value = section.data[field.key];
            return !(typeof value === 'string' && value.trim().length > 0);
        })
        .map((field) => `${field.label} je obavezno polje.`);
}

export function CmsPageForm({ page, action, submitLabel, autosaveAction }: CmsPageFormProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const reactId = useId();
  const newSectionIdPrefix = useMemo(
    () => `${reactId}-${page?.id ?? "new"}`,
    [page?.id, reactId],
  );
  const parsedSections = useMemo(
    () => parseSections(page?.content),
    [page?.content],
  );
  const nextSectionId = useRef(parsedSections.sections.length);
  const [sections, setSections] = useState<CmsPageEditableSection[]>(() =>
    editableSections(parsedSections.sections),
  );
  const preserveFallbackContent =
    !parsedSections.isStructured && Boolean(page?.content);
  const [rawMode, setRawMode] = useState(preserveFallbackContent);
  const [rawContent, setRawContent] = useState(page?.content ?? "");
  const [rawError, setRawError] = useState<string | null>(null);
  const builderContent = useMemo(() => stringifySections(sections), [sections]);
  const serializedContent = rawMode
    ? rawContent
    : preserveFallbackContent && sections.length === 0
      ? page?.content ?? ""
      : builderContent;
  const [autosaveStatus, setAutosaveStatus] = useState("saved");
  const [autosaveMessage, setAutosaveMessage] = useState<string | null>(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(serializedContent);
  const [previewSections, setPreviewSections] = useState<CmsPageSectionData[]>([]);

  useEffect(() => {
    if (!autosaveAction) {
      return;
    }

    if (serializedContent === lastSavedSnapshot) {
      setAutosaveStatus("saved");
      return;
    }

    setAutosaveStatus("unsaved");
    const timer = setTimeout(async () => {
      setAutosaveStatus("saving");
      const formData = new FormData();
      formData.set("title", page?.title ?? "");
      formData.set("slug", page?.slug ?? "");
      formData.set("state", "draft");
      formData.set("content", serializedContent);
      formData.set("metaTitle", page?.metaTitle ?? "");
      formData.set("metaDescription", page?.metaDescription ?? "");
      formData.set("metaImageUrl", page?.metaImageUrl ?? "");
      formData.set("canonicalPath", page?.canonicalPath ?? "");

      const result = await autosaveAction(formData);
      if (!result.success) {
        setAutosaveStatus("failed");
        setAutosaveMessage(result.message);
        return;
      }

      setAutosaveStatus("saved");
      setAutosaveMessage(result.message);
      setLastSavedSnapshot(serializedContent);
    }, 600);

    return () => clearTimeout(timer);
  }, [autosaveAction, serializedContent, lastSavedSnapshot, page]);

  useEffect(() => {
    setPreviewSections(parseSections(serializedContent).sections);
  }, [serializedContent]);

  return (
    <Card className="max-w-3xl">
      <Stack spacing={4} className="p-6">
        <form
          action={formAction}
          onSubmit={(event) => {
            if (!rawMode) {
              return;
            }

            try {
              setRawContent(formatJsonContent(rawContent));
              setRawError(null);
            } catch {
              event.preventDefault();
              setRawError("JSON nije valjan. Ispravi sadržaj prije spremanja.");
            }
          }}
        >
          <Stack spacing={4}>
            <Stack spacing={3}>
              {autosaveAction && (
                <Typography level="body3" secondary>
                  Autosave: {autosaveStatus}{autosaveMessage ? ` • ${autosaveMessage}` : ""}
                </Typography>
              )}
              <Input
                name="title"
                label="Naslov"
                defaultValue={page?.title ?? ""}
                required
              />
              <Input
                name="slug"
                label="Slug"
                defaultValue={page?.slug ?? ""}
                placeholder="npr. sezonski-vodic"
                helperText="Slug se sprema normalizirano i ne smije zauzeti postojeću statičku rutu."
                required
              />
              <SelectItems
                name="state"
                label="Status"
                defaultValue={page?.state ?? "draft"}
                items={cmsPageStateItems}
              />
              <Stack spacing={2}>
                <Typography level="h3" semiBold>
                  Sadržaj stranice
                </Typography>
                <Typography level="body3" secondary>
                  Vizualni editor je zadani način rada, a JSON editor je
                  dostupan kao fallback.
                </Typography>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={rawMode}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      setRawMode(enabled);
                      setRawError(null);
                      if (enabled) {
                        setRawContent(builderContent);
                      }
                    }}
                  />
                  Uredi sadržaj kroz JSON editor (fallback)
                </label>
                {preserveFallbackContent && (
                  <Card className="p-3 text-sm text-amber-700">
                    Postojeći sadržaj nije moguće prikazati u vizualnom editoru
                    bez gubitka podataka.
                  </Card>
                )}
                <input
                  name="content"
                  type="hidden"
                  value={serializedContent}
                  readOnly
                />
                {rawMode ? (
                  <label className="space-y-1">
                    <span className="block text-sm font-medium">
                      JSON sadržaj
                    </span>
                    <textarea
                      value={rawContent}
                      rows={16}
                      className="block w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onBlur={() => {
                        try {
                          setRawContent(formatJsonContent(rawContent));
                          setRawError(null);
                        } catch {
                          setRawError(
                            "JSON nije valjan. Ispravi sadržaj prije spremanja.",
                          );
                        }
                      }}
                      onChange={(event) => {
                        setRawContent(event.target.value);
                        setRawError(null);
                      }}
                    />
                    {rawError && (
                      <Typography level="body2" className="text-red-600">
                        {rawError}
                      </Typography>
                    )}
                    {preserveFallbackContent && (
                      <Button
                        type="button"
                        variant="plain"
                        onClick={() => {
                          setRawContent(page?.content ?? "");
                          setRawError(null);
                        }}
                      >
                        Vrati spremljeni sadržaj
                      </Button>
                    )}
                  </label>
                ) : sections.length === 0 ? (
                  <Card className="p-4 text-sm text-muted-foreground">
                    {preserveFallbackContent
                      ? "Postojeći sadržaj nije JSON niz sekcija i bit će sačuvan dok ne dodaš novu sekciju. Dodavanje nove sekcije zamijenit će ga novom strukturom sekcija."
                      : "Stranica još nema sekcija."}
                  </Card>
                ) : (
                  <Stack spacing={2}>
                    {sections.map((section, index) => (
                      <Card key={section.id} className="p-4">
                        <Stack spacing={2}>
                          <Row
                            spacing={2}
                            className="items-center justify-between"
                          >
                            <Typography level="body1" semiBold>
                              {index + 1}.{' '}
                              {section.data.component}
                            </Typography>
                            <Row spacing={1}>
                              <Button
                                type="button"
                                variant="plain"
                                disabled={index === 0}
                                onClick={() =>
                                  setSections((current) =>
                                    moveSection(current, section.id, -1),
                                  )
                                }
                              >
                                Gore
                              </Button>
                              <Button
                                type="button"
                                variant="plain"
                                disabled={index === sections.length - 1}
                                onClick={() =>
                                  setSections((current) =>
                                    moveSection(current, section.id, 1),
                                  )
                                }
                              >
                                Dolje
                              </Button>
                              <Button
                                type="button"
                                variant="plain"
                                onClick={() => {
                                  setSections((current) => {
                                    const idx = current.findIndex(
                                      (candidate) =>
                                        candidate.id === section.id,
                                    );
                                    if (idx < 0) {
                                      return current;
                                    }
                                    const sectionId = nextSectionId.current;
                                    nextSectionId.current += 1;
                                    const duplicate = copySection(
                                      section,
                                      `${newSectionIdPrefix}-${sectionId}`,
                                    );
                                    return [
                                      ...current.slice(0, idx + 1),
                                      duplicate,
                                      ...current.slice(idx + 1),
                                    ];
                                  });
                                }}
                              >
                                Dupliciraj
                              </Button>
                              <Button
                                type="button"
                                variant="plain"
                                color="danger"
                                onClick={() =>
                                  setSections((current) =>
                                    current.filter(
                                      (currentSection) =>
                                        currentSection.id !== section.id,
                                    ),
                                  )
                                }
                              >
                                Ukloni
                              </Button>
                            </Row>
                          </Row>
                          {(
                            cmsPageSectionComponentsByName.get(
                              section.data.component,
                            )?.fields ?? []
                          ).map((field) =>
                            field.type === 'textarea' ? (
                              <label
                                key={field.key}
                                className="space-y-1"
                              >
                                <span className="block text-sm font-medium">
                                  {field.label}
                                </span>
                                <textarea
                                  value={sectionValue(section, field.key)}
                                  rows={field.rows ?? 4}
                                  className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setSections((current) =>
                                      current.map((currentSection) =>
                                        currentSection.id === section.id
                                          ? {
                                              ...currentSection,
                                              data: {
                                                ...currentSection.data,
                                                [field.key]: value,
                                              },
                                            }
                                          : currentSection,
                                      ),
                                    );
                                  }}
                                />
                              </label>
                            ) : (
                              <Input
                                key={field.key}
                                label={field.label}
                                value={sectionValue(section, field.key)}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setSections((current) =>
                                    current.map((currentSection) =>
                                      currentSection.id === section.id
                                        ? {
                                            ...currentSection,
                                            data: {
                                              ...currentSection.data,
                                              [field.key]: value,
                                            },
                                          }
                                        : currentSection,
                                    ),
                                  );
                                }}
                              />
                            ),
                          )}
                          {validateSection(section).map((error) => (
                            <Typography
                              key={error}
                              level="body3"
                              className="text-red-600"
                            >
                              {error}
                            </Typography>
                          ))}
                        </Stack>
                      </Card>
                    ))}
                  </Stack>
                )}
                <Row spacing={2}>
                  {!rawMode &&
                    cmsPageSectionItems.map((item) => (
                      <Button
                        key={item.value}
                        type="button"
                        variant="outlined"
                        onClick={() => {
                          setSections((current) => {
                            const sectionId = nextSectionId.current;
                            nextSectionId.current += 1;
                            return [
                              ...current,
                              newSection(
                                item.value,
                                newSectionIdPrefix,
                                sectionId,
                              ),
                            ];
                          });
                        }}
                      >
                        Dodaj {item.label}
                      </Button>
                    ))}
                </Row>
              </Stack>
            </Stack>

            <Stack spacing={2}>
              <Typography level="h3" semiBold>Live preview</Typography>
              <Card className="p-4">
                <SectionsView
                  sectionsData={previewSections}
                  componentsRegistry={sectionsComponentRegistry}
                />
              </Card>
            </Stack>

            <Stack spacing={3}>
              <Typography level="h3" semiBold>
                Metadata
              </Typography>
              <Input
                name="metaTitle"
                label="Meta naslov"
                defaultValue={page?.metaTitle ?? ""}
              />
              <Input
                name="metaDescription"
                label="Meta opis"
                defaultValue={page?.metaDescription ?? ""}
              />
              <Input
                name="metaImageUrl"
                label="Meta slika URL"
                type="url"
                defaultValue={page?.metaImageUrl ?? ""}
              />
              <Input
                name="canonicalPath"
                label="Canonical putanja"
                defaultValue={page?.canonicalPath ?? ""}
                placeholder="/primjer-stranice"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="noIndex"
                  defaultChecked={page?.noIndex ?? false}
                />
                Isključi iz indeksiranja (noindex)
              </label>
            </Stack>

            {state?.message && (
              <Typography level="body2" className="text-red-600">
                {state.message}
              </Typography>
            )}

            <Button
              variant="solid"
              type="submit"
              className="w-fit"
              loading={pending}
            >
              {submitLabel}
            </Button>
          </Stack>
        </form>
      </Stack>
    </Card>
  );
}
