import { ImageUploadManager } from '@apps/app/components/shared/media/ImageUploadManager';
import { MAX_OPERATION_IMAGE_SIZE_BYTES } from '@apps/app/lib/operationPhotoUpload';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { userEvent, within } from 'storybook/test';

const meta = {
    title: 'apps/app/Schedule/Operation photos',
    component: ImageUploadManager,
    args: {
        editPhotos: true,
        maxFileBytes: MAX_OPERATION_IMAGE_SIZE_BYTES,
        layout: 'grid',
        handleUploadUrl: '/api/operations/images/upload',
        uploadPath: ({ file }) => file.name,
    },
} satisfies Meta<typeof ImageUploadManager>;

export default meta;

type Story = StoryObj<typeof meta>;

// Local copies of the two public garden photos from /podignuta-gredica.
async function queuePhotos(canvasElement: HTMLElement) {
    const input = canvasElement.querySelector<HTMLInputElement>(
        'input[type="file"][multiple]',
    );
    if (!input) throw new Error('Photo picker is missing');
    const photos = await Promise.all(
        ['gredica.jpg', 'sadnica.jpg'].map(async (name) => {
            const response = await fetch(`./operation-photos/${name}`);
            if (!response.ok) throw new Error(`Could not load ${name}`);
            return new File([await response.blob()], name, {
                type: 'image/jpeg',
            });
        }),
    );
    await userEvent.upload(input, photos);
    await within(canvasElement).findByRole('button', {
        name: 'Uredi sliku sadnica.jpg',
    });
}

export const BeforeCompletion: Story = {};

export const PendingPhotos: Story = {
    play: ({ canvasElement }) => queuePhotos(canvasElement),
};

export const EditingPhoto: Story = {
    play: async ({ canvasElement }) => {
        await queuePhotos(canvasElement);
        await userEvent.click(
            within(canvasElement).getByRole('button', {
                name: 'Uredi sliku gredica.jpg',
            }),
        );
        await within(canvasElement.ownerDocument.body).findByRole('checkbox', {
            name: 'Primijeni izgled na sve odabrane fotografije (2)',
        });
    },
};

export const EditingPhotoOnMobile: Story = {
    ...EditingPhoto,
    globals: { viewport: { value: 'mobile1', isRotated: false } },
};
