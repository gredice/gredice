'use client';

import type { SelectCmsPage } from '@gredice/storage';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useActionState } from 'react';
import type { CmsPageFormState } from './actions';

type CmsPageFormProps = {
    page?: SelectCmsPage;
    action: (
        previousState: CmsPageFormState,
        formData: FormData,
    ) => Promise<CmsPageFormState>;
    submitLabel: string;
};

const cmsPageStateItems = [
    { value: 'draft', label: 'Draft' },
    {
        value: 'published',
        label: 'Objavljeno',
    },
];

export function CmsPageForm({ page, action, submitLabel }: CmsPageFormProps) {
    const [state, formAction, pending] = useActionState(action, null);

    return (
        <Card className="max-w-3xl">
            <Stack spacing={4} className="p-6">
                <form action={formAction}>
                    <Stack spacing={4}>
                        <Stack spacing={3}>
                            <Input
                                name="title"
                                label="Naslov"
                                defaultValue={page?.title ?? ''}
                                required
                            />
                            <Input
                                name="slug"
                                label="Slug"
                                defaultValue={page?.slug ?? ''}
                                placeholder="npr. sezonski-vodic"
                                helperText="Slug se sprema normalizirano i ne smije zauzeti postojeću statičku rutu."
                                required
                            />
                            <SelectItems
                                name="state"
                                label="Status"
                                defaultValue={page?.state ?? 'draft'}
                                items={cmsPageStateItems}
                            />
                            <label className="space-y-1">
                                <span className="block text-sm font-medium">
                                    Sadržaj
                                </span>
                                <textarea
                                    name="content"
                                    defaultValue={page?.content ?? ''}
                                    placeholder='[{"component":"Feature1","header":"Naslov"}]'
                                    rows={10}
                                    className="block min-h-48 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                                <Typography level="body3" secondary>
                                    Unesi JSON niz SectionData blokova (npr.
                                    komponenta Feature1, Heading1, Faq1 ili
                                    Footer1).
                                </Typography>
                            </label>
                        </Stack>

                        <Stack spacing={3}>
                            <Typography level="h3" semiBold>
                                Metadata
                            </Typography>
                            <Input
                                name="metaTitle"
                                label="Meta naslov"
                                defaultValue={page?.metaTitle ?? ''}
                            />
                            <Input
                                name="metaDescription"
                                label="Meta opis"
                                defaultValue={page?.metaDescription ?? ''}
                            />
                            <Input
                                name="metaImageUrl"
                                label="Meta slika URL"
                                type="url"
                                defaultValue={page?.metaImageUrl ?? ''}
                            />
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
