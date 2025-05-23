
import { useState, useEffect, useCallback } from 'react';

// Added local interfaces for SpeechRecognition API types to avoid global conflicts or missing lib errors
// These provide minimal typings based on the usage within this hook.
interface CustomSpeechRecognitionAlternative {
  transcript: string;
}

interface CustomSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): CustomSpeechRecognitionAlternative;
  [index: number]: CustomSpeechRecognitionAlternative; // Supports results[i][0]
}

interface CustomSpeechRecognitionResultList {
  readonly length: number;
  item(index: number): CustomSpeechRecognitionResult;
  [index: number]: CustomSpeechRecognitionResult; // Supports results[i]
}

interface CustomSpeechRecognitionEvent {
  resultIndex: number;
  results: CustomSpeechRecognitionResultList;
}

interface CustomSpeechRecognitionErrorEvent {
  error: string; // Corresponds to SpeechRecognitionErrorCode values like 'no-speech', 'not-allowed'
  // message?: string; // Also part of the actual event, not used here
}

// Interface for the SpeechRecognition instance itself
interface CustomSpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: CustomSpeechRecognitionEvent) => void) | null;
  onerror: ((event: CustomSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

// FIX: Cast window to 'any' to access SpeechRecognition/webkitSpeechRecognition
// and renamed variable to avoid conflict with potential global SpeechRecognition type.
const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

interface SpeechRecognitionHook {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
  isSupported: boolean;
}

export const useSpeechRecognition = (): SpeechRecognitionHook => {
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // FIX: Use the defined CustomSpeechRecognitionInstance interface for the state.
  const [recognitionInstance, setRecognitionInstance] = useState<CustomSpeechRecognitionInstance | null>(null);
  // FIX: Use the SpeechRecognitionAPI variable for the support check.
  const isSupported = !!SpeechRecognitionAPI;

  useEffect(() => {
    if (!isSupported) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    // FIX: Ensure 'recognition' is typed with CustomSpeechRecognitionInstance.
    // SpeechRecognitionAPI is the constructor obtained from window.
    const recognition: CustomSpeechRecognitionInstance = new SpeechRecognitionAPI();
    recognition.continuous = true; // MODIFIED: Enable continuous listening
    recognition.interimResults = true; // Get interim results for live feedback
    recognition.lang = 'vi-VN'; // MODIFIED: Set language to Vietnamese

    // FIX: Use CustomSpeechRecognitionEvent for the event type.
    recognition.onresult = (event: CustomSpeechRecognitionEvent) => {
      let finalTranscriptSegment = '';
      let currentInterim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscriptSegment += event.results[i][0].transcript.trim();
        } else {
          currentInterim += event.results[i][0].transcript;
        }
      }
      setInterimTranscript(currentInterim);
      // MODIFIED: Set transcript to the latest final segment.
      // App.tsx will need to handle this change.
      if (finalTranscriptSegment) {
        setTranscript(finalTranscriptSegment);
      }
    };

    // FIX: Use CustomSpeechRecognitionErrorEvent for the event type.
    recognition.onerror = (event: CustomSpeechRecognitionErrorEvent) => {
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript(''); // Clear interim when listening stops
    };
    
    setRecognitionInstance(recognition);

    return () => {
      recognition.stop();
    };
  }, [isSupported]);

  const startListening = useCallback(() => {
    if (recognitionInstance && !isListening) {
      setTranscript(''); // Clear previous full transcript
      setInterimTranscript(''); // Clear previous interim transcript
      setError(null);
      try {
        recognitionInstance.start();
        setIsListening(true);
      } catch (e) {
        setError(`Could not start recognition: ${e instanceof Error ? e.message : String(e)}`);
        setIsListening(false);
      }
    }
  }, [recognitionInstance, isListening]);

  const stopListening = useCallback(() => {
    if (recognitionInstance && isListening) {
      recognitionInstance.stop();
      setIsListening(false);
    }
  }, [recognitionInstance, isListening]);

  return { transcript, interimTranscript, isListening, startListening, stopListening, error, isSupported };
};
