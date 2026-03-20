import { useCallback, useEffect, useRef } from 'react';

export function useCinematicAudio() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const humOscRef = useRef<OscillatorNode | null>(null);
  const humGainRef = useRef<GainNode | null>(null);

  const initAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create Ambient Hum
    const humGain = audioCtxRef.current.createGain();
    humGain.gain.value = 0; // Start muted
    humGain.connect(audioCtxRef.current.destination);
    humGainRef.current = humGain;

    const humOsc = audioCtxRef.current.createOscillator();
    humOsc.type = 'sine';
    humOsc.frequency.value = 45; // Low frequency base
    humOsc.connect(humGain);
    humOsc.start();
    humOscRef.current = humOsc;
  }, []);

  const playWhoosh = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const bufferSize = ctx.sampleRate * 0.5; // 0.5s
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
    noise.stop(ctx.currentTime + 0.5);
  }, []);

  const playClick = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }, []);

  const updateHum = useCallback((scrollProgress: number) => {
    if (!humGainRef.current || !humOscRef.current) return;
    // Map scroll progress to frequency and volume
    const freq = 45 + (scrollProgress * 25);
    const volume = 0.01 + (scrollProgress * 0.02);
    
    humOscRef.current.frequency.setTargetAtTime(freq, 0, 0.1);
    humGainRef.current.gain.setTargetAtTime(volume, 0, 0.1);
  }, []);

  useEffect(() => {
    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

  return { initAudio, playWhoosh, playClick, updateHum };
}
