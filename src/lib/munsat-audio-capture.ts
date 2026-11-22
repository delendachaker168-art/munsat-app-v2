import { EventEmitter, requireNativeModule } from 'expo-modules-core';

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
  startSession(modelPath: string, idleGrammar: string[], recordingGrammar: string[]): Promise<void>;
  stopSession(): Promise<void>;
  startRecording(): Promise<void>;
  stopRecording(reason: 'manual' | 'command'): Promise<void>;
  cancelRecording(): Promise<void>;
  isRecording(): boolean;
};

let native: NativeCapture | null = null;
let emitter: EventEmitter | null = null;
try {
  native = requireNativeModule<NativeCapture>('MunsatAudioCapture');
  emitter = new EventEmitter(native as any);
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
export const addListener = (
  event: 'onCommand' | 'onRecordingStarted' | 'onRecordingStopped' | 'onRecordingCancelled' | 'onCaptureError',
  listener: (payload: CaptureEvent) => void
) => emitter?.addListener(event, listener) ?? { remove() {} };

export type { CaptureEvent };
