import { ImageUploadManager } from '@apps/app/components/shared/media/ImageUploadManager';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'App/Schedule/Operation photos',
    component: ImageUploadManager,
    args: {
        editPhotos: true,
        layout: 'grid',
        handleUploadUrl: '/api/operations/images/upload',
        uploadPath: ({ file }) => file.name,
    },
} satisfies Meta<typeof ImageUploadManager>;

export default meta;
export const BeforeCompletion: StoryObj<typeof meta> = {};
