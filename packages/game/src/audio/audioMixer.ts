export async function audioMixer() {
    const audioContext = new AudioContext();

    const availableOutputDevices = (await navigator.mediaDevices.enumerateDevices())
        .filter(d => d.kind === 'audiooutput');

    return {

    };
}