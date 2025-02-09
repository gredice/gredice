import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import { S3, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import { mkdir, unlink } from 'fs/promises';
import stream from 'stream';

console.log('Regenerating sound effects...');

ffmpeg.setFfmpegPath(ffmpegPath.path);

const s3 = new S3({
    endpoint: 'https://16b6e8d38ba0b62ad0a3a702243b1265.eu.r2.cloudflarestorage.com',
    region: 'auto',
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
});

// Example function to download, convert, and re-upload WAV files
async function convertWavToMp3(bucketName: string, prefix: string) {
    const objects = await s3.send(new ListObjectsV2Command({ Bucket: bucketName, Prefix: prefix }));
    if (!objects.Contents) return;

    for (const obj of objects.Contents) {
        if (!obj.Key?.endsWith('.wav')) continue;
        const localWav = path.join('.', 'temp', path.basename(obj.Key));
        const localMp3 = localWav.replace('.wav', '.mp3');

        console.log('Converting', localWav, ' > ', localMp3);

        // Download file
        console.log('Downloading', localWav);
        await mkdir('temp', { recursive: true });
        const wavStream = createWriteStream(localWav);
        const wavData = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: obj.Key }));
        const nodeStream = stream.Readable.from(wavData.Body as any);
        nodeStream.pipe(wavStream);

        // Wait until download completes
        await new Promise<void>((res) => wavStream.on('finish', () => res()));

        // Convert
        await new Promise<void>((res, rej) => {
            ffmpeg()
                .input(localWav)
                .outputOptions('-codec:a libmp3lame')
                .addOutputOption('-qscale:a 7')
                .output(localMp3)
                .on('end', () => res())
                .on('error', (err) => rej(err))
                .run();
        });

        // Upload converted file
        console.log('Uploading', localMp3);
        const mp3Stream = createReadStream(localMp3);
        await s3.send(
            new PutObjectCommand({
                Bucket: bucketName,
                Key: obj.Key.replace('.wav', '.mp3'),
                Body: mp3Stream,
                ContentType: 'audio/mpeg',
            })
        );

        // Cleanup
        await unlink(localWav);
        await unlink(localMp3);
    }
}

(async () => {
    try {
        await convertWavToMp3('gredice-cdn', 'sounds/');
        console.log('Done converting files.');
    } catch (err) {
        console.error('Error:', err);
    }
})();
