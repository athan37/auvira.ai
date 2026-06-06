'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createSpeechRecognitionSession,
  getSpeechRecognitionConstructor,
  mapSpeechRecognitionError,
  type SpeechRecognitionSessionState,
} from '@/lib/hooks/browserSpeechRecognitionSession';

export { getSpeechRecognitionConstructor, mapSpeechRecognitionError };

export interface BrowserSpeechRecognitionState extends SpeechRecognitionSessionState {
  supported: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  resetError: () => void;
}

/**
 * Client-side speech-to-text via the browser Web Speech API.
 * Audio is processed in-browser; only transcript strings are exposed.
 */
export function useBrowserSpeechRecognition(): BrowserSpeechRecognitionState {
  const supported = useMemo(() => getSpeechRecognitionConstructor() !== null, []);

  const [state, setState] = useState<SpeechRecognitionSessionState>({
    listening: false,
    interimTranscript: '',
    finalTranscript: '',
    error: null,
  });

  const sessionRef = useRef<ReturnType<typeof createSpeechRecognitionSession> | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createSpeechRecognitionSession({ onStateChange: setState });
  }
  const session = sessionRef.current;

  const start = useCallback(() => {
    session.start();
  }, [session]);

  const stop = useCallback(() => {
    session.stop();
  }, [session]);

  const abort = useCallback(() => {
    session.abort();
  }, [session]);

  const resetError = useCallback(() => {
    session.resetError();
  }, [session]);

  useEffect(() => {
    return () => {
      session.abort();
    };
  }, [session]);

  return {
    supported,
    listening: state.listening,
    interimTranscript: state.interimTranscript,
    finalTranscript: state.finalTranscript,
    error: state.error,
    start,
    stop,
    abort,
    resetError,
  };
}
