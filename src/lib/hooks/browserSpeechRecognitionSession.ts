export type SpeechRecognitionCtor = new () => SpeechRecognition;

export interface SpeechRecognitionSessionState {
  listening: boolean;
  interimTranscript: string;
  finalTranscript: string;
  error: string | null;
}

export interface SpeechRecognitionSessionHandlers {
  onStateChange: (state: SpeechRecognitionSessionState) => void;
}

/** SSR-safe lookup for the browser SpeechRecognition constructor. */
export function getSpeechRecognitionConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

/** Map Web Speech API error codes to user-facing messages. */
export function mapSpeechRecognitionError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was denied. Allow microphone access and try again.';
    case 'no-speech':
      return 'No speech detected. Try again.';
    case 'network':
      return 'Network error during speech recognition. Check your connection.';
    case 'aborted':
      return 'Speech recognition was cancelled.';
    case 'audio-capture':
      return 'No microphone was found. Connect a microphone and try again.';
    case 'language-not-supported':
      return 'This language is not supported for speech recognition.';
    default:
      return 'Speech recognition failed. Try again.';
  }
}

function defaultRecognitionLanguage(): string {
  if (typeof navigator === 'undefined') return 'en-US';
  return navigator.language || 'en-US';
}

export interface SpeechRecognitionSession {
  start: () => void;
  stop: () => void;
  abort: () => void;
  resetError: () => void;
  getState: () => SpeechRecognitionSessionState;
}

/** Imperative Web Speech session used by the React hook and unit tests. */
export function createSpeechRecognitionSession(
  handlers: SpeechRecognitionSessionHandlers
): SpeechRecognitionSession {
  let listening = false;
  let interimTranscript = '';
  let finalTranscript = '';
  let error: string | null = null;

  const finalParts: string[] = [];
  let recognition: SpeechRecognition | null = null;
  let ignoreNextEnd = false;

  const emit = () => {
    handlers.onStateChange({
      listening,
      interimTranscript,
      finalTranscript,
      error,
    });
  };

  const syncFinalTranscript = () => {
    finalTranscript = finalParts.join(' ').trim();
  };

  const resetTranscripts = () => {
    finalParts.length = 0;
    interimTranscript = '';
    finalTranscript = '';
  };

  const teardownRecognition = () => {
    recognition = null;
    listening = false;
    interimTranscript = '';
    emit();
  };

  const createRecognition = (): SpeechRecognition | null => {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return null;

    const instance = new Ctor();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = defaultRecognitionLanguage();

    instance.onstart = () => {
      listening = true;
      error = null;
      emit();
    };

    instance.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = (result[0]?.transcript ?? '').trim();
        if (!text) continue;
        if (result.isFinal) {
          finalParts.push(text);
        } else {
          interim = text;
        }
      }
      interimTranscript = interim;
      syncFinalTranscript();
      emit();
    };

    instance.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'aborted') return;
      error = mapSpeechRecognitionError(event.error);
      ignoreNextEnd = true;
      teardownRecognition();
    };

    instance.onend = () => {
      if (ignoreNextEnd) {
        ignoreNextEnd = false;
        return;
      }
      syncFinalTranscript();
      teardownRecognition();
    };

    return instance;
  };

  return {
    getState: () => ({ listening, interimTranscript, finalTranscript, error }),

    resetError: () => {
      error = null;
      emit();
    },

    start: () => {
      if (!getSpeechRecognitionConstructor()) {
        error = 'Speech recognition is not supported in this browser.';
        emit();
        return;
      }

      error = null;
      resetTranscripts();
      ignoreNextEnd = false;

      if (recognition) {
        try {
          recognition.abort();
        } catch {
          /* ignore */
        }
        recognition = null;
      }

      const nextRecognition = createRecognition();
      if (!nextRecognition) {
        error = 'Speech recognition is not supported in this browser.';
        emit();
        return;
      }

      recognition = nextRecognition;
      try {
        recognition.start();
      } catch {
        teardownRecognition();
        error = 'Could not start speech recognition. Try again.';
        emit();
      }
    },

    stop: () => {
      if (!recognition) return;
      try {
        recognition.stop();
      } catch {
        teardownRecognition();
      }
    },

    abort: () => {
      if (!recognition) {
        teardownRecognition();
        return;
      }
      ignoreNextEnd = true;
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
      recognition = null;
      teardownRecognition();
    },
  };
}
