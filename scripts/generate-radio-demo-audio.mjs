// Creates original, short test sounds for the radio prototype. No third-party audio.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sampleRate = 22_050;
const durationSeconds = 6;
const sampleCount = sampleRate * durationSeconds;
const outputDir = new URL('../public/radio/audio/', import.meta.url);
mkdirSync(outputDir, { recursive: true });
const beatsDir = new URL('../public/radio/audio/beats/', import.meta.url);
mkdirSync(beatsDir, { recursive: true });

const sine = (frequency, time) => Math.sin(2 * Math.PI * frequency * time);
const noise = (seed) => {
  const value = Math.sin(seed * 127.1) * 43_758.5453;
  return 2 * (value - Math.floor(value)) - 1;
};
const pulse = (time, length) => Math.exp(-time / length);
const beat = (time, beatLength) => time % beatLength;

const sounds = {
  'radio-test-01.wav': (time) => {
    const swell = .55 + .45 * Math.sin(Math.PI * time / durationSeconds);
    return swell * (.28 * sine(220, time) + .2 * sine(277.18, time) + .15 * sine(329.63, time)
      + .08 * sine(440, time + .002 * sine(.4, time)));
  },
  'radio-test-02.wav': (time) => {
    const notes = [196, 246.94, 293.66, 392, 293.66, 246.94];
    const step = Math.floor(time * 2) % notes.length;
    const pluck = pulse(beat(time, .5), .25);
    return .22 * sine(98, time) + .38 * pluck * sine(notes[step], time)
      + .1 * sine(392, time) * Math.sin(Math.PI * time / durationSeconds);
  },
  'beat-test-01.wav': (time) => {
    const kickTime = beat(time, .5);
    const snareTime = beat(time + .5, 1);
    const hatTime = beat(time, .25);
    const kick = .65 * pulse(kickTime, .11) * sine(55 + 60 * pulse(kickTime, .035), time);
    const snare = .22 * pulse(snareTime, .07) * noise(Math.floor(time * sampleRate));
    const hat = .1 * pulse(hatTime, .025) * noise(Math.floor(time * sampleRate) + 77);
    return kick + snare + hat + .12 * sine(110, time);
  },
  'beat-test-02.wav': (time) => {
    const kickTime = beat(time, .75);
    const snareTime = beat(time + .375, .75);
    const hatTime = beat(time, .1875);
    const kick = .65 * pulse(kickTime, .12) * sine(48 + 70 * pulse(kickTime, .04), time);
    const snare = .2 * pulse(snareTime, .065) * noise(Math.floor(time * sampleRate) + 133);
    const hat = .07 * pulse(hatTime, .02) * noise(Math.floor(time * sampleRate) + 311);
    const bass = .18 * sine([82.41, 98, 73.42, 110][Math.floor(time / .75) % 4], time);
    return kick + snare + hat + bass;
  },
};

for (const [name, signal] of Object.entries(sounds)) {
  const pcmBytes = sampleCount * 2;
  const file = Buffer.alloc(44 + pcmBytes);
  file.write('RIFF', 0);
  file.writeUInt32LE(file.length - 8, 4);
  file.write('WAVEfmt ', 8);
  file.writeUInt32LE(16, 16); // PCM header size
  file.writeUInt16LE(1, 20); // PCM
  file.writeUInt16LE(1, 22); // mono
  file.writeUInt32LE(sampleRate, 24);
  file.writeUInt32LE(sampleRate * 2, 28);
  file.writeUInt16LE(2, 32);
  file.writeUInt16LE(16, 34);
  file.write('data', 36);
  file.writeUInt32LE(pcmBytes, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const fade = Math.min(1, time / .02, (durationSeconds - time) / .02);
    const amplitude = Math.tanh(signal(time) * Math.max(0, fade)) * .8;
    file.writeInt16LE(Math.round(amplitude * 32_767), 44 + index * 2);
  }
  const directory = name.startsWith('beat-') ? beatsDir : outputDir;
  writeFileSync(join(fileURLToPath(directory), name), file);
  console.log(`Created ${name} (${durationSeconds}s)`);
}
