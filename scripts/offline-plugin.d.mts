import type { Plugin } from 'vite';

export function precacheEntries(outDir: string): string[];
export function writeServiceWorker(outDir: string): void;
export function offlinePlugin(): Plugin;
