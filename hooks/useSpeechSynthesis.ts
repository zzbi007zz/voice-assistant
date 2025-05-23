
import { useState, useCallback, useEffect } from 'react';

interface SpeechSynthesisHook {
  speak: (text: string) => void;
  cancel: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  error: string | null;
}

export const useSpeechSynthesis = (): SpeechSynthesisHook => {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const isSupported = 'speechSynthesis' in window;

  useEffect(() => {
    if (isSupported) {
      const loadVoices = () => {
        setVoices(window.speechSynthesis.getVoices());
      };
      // Voices list might be loaded asynchronously
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      } else {
        loadVoices();
      }
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, [isSupported]);

  const speak = useCallback((text: string) => {
    if (!isSupported) {
      setError("Speech synthesis is not supported in this browser.");
      return;
    }
    if (!text.trim()) return;

    // Cancel any ongoing speech before starting new
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN'; // MODIFIED: Set language to Vietnamese

    // Attempt to find the specific "Zephyr" voice (assuming it's female and Vietnamese)
    const zephyrVoice = voices.find(
      voice => voice.name.toLowerCase().includes('zephyr') && voice.lang.toLowerCase().startsWith('vi')
    );
    // Fallback to any Vietnamese female voice
    const vietnameseFemaleVoice = voices.find(
      voice => voice.lang.toLowerCase().startsWith('vi') && voice.name.toLowerCase().includes('female') && voice !== zephyrVoice
    );
    // Fallback to any Vietnamese voice
    const vietnameseVoice = voices.find(
        voice => voice.lang.toLowerCase().startsWith('vi') && voice !== zephyrVoice && voice !== vietnameseFemaleVoice
    );

    if (zephyrVoice) {
      utterance.voice = zephyrVoice;
    } else if (vietnameseFemaleVoice) {
      utterance.voice = vietnameseFemaleVoice;
    } else if (vietnameseVoice) {
      utterance.voice = vietnameseVoice;
    }
    // If no specific voice is found, it will use the browser's default for 'vi-VN' or a fallback.
    
    utterance.onstart = () => {
      setIsSpeaking(true);
      setError(null);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
    };
    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      setError(`Speech synthesis error: ${event.error}`);
      setIsSpeaking(false);
    };
    
    window.speechSynthesis.speak(utterance);
  }, [isSupported]);

  const cancel = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return { speak, cancel, isSpeaking, isSupported, error };
};
