import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import { mkdir, readdir } from 'fs/promises';

console.log('Regenerating sound effects...');

ffmpeg.setFfmpegPath(ffmpegPath.path);

// Make sure destination directory exists
await mkdir('./public/assets/sounds/ambient', { recursive: true });

// Convert all files to MP3
const files = (await readdir('./data/sounds/ambient')).filter(f => f.endsWith('.wav'));
for (const file of files) {
    console.log(`Converting ${file}...`);
    ffmpeg()
        .input(`./data/sounds/ambient/${file}`)
        .outputOptions('-codec:a libmp3lame')
        .addOutputOption('-qscale:a 7')
        .output(`./public/assets/sounds/ambient/${file.replace('.wav', '.mp3')}`)
        .run();
}