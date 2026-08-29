/**
 * Zero-dependency procedural ambient soundscape generator using Web Audio API.
 * Provides soothing gentle rain, warm campfire crackle, forest rustle, and lo-fi cafe chord tones.
 */

let audioCtx: AudioContext | null = null;
let currentNodes: { stop: () => void }[] = [];
let masterGainNode: GainNode | null = null;
let isPlaying = false;
let currentTrack: 'rain' | 'campfire' | 'forest' | 'cafe' | 'none' = 'none';
let currentVolume = 0.4;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function getMasterGain(ctx: AudioContext): GainNode {
  if (!masterGainNode) {
    masterGainNode = ctx.createGain();
    masterGainNode.gain.setValueAtTime(currentVolume, ctx.currentTime);
    masterGainNode.connect(ctx.destination);
  }
  return masterGainNode;
}

export function playAmbientTrack(track: 'rain' | 'campfire' | 'forest' | 'cafe' | 'none', volume = 0.4) {
  stopAmbientTrack();

  if (track === 'none') {
    currentTrack = 'none';
    isPlaying = false;
    return;
  }

  const ctx = getAudioContext();
  const master = getMasterGain(ctx);
  currentVolume = volume;
  master.gain.setValueAtTime(volume, ctx.currentTime);

  currentTrack = track;
  isPlaying = true;

  if (track === 'rain') {
    // Pink noise + low-pass filter
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.035;
      b6 = white * 0.115926;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    whiteNoise.start();
    currentNodes.push({
      stop: () => {
        try {
          whiteNoise.stop();
          whiteNoise.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
      }
    });
  } else if (track === 'campfire') {
    // Warm low drone + random pop crackles
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * (Math.random() > 0.994 ? 0.75 : 0.015);
    }

    const crackleSource = ctx.createBufferSource();
    crackleSource.buffer = noiseBuffer;
    crackleSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, ctx.currentTime);
    filter.Q.setValueAtTime(1.5, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, ctx.currentTime);

    // Warm low drone
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(95, ctx.currentTime);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.08, ctx.currentTime);

    crackleSource.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc.connect(oscGain);
    oscGain.connect(master);

    crackleSource.start();
    osc.start();

    currentNodes.push({
      stop: () => {
        try {
          crackleSource.stop();
          osc.stop();
          crackleSource.disconnect();
          filter.disconnect();
          gain.disconnect();
          osc.disconnect();
          oscGain.disconnect();
        } catch {
          // ignore
        }
      }
    });
  } else if (track === 'cafe') {
    // Soft soothing warm chord loop (lo-fi vibe)
    const freqs = [220, 261.63, 329.63, 392.00]; // A minor 7th warm chord
    const oscs: OscillatorNode[] = [];
    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0.06, ctx.currentTime);
    mainGain.connect(master);

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) {
        pan.pan.value = (idx - 1.5) * 0.4;
        osc.connect(pan);
        pan.connect(mainGain);
      } else {
        osc.connect(mainGain);
      }
      osc.start();
      oscs.push(osc);
    });

    currentNodes.push({
      stop: () => {
        try {
          oscs.forEach(o => {
            o.stop();
            o.disconnect();
          });
          mainGain.disconnect();
        } catch {
          // ignore
        }
      }
    });
  } else if (track === 'forest') {
    // Gentle rustling breeze
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.02;
    }

    const breeze = ctx.createBufferSource();
    breeze.buffer = noiseBuffer;
    breeze.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, ctx.currentTime);

    breeze.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    breeze.start();

    currentNodes.push({
      stop: () => {
        try {
          breeze.stop();
          breeze.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
      }
    });
  }
}

export function stopAmbientTrack() {
  currentNodes.forEach(node => {
    try {
      node.stop();
    } catch {
      // ignore
    }
  });
  currentNodes = [];
  isPlaying = false;
}

export function setAmbientVolume(volume: number) {
  currentVolume = volume;
  if (masterGainNode && audioCtx) {
    masterGainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
  }
}

export const audioSynth = {
  start: (track: 'rain' | 'campfire' | 'forest' | 'cafe' | 'none', volume = 0.4) => playAmbientTrack(track, volume),
  stop: () => stopAmbientTrack(),
  setVolume: (volume: number) => setAmbientVolume(volume),
  isPlaying: () => isPlaying,
  currentTrack: () => currentTrack
};
