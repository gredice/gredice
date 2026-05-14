import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import stream from 'node:stream';
import {
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3,
} from '@aws-sdk/client-s3';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

console.info('Regenerating sound effects...');

const s3 = new S3({
    endpoint:
        'https://16b6e8d38ba0b62ad0a3a702243b1265.eu.r2.cloudflarestorage.com',
    region: 'auto',
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
});

// Helper function to run FFmpeg directly
function runFFmpeg(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const args = [
            '-i',
            inputPath,
            '-codec:a',
            'libmp3lame',
            '-qscale:a',
            '7',
            '-y', // Overwrite output file if it exists
            outputPath,
        ];

        const ffmpegProcess = spawn(ffmpegPath.path, args);

        let stderr = '';

        ffmpegProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ffmpegProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(
                    new Error(
                        `FFmpeg process exited with code ${code}. Error: ${stderr}`,
                    ),
                );
            }
        });

        ffmpegProcess.on('error', (error) => {
            reject(error);
        });
    });
}

// Example function to download, convert, and re-upload WAV files
async function convertWavToMp3(bucketName: string, prefix: string) {
    const objects = await s3.send(
        new ListObjectsV2Command({ Bucket: bucketName, Prefix: prefix }),
    );
    if (!objects.Contents) return;

    for (const obj of objects.Contents) {
        if (!obj.Key?.endsWith('.wav')) continue;
        const localWav = path.join('.', 'temp', path.basename(obj.Key));
        const localMp3 = localWav.replace('.wav', '.mp3');

        console.info('Converting', localWav, ' > ', localMp3);

        // Download file
        console.info('Downloading', localWav);
        await mkdir('temp', { recursive: true });
        const wavStream = createWriteStream(localWav);
        const wavData = await s3.send(
            new GetObjectCommand({ Bucket: bucketName, Key: obj.Key }),
        );
        const nodeStream = stream.Readable.from(
            wavData.Body as NodeJS.ReadableStream,
        );
        nodeStream.pipe(wavStream);

        // Wait until download completes
        await new Promise<void>((res) => wavStream.on('finish', () => res()));

        // Convert
        await runFFmpeg(localWav, localMp3);

        // Upload converted file
        console.info('Uploading', localMp3);
        const mp3Stream = createReadStream(localMp3);
        await s3.send(
            new PutObjectCommand({
                Bucket: bucketName,
                Key: obj.Key.replace('.wav', '.mp3'),
                Body: mp3Stream,
                ContentType: 'audio/mpeg',
            }),
        );

        // Cleanup
        await unlink(localWav);
        await unlink(localMp3);
    }
}

(async () => {
    try {
        await convertWavToMp3('gredice-cdn', 'sounds/');
        console.info('Done converting files.');
    } catch (err) {
        console.error('Error:', err);
    }
})();
