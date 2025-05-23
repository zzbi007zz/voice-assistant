
import React, { useState, useEffect, useCallback } from 'react';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { getAssistantResponse } from './services/geminiService';
import { RecordingState, AssistantApiResponse, GroundingChunk } from './types';
import { LoadingSpinner } from './components/LoadingSpinner';
import { SearchReferencesCard } from './components/SearchReferencesCard';

// Microphone Icon SVG
const MicrophoneIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}>
    <path d="M12 18.75a6 6 0 0 0 6-6v-1.5a6 6 0 0 0-12 0v1.5a6 6 0 0 0 6 6Z" />
    <path d="M12 22.5A2.25 2.25 0 0 0 14.25 20.25v-8.515A2.252 2.252 0 0 0 13.5 9.75h-3A2.252 2.252 0 0 0 9 11.735V20.25A2.25 2.25 0 0 0 12 22.5Z" />
    <path d="M8.625 11.25a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0V9.75c0-1.81 1.628-3.249 3.837-3.249A3.732 3.732 0 0 1 16.125 9.75v1.5a.375.375 0 1 1-.75 0V9.75a3 3 0 0 0-3-3h-.75a3 3 0 0 0-3 3v1.5Z" />
  </svg>
);

const App: React.FC = () => {
  const [apiKeyExists, setApiKeyExists] = useState<boolean>(false);
  const [recordingState, setRecordingState] = useState<RecordingState>(RecordingState.Idle);
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [assistantOutput, setAssistantOutput] = useState<AssistantApiResponse | null>(null);
  const [appError, setAppError] = useState<string | null>(null);

  const {
    transcript: speechTranscript,
    interimTranscript,
    isListening,
    startListening,
    stopListening,
    error: speechError,
    isSupported: speechRecognitionSupported,
  } = useSpeechRecognition();

  const {
    speak,
    cancel: cancelSpeech,
    isSpeaking,
    isSupported: speechSynthesisSupported,
    error: ttsError,
  } = useSpeechSynthesis();

  useEffect(() => {
    // Check for API key on mount (simulated, as process.env is build-time)
    // In a real scenario, this would be checked when the geminiService tries to initialize.
    // The service itself handles the null 'ai' instance if API_KEY is missing.
    if (process.env.API_KEY) {
      setApiKeyExists(true);
    } else {
      setAppError("Gemini API Key (API_KEY) is not set in the environment. Please configure it to use the AI features.");
    }
  }, []);

  useEffect(() => {
    // MODIFIED: Process transcript as it comes in, as long as it's not empty
    // and we are in a state that expects user input (i.e., Recording or Idle after a response).
    // We also check if the current speechTranscript is different from the last processed userTranscript
    // to avoid reprocessing the same utterance if the component re-renders.
    if (speechTranscript && speechTranscript !== userTranscript && (recordingState === RecordingState.Recording || recordingState === RecordingState.Idle)) {
      setUserTranscript(speechTranscript);
      handleProcessRequest(speechTranscript);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechTranscript, userTranscript, recordingState]); // Added userTranscript to dependencies

  useEffect(() => {
    if (speechError) setAppError(`Speech recognition error: ${speechError}`);
    if (ttsError) setAppError(`Text-to-speech error: ${ttsError}`);
  }, [speechError, ttsError]);

  const handleToggleRecording = () => {
    setAppError(null); // Clear previous errors
    setAssistantOutput(null); // Clear previous assistant output
    setUserTranscript(''); // Clear previous user transcript

    if (isListening) {
      stopListening();
      // setRecordingState(RecordingState.Idle); // Let onend handle this if needed
    } else {
      if (!speechRecognitionSupported) {
        setAppError("Speech recognition is not supported by your browser.");
        return;
      }
      if (!apiKeyExists) {
         setAppError("Gemini API Key (API_KEY) is not set. AI features are disabled.");
         return;
      }
      // When starting, clear previous assistant output for a fresh interaction
      setAssistantOutput(null);
      startListening();
      setRecordingState(RecordingState.Recording);
    }
  };
  
  const handleProcessRequest = useCallback(async (query: string) => {
    if (!query.trim()) {
      // If query is empty, don't switch to processing, just stay in current listening state
      // or idle if listening stopped for other reasons.
      // setRecordingState(RecordingState.Idle); 
      return;
    }
    setRecordingState(RecordingState.Processing);
    setAppError(null);
    const response = await getAssistantResponse(query);
    setAssistantOutput(response);
    // After processing, go back to a state that can accept new speech.
    // If still listening (continuous mode), it will pick up next utterance.
    // If not listening (e.g., error or manual stop), it will be Idle.
    setRecordingState(isListening ? RecordingState.Recording : RecordingState.Idle); 
    if (response.text && speechSynthesisSupported) {
      speak(response.text);
    } else if (response.text && !speechSynthesisSupported) {
      setAppError("Text-to-speech is not supported, but here's the response:");
    }
  }, [speak, speechSynthesisSupported, apiKeyExists, isListening]); // Added isListening


  const getButtonTextAndStyle = (): { text: string; style: string; icon?: React.ReactNode } => {
    const baseStyle = "px-6 py-3 text-lg font-semibold rounded-full shadow-lg transition-all duration-150 ease-in-out flex items-center justify-center space-x-2 focus:outline-none focus:ring-4";
    const icon = <MicrophoneIcon className="w-6 h-6" />;
    
    if (recordingState === RecordingState.Processing) {
      return { text: "Processing...", style: `${baseStyle} bg-yellow-500 text-slate-900 cursor-not-allowed`, icon: <LoadingSpinner size="w-6 h-6" color="text-slate-900"/> };
    }
    if (isListening) {
      return { text: "Listening...", style: `${baseStyle} bg-red-500 hover:bg-red-600 text-white animate-pulse focus:ring-red-300`, icon };
    }
    return { text: "Ask AI Assistant", style: `${baseStyle} bg-sky-500 hover:bg-sky-600 text-white focus:ring-sky-300`, icon };
  };

  const { text: buttonText, style: buttonStyle, icon: buttonIcon } = getButtonTextAndStyle();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-8 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 text-slate-100">
      <header className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-sky-400">Voice AI Assistant</h1>
        <p className="text-slate-400 mt-2">Speak your requests and get AI-powered answers.</p>
      </header>

      {!apiKeyExists && recordingState !== RecordingState.Processing && (
         <div className="my-4 p-4 bg-red-800 border border-red-600 text-red-100 rounded-md shadow-lg max-w-xl w-full text-center">
            <p className="font-semibold">Configuration Error:</p>
            <p>{appError || "Gemini API Key (API_KEY) is not set. AI features are disabled."}</p>
        </div>
      )}


      <div className="w-full max-w-2xl space-y-6">
        <div className="flex justify-center">
          <button
            onClick={handleToggleRecording}
            disabled={recordingState === RecordingState.Processing || !apiKeyExists}
            className={`${buttonStyle} disabled:opacity-70 disabled:cursor-not-allowed`}
          >
            {buttonIcon}
            <span>{buttonText}</span>
          </button>
        </div>

        {appError && recordingState !== RecordingState.Processing && (
          <div className="my-4 p-3 bg-red-200 border border-red-400 text-red-800 rounded-md shadow text-sm text-center">
            {appError}
          </div>
        )}
        
        {(userTranscript || interimTranscript) && (
          <div className="p-4 bg-slate-800 rounded-lg shadow">
            <h2 className="text-sm font-semibold text-sky-400 mb-1">You said:</h2>
            <p className="text-slate-300 italic">
              {userTranscript || interimTranscript}
              {isListening && !interimTranscript && <span className="opacity-50"> listening...</span>}
            </p>
          </div>
        )}

        {recordingState === RecordingState.Processing && !assistantOutput && (
          <div className="flex justify-center items-center p-6 bg-slate-800 rounded-lg shadow">
            <LoadingSpinner size="w-12 h-12" />
            <p className="ml-4 text-lg text-slate-300">Assistant is thinking...</p>
          </div>
        )}

        {assistantOutput && (
          <div className="p-6 bg-slate-800 rounded-lg shadow-xl animate-fadeIn">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-semibold text-sky-400">Assistant says:</h2>
                {assistantOutput.text && speechSynthesisSupported && (
                    <button
                        onClick={() => isSpeaking ? cancelSpeech() : speak(assistantOutput.text)}
                        className="p-2 rounded-full hover:bg-slate-700 transition-colors"
                        title={isSpeaking ? "Stop speaking" : "Speak again"}
                    >
                        {isSpeaking ? (
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-red-400">
                                <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-sky-400">
                                <path d="M8.25 4.5a3.75 3.75 0 0 0-3.75 3.75v6a3.75 3.75 0 0 0 3.75 3.75h7.5a3.75 3.75 0 0 0 3.75-3.75v-6A3.75 3.75 0 0 0 15.75 4.5h-7.5ZM12 12.75a.75.75 0 0 0 .75-.75V9a.75.75 0 0 0-1.5 0v3a.75.75 0 0 0 .75.75Z" />
                                <path d="M3.003 10.555A10.439 10.439 0 0 0 2.25 12c0 5.085 3.914 9.298 8.807 9.712.523.027 1.05.027 1.572 0A9.787 9.787 0 0 0 21.75 12c0-1.44-.324-2.803-.903-4.041a.75.75 0 1 0-1.296.759A8.22 8.22 0 0 1 20.25 12c0 4.53-3.693 8.25-8.25 8.25S3.75 16.53 3.75 12a8.252 8.252 0 0 1 .68-3.445.75.75 0 0 0-1.426-.7Z" />
                            </svg>
                        )}
                    </button>
                )}
            </div>
            <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{assistantOutput.text}</p>
            {assistantOutput.references && assistantOutput.references.length > 0 && (
              <SearchReferencesCard references={assistantOutput.references} />
            )}
          </div>
        )}
      </div>
      <footer className="mt-12 text-center text-xs text-slate-500">
        <p>Powered by Gemini AI & Web Speech API.</p>
        {!speechRecognitionSupported && <p className="text-yellow-500">Warning: Speech recognition not supported by your browser.</p>}
        {!speechSynthesisSupported && <p className="text-yellow-500">Warning: Text-to-speech not supported by your browser.</p>}
      </footer>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default App;
