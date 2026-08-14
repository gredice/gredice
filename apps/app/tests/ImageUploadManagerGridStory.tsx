import { ImageUploadManager } from '../components/shared/media/ImageUploadManager';

export function ImageUploadManagerGridStory() {
    return (
        <ImageUploadManager
            handleUploadUrl="/api/test-upload"
            uploadPath={({ file }) => `test/${file.name}`}
            layout="grid"
            itemLabel={({ file }) => file.name.replace(/\.jpg$/i, '')}
            showCameraButton={false}
        />
    );
}
