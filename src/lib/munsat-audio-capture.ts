import { requireNativeModule, type EventSubscription } from 'expo-modules-core';

type CaptureEvent = {
  text?: string;
  recording?: boolean;
  uri?: string;
  durationMs?: number;
  reason?: string;
  message?: string;
  startedAt?: number;
};

type NativeCapture = {
  addListener(eventName: string, listener: (payload: CaptureEvent) => void): EventSubscription;
  startSession(modelPath: string, idleGrammar: string[], recordingGrammar: string[]): Promise<void>;
  stopSession(): Promise<void>;
  startRecording(): Promise<void>;
  stopRecording(reason: 'manual' | 'command'): Promise<void>;
  cancelRecording(): Promise<void>;
  isRecording(): boolean;
  startModelDownload(url: string, fileName: string): Promise<{ id: number; status: string }>;
  getModelDownloadStatus(): Promise<{ status: string; downloadedBytes: number; totalBytes: number; fileUri?: string; reason?: number }>;
  removeModelDownload(): Promise<void>;
  isIgnoringBatteryOptimizations(): boolean;
  requestBatteryOptimizationExemption(): Promise<void>;
  openAppSettings(): Promise<void>;
};

let native: NativeCapture | null = null;
try {
  native = requireNativeModule<NativeCapture>('MunsatAudioCapture');
} catch {
  // The module is Android-only; leave non-Android imports safe.
}

const unavailable = async (): Promise<never> => {
  throw new Error('التعرف الصوتي المشترك متاح في نسخة Android فقط.');
};

export const startSession = (path: string, idle: string[], recording: string[]) =>
  native ? native.startSession(path, idle, recording) : unavailable();
export const stopSession = () => native ? native.stopSession() : Promise.resolve();
export const startRecording = () => native ? native.startRecording() : unavailable();
export const stopRecording = (reason: 'manual' | 'command') =>
  native ? native.stopRecording(reason) : unavailable();
export const cancelRecording = () => native ? native.cancelRecording() : unavailable();
export const isRecording = () => native?.isRecording() ?? false;
export const startModelDownload = (url: string, fileName: string) =>
  native ? native.startModelDownload(url, fileName) : unavailable();
export const getModelDownloadStatus = () =>
  native ? native.getModelDownloadStatus() : Promise.resolve({ status: 'none', downloadedBytes: 0, totalBytes: 0 });
export const removeModelDownload = () => native ? native.removeModelDownload() : Promise.resolve();
export const isIgnoringBatteryOptimizations = () => native?.isIgnoringBatteryOptimizations() ?? true;
export const requestBatteryOptimizationExemption = () =>
  native ? native.requestBatteryOptimizationExemption() : unavailable();
export const openAppSettings = () => native ? native.openAppSettings() : unavailable();
export const addListener = (
  event: 'onCommand' | 'onRecordingStarted' | 'onRecordingStopped' | 'onRecordingCancelled' | 'onCaptureError',
  listener: (payload: CaptureEvent) => void
) => native?.addListener(event, listener) ?? { remove() {} };

export type { CaptureEvent };
