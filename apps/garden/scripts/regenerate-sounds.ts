import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import { mkdir, readdir, unlink } from 'fs/promises';

console.log('Regenerating sound effects...');

ffmpeg.setFfmpegPath(ffmpegPath.path);

// Prepare destination folders
await mkdir('./public/assets/sounds/ambient', { recursive: true });
for (const file of await readdir('./public/assets/sounds/ambient')) {
    await unlink(`./public/assets/sounds/ambient/${file}`);
}
await mkdir('./public/assets/sounds/effects', { recursive: true });
for (const file of await readdir('./public/assets/sounds/effects')) {
    await unlink(`./public/assets/sounds/effects/${file}`);
}

// Convert all files to MP3
const ambientFiles = (await readdir('./data/sounds/ambient')).filter(f => f.endsWith('.wav'));
for (const file of ambientFiles) {
    console.log(`Converting ambient ${file}...`);
    ffmpeg()
        .input(`./data/sounds/ambient/${file}`)
        .outputOptions('-codec:a libmp3lame')
        .addOutputOption('-qscale:a 7')
        .output(`./public/assets/sounds/ambient/${file.replace('.wav', '.mp3')}`)
        .run();
}

const effectFiles = (await readdir('./data/sounds/effects')).filter(f => f.endsWith('.wav'));
for (const file of effectFiles) {
    console.log(`Converting effect ${file}...`);
    ffmpeg()
        .input(`./data/sounds/effects/${file}`)
        .outputOptions('-codec:a libmp3lame')
        .addOutputOption('-qscale:a 7')
        .output(`./public/assets/sounds/effects/${file.replace('.wav', '.mp3')}`)
        .run();
}