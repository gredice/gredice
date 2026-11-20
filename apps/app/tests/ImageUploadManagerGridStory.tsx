import { ImageUploadManager } from '../components/shared/media/ImageUploadManager';

export function ImageUploadManagerGridStory({
    maxFileBytes,
}: {
    maxFileBytes?: number;
}) {
    return (
        <ImageUploadManager
            editPhotos={maxFileBytes !== undefined}
            maxFileBytes={maxFileBytes}
            handleUploadUrl="/api/test-upload"
            uploadPath={({ file }) => `test/${file.name}`}
            layout="grid"
            itemLabel={({ file }) => file.name.replace(/\.jpg$/i, '')}
            showCameraButton={false}
        />
    );
}
