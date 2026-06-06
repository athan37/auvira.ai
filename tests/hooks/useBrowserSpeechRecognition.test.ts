import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSpeechRecognitionSession,
  getSpeechRecognitionConstructor,
  mapSpeechRecognitionError,
} from '@/lib/hooks/browserSpeechRecognitionSession';

type MockResultList = Array<{ isFinal: boolean; transcript: string }>;

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  onstart: (() => void) | null = null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
  onend: (() => void) | null = null;

  start = vi.fn(() => {
    this.onstart?.();
  });

  stop = vi.fn(() => {
    this.onend?.();
  });

  abort = vi.fn(() => {
    this.onend?.();
  });

  emitResult(results: MockResultList, resultIndex = 0) {
    const list = results.map((entry) => ({
      isFinal: entry.isFinal,
      0: { transcript: entry.transcript },
      length: 1,
      item: (index: number) => (index === 0 ? { transcript: entry.transcript } : null),
    }));
    this.onresult?.({
      resultIndex,
      results: list,
    } as unknown as SpeechRecognitionEvent);
  }

  emitError(error: string) {
    this.onerror?.({ error } as SpeechRecognitionErrorEvent);
  }
}

function installMockSpeechRecognition() {
  const instances: MockSpeechRecognition[] = [];
  const Ctor = vi.fn(function MockSpeechRecognitionCtor(this: MockSpeechRecognition) {
    const instance = new MockSpeechRecognition();
    instances.push(instance);
    return instance;
  });

  vi.stubGlobal('window', { SpeechRecognition: Ctor });
  vi.stubGlobal('navigator', { language: 'en-US' });

  return { Ctor, instances, latest: () => instances[instances.length - 1] };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mapSpeechRecognitionError', () => {
  it('maps common Web Speech API error codes', () => {
    expect(mapSpeechRecognitionError('not-allowed')).toContain('denied');
    expect(mapSpeechRecognitionError('no-speech')).toContain('No speech detected');
    expect(mapSpeechRecognitionError('network')).toContain('Network error');
    expect(mapSpeechRecognitionError('aborted')).toContain('cancelled');
  });
});

describe('getSpeechRecognitionConstructor', () => {
  it('returns null when speech recognition is unavailable', () => {
    vi.stubGlobal('window', undefined);
    expect(getSpeechRecognitionConstructor()).toBeNull();
  });
});

describe('createSpeechRecognitionSession', () => {
  it('start sets listening=true', () => {
    installMockSpeechRecognition();
    let latest = createSpeechRecognitionSession({ onStateChange: () => {} }).getState();
    const session = createSpeechRecognitionSession({
      onStateChange: (state) => {
        latest = state;
      },
    });

    session.start();
    expect(latest.listening).toBe(true);
  });

  it('result events accumulate interim and final transcript', () => {
    const mock = installMockSpeechRecognition();
    let latest = createSpeechRecognitionSession({ onStateChange: () => {} }).getState();
    const session = createSpeechRecognitionSession({
      onStateChange: (state) => {
        latest = state;
      },
    });

    session.start();
    mock.latest()?.emitResult([{ isFinal: false, transcript: 'make this' }]);
    expect(latest.interimTranscript).toBe('make this');
    expect(latest.finalTranscript).toBe('');

    mock.latest()?.emitResult([{ isFinal: true, transcript: 'make this heading blue' }]);
    expect(latest.finalTranscript).toBe('make this heading blue');
  });

  it('stop clears listening and keeps final transcript', () => {
    const mock = installMockSpeechRecognition();
    let latest = createSpeechRecognitionSession({ onStateChange: () => {} }).getState();
    const session = createSpeechRecognitionSession({
      onStateChange: (state) => {
        latest = state;
      },
    });

    session.start();
    mock.latest()?.emitResult([{ isFinal: true, transcript: 'update hero copy' }]);
    session.stop();

    expect(latest.listening).toBe(false);
    expect(latest.finalTranscript).toBe('update hero copy');
  });

  it('error event sets error and stops listening', () => {
    const mock = installMockSpeechRecognition();
    let latest = createSpeechRecognitionSession({ onStateChange: () => {} }).getState();
    const session = createSpeechRecognitionSession({
      onStateChange: (state) => {
        latest = state;
      },
    });

    session.start();
    mock.latest()?.emitError('not-allowed');

    expect(latest.error).toContain('denied');
    expect(latest.listening).toBe(false);
  });

  it('abort clears listening and calls recognition.abort', () => {
    const mock = installMockSpeechRecognition();
    let latest = createSpeechRecognitionSession({ onStateChange: () => {} }).getState();
    const session = createSpeechRecognitionSession({
      onStateChange: (state) => {
        latest = state;
      },
    });

    session.start();
    const instance = mock.latest();
    session.abort();

    expect(instance?.abort).toHaveBeenCalled();
    expect(latest.listening).toBe(false);
  });
});
