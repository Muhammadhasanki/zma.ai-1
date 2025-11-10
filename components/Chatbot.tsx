import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse } from '@google/genai';
import { ChatMessage, View } from '../types';
import { ChatBubbleIcon, XMarkIcon, PaperAirplaneIcon, SparklesIcon } from './icons';

const systemInstructions: Record<View, string> = {
    studio: 'You are zma.ai\'s helpful assistant. You are an expert in branding, design, and AI image generation. Be friendly, concise, and helpful. The user is currently in the Image Studio. Proactively suggest creative prompts, editing ideas, or different AI tools they could try. For example, "Have you tried creating a photorealistic portrait of an astronaut riding a unicorn?" or "You could use the Style Transfer tool to apply a Van Gogh style to your photo!"',
    branding: 'You are zma.ai\'s helpful assistant. You are an expert in branding, design, and AI image generation. Be friendly, concise, and helpful. The user is in the Branding Kit section. Proactively suggest ideas for brand names, mission statements, or color palettes. Ask them about their business to help them brainstorm. For example, "Tell me about your business, and I can help you come up with a powerful mission statement."',
    gallery: 'You are zma.ai\'s helpful assistant. You are an expert in branding, design, and AI image generation. Be friendly, concise, and helpful. The user is in their Gallery. Proactively suggest ways to edit their existing creations, like applying filters or using the retouching tools. For example, "I see you have a portrait image. Would you like to try our AI Retouching tool to enhance it?"'
};

const welcomeMessages: Record<View, string> = {
    studio: 'Hello! Ready to create some amazing images in the Studio? What masterpiece are you thinking of today?',
    branding: 'Welcome to the Branding Kit! Need help crafting a brand identity? I can assist with mission statements, logos, and more.',
    gallery: 'Welcome to your Gallery! See any image you\'d like to edit further? I can help you apply filters, retouch photos, and more.'
};

export const Chatbot = ({ currentView }: { currentView: View }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatRef = useRef<Chat | null>(null);
    const lastViewRef = useRef<View | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            // If view has changed, or chat is not initialized
            if (currentView !== lastViewRef.current || !chatRef.current) {
                try {
                    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                    chatRef.current = ai.chats.create({
                        model: 'gemini-2.5-flash',
                        config: {
                            systemInstruction: systemInstructions[currentView],
                        },
                    });
                    setMessages([{ role: 'model', text: welcomeMessages[currentView] }]);
                    lastViewRef.current = currentView;
                } catch (error) {
                    console.error("Failed to initialize Gemini Chat:", error);
                    setMessages([{ role: 'model', text: 'Sorry, I am unable to connect right now.' }]);
                }
            }
        }
    }, [isOpen, currentView]);


    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || !chatRef.current) return;

        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const responseStream = await chatRef.current.sendMessageStream({ message: input });
            let modelResponse = '';
            setMessages(prev => [...prev, { role: 'model', text: '' }]);

            for await (const chunk of responseStream) {
                modelResponse += chunk.text;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = { role: 'model', text: modelResponse };
                    return newMessages;
                });
            }
        } catch (error: any) {
            console.error('Gemini chat error:', error);
            let errorMessage = 'Oops! Something went wrong.';
            if (error.message && error.message.includes('RESOURCE_EXHAUSTED')) {
                errorMessage = "It looks like you've exceeded your current API quota. Please check your plan and billing details to continue chatting.";
            }
            setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 btn-3d p-4 shadow-lg z-50"
                aria-label="Toggle Chatbot"
            >
                <div className="relative h-8 w-8">
                    <XMarkIcon className={`absolute top-0 left-0 h-8 w-8 transition-all duration-300 ${isOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`} />
                    <ChatBubbleIcon className={`absolute top-0 left-0 h-8 w-8 transition-all duration-300 ${!isOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}`} />
                </div>
            </button>

            <div className={`fixed bottom-24 right-6 w-[90vw] max-w-md h-[70vh] max-h-[600px] glass-card rounded-3xl flex flex-col z-40 transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                <div className="p-4 border-b border-[var(--border-primary)] flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">zma.ai Assistant</h3>
                    <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                       <XMarkIcon className="h-6 w-6"/>
                    </button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 animate-slide-in-up ${msg.role === 'user' ? 'justify-end' : ''}`} style={{animationDelay: '50ms'}}>
                            {msg.role === 'model' && <div className="bg-[var(--bg-tertiary)] rounded-full h-8 w-8 flex-shrink-0 flex items-center justify-center"><SparklesIcon className="h-5 w-5 text-white"/></div>}
                            <div className={`px-4 py-2 rounded-2xl max-w-xs md:max-w-sm ${msg.role === 'user' ? 'bg-gradient-to-br from-cyan-500 to-purple-600 text-white rounded-br-none' : 'bg-[var(--bg-primary)] text-gray-200 rounded-bl-none'}`}>
                                <p className="text-sm break-words">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                         <div className="flex items-start gap-3">
                            <div className="bg-[var(--bg-tertiary)] rounded-full h-8 w-8 flex-shrink-0 flex items-center justify-center animate-pulse"><SparklesIcon className="h-5 w-5 text-white"/></div>
                            <div className="px-4 py-3 rounded-2xl bg-[var(--bg-primary)]">
                                <div className="flex items-center space-x-1">
                                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="p-4 border-t border-[var(--border-primary)]">
                    <div className="relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask me anything..."
                            className="w-full input-glow rounded-full py-3 pl-4 pr-12 text-white"
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading || !input.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110 transition-transform">
                            <PaperAirplaneIcon className="h-5 w-5 text-white"/>
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};