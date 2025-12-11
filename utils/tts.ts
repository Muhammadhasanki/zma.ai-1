
export const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US'; // Set language
        window.speechSynthesis.cancel(); // Stop any current speech
        window.speechSynthesis.speak(utterance);
    } else {
        console.warn('Text-to-speech not supported in this browser.');
    }
};
