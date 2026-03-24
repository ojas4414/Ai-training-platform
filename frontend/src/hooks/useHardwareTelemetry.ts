import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface GPUData {
  index: number;
  load: number;
  temp: number;
  vram: number;
}

export interface TelemetryData {
  cpu_percent: number;
  gpus: GPUData[];
  timestamp: number;
}

export interface CardSlotTelemetry {
  cardIndex: number;
  load: number;
  temp: number;
  vram: number;
  color: THREE.Color;
  intensity: number;
}

const colorRed = new THREE.Color('#ef4444');
const colorAmber = new THREE.Color('#EF9F27');
const colorGreen = new THREE.Color('#10b981');
const colorDarkGreen = new THREE.Color('#064e3b');

function getLEDColor(load: number): THREE.Color {
  if (load > 0.9) return colorRed; // Red critical
  if (load > 0.6) return colorAmber; // Amber high
  if (load > 0.1) return colorGreen; // Green active
  return colorDarkGreen; // Dark green idle
}

function getLEDIntensity(load: number): number {
  return 0.5 + load * 2.0;
}

// Global cached array to avoid allocating memory for mapping array on every frame inside useFrame loop
const _cachedCards: CardSlotTelemetry[] = Array.from({ length: 8 }, (_, i) => ({
  cardIndex: i, load: 0, temp: 0, vram: 0, color: new THREE.Color('#064e3b'), intensity: 0.5
}));

export function useHardwareTelemetry() {
  const telemetryRef = useRef<TelemetryData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);

  useEffect(() => {
    let reconnectTimer: number;

    const connect = () => {
      const ws = new WebSocket('ws://localhost:8000/ws/telemetry');

      ws.onopen = () => {
        reconnectAttempt.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data: TelemetryData = JSON.parse(event.data);
          telemetryRef.current = data;
        } catch (err) {
          // ignore
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        // Exponential backoff
        const defer = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 30000);
        reconnectAttempt.current++;
        reconnectTimer = window.setTimeout(connect, defer);
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent exponential backoff execution on dismount
        wsRef.current.close();
      }
    };
  }, []);

  // Maps telemetry gpus array to 8 rack card slots WITHOUT allocating a new array (for 60fps useFrame calls)
  const mapGPUsToCards = (cardCount: number = 8): CardSlotTelemetry[] => {
    const data = telemetryRef.current;
    
    if (!data || !data.gpus || data.gpus.length === 0) {
      for (let i = 0; i < cardCount; i++) {
        _cachedCards[i].load = 0;
        _cachedCards[i].temp = 0;
        _cachedCards[i].vram = 0;
        _cachedCards[i].color.copy(colorDarkGreen);
        _cachedCards[i].intensity = 0.5;
      }
      return _cachedCards;
    }

    const gpus = data.gpus;
    for (let i = 0; i < cardCount; i++) {
      const gpu = gpus[i % gpus.length]; // wrap if fewer GPUs than cards
      const normalizedLoad = gpu.load / 100;
      const normalizedVram = gpu.vram / 100;

      _cachedCards[i].load = normalizedLoad;
      _cachedCards[i].temp = gpu.temp;
      _cachedCards[i].vram = normalizedVram;
      _cachedCards[i].color.copy(getLEDColor(normalizedLoad));
      _cachedCards[i].intensity = getLEDIntensity(normalizedLoad);
    }
    
    return _cachedCards;
  };

  return { telemetryRef, mapGPUsToCards };
}
