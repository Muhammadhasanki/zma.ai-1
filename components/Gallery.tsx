
import React, { useState, useRef } from 'react';
import { GeneratedImage } from '../types';
import { GoogleGenAI, Modality } from '@google/genai';
import { SparklesIcon, XMarkIcon, PaperAirplaneIcon, RetouchIcon, FilterIcon, RealismIcon, LogoIcon, SpeakerWaveIcon } from './icons';
import { speakText } from '../utils/tts';

interface GalleryProps {
    images: GeneratedImage[];
    addImageToGallery: (image: GeneratedImage) => void;
    setGalleryImages: React.Dispatch<React.SetStateAction<GeneratedImage[]>>;
}

const ImageComparator: React.FC<{ before: string; after: string }> = ({ before, after }) => {
    const [sliderPos, setSliderPos] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    const handleMove = (clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const percent = (x / rect.width) * 100;
        setSliderPos(percent);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
        if (isDragging.current) {
            handleMove(moveEvent.clientX);
        }
    };

    const onMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    
    return (
        <div ref={containerRef} className="relative w-full h-full overflow-hidden rounded-2xl select-none group checkerboard-bg" style={{ cursor: isDragging.current ? 'grabbing' : 'ew-resize' }} onMouseDown={handleMouseDown}>
            <img src={after} alt="After" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
            <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
                <img src={before} alt="Before" className="absolute inset-0 w-full h-full object-contain" />
            </div>
            <div className="absolute top-0 bottom-0 bg-white/70 w-1 cursor-ew-resize backdrop-blur-sm" style={{ left: `calc(${sliderPos}% - 2px)` }} >
                <div className="bg-white/80 backdrop-blur-sm rounded-full h-10 w-10 absolute top-1/2 -translate-y-1/2 -left-1/2 -translate-x-1/2 flex items-center justify-center shadow-md border border-white/20">
                    <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h8m-4-4v8" transform="rotate(90 12 12)" /></svg>
                </div>
            </div>
        </div>
    );
};


const ImageDetailModal: React.FC<{
    image: GeneratedImage;
    onClose: () => void;
    addImageToGallery: (image: GeneratedImage) => void;
}> = ({ image, onClose, addImageToGallery }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [currentImage, setCurrentImage] = useState(image);
    const [error, setError] = useState('');
    const [editText, setEditText] = useState('');
    const [retouchIntensity, setRetouchIntensity] = useState(50);

    const filters = [
        { name: 'Vintage', prompt: 'Apply a warm, faded, vintage film look to this image, with slightly desaturated colors and soft grain.' },
        { name: 'Noir', prompt: 'Convert this image to a high-contrast black and white "noir" style, with deep shadows and dramatic lighting.' },
        { name: 'Cinematic', prompt: 'Give this image a cinematic look, with teal and orange color grading and dramatic tones.' },
        { name: 'Neon Punk', prompt: 'Transform this image with a vibrant, neon punk aesthetic. Add glowing neon highlights, cool blue and magenta tones, and a futuristic, cyberpunk feel.' },
    ];

    const applyAIEdit = async (prompt: string, type: GeneratedImage['type'], originalImage: GeneratedImage) => {
        setIsLoading(true);
        setError('');
        try {
            // Removed baseUrl as it is not a valid option for GoogleGenAI constructor
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        { inlineData: { data: originalImage.base64, mimeType: originalImage.mimeType } },
                        { text: prompt }
                    ]
                },
                config: { responseModalities: [Modality.IMAGE] }
            });

            // Fix: Safely access response structure using optional chaining
            const newPart = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            
            if (newPart && newPart.inlineData) {
                const newImage: GeneratedImage = {
                    id: new Date().toISOString(),
                    src: `data:${newPart.inlineData.mimeType};base64,${newPart.inlineData.data}`,
                    originalSrc: originalImage.src,
                    base64: newPart.inlineData.data,
                    mimeType: newPart.inlineData.mimeType,
                    prompt: prompt,
                    type: type,
                    createdAt: new Date().toLocaleString(),
                };
                addImageToGallery(newImage);
                setCurrentImage(newImage);
                return newImage;
            } else {
                throw new Error("AI did not return an image.");
            }
        } catch (err: any) {
            console.error(err);
            let errorMessage = `Failed to apply edit. Please try again.`;
            if (err.message && err.message.includes('RESOURCE_EXHAUSTED')) {
                errorMessage = "You've exceeded your current API quota. Please check your plan and billing details to continue.";
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTextEdit = async () => {
        if (!editText.trim()) return;
        await applyAIEdit(editText, 'edit', currentImage);
        setEditText('');
    };
    
    const handleRetouch = async () => {
        const prompt = `Retouch the skin on the person in this image. Smooth the texture and reduce blemishes with an intensity of ${retouchIntensity} out of 100. IMPORTANT: Maintain a natural and realistic look, preserving essential skin details. Do not make it look artificial or "plastic".`;
        await applyAIEdit(prompt, 'retouch', currentImage);
    }

    const handleSkinTexture = async () => {
        const prompt = `Apply a highly realistic and detailed skin texture to the person in this image. Add subtle imperfections like pores, fine lines, and natural variations in tone to enhance photorealism. Ensure the result looks natural and not overly processed.`;
        await applyAIEdit(prompt, 'edit', currentImage);
    }

    const handleSpeakImageDetails = () => {
        const details = `Prompt: "${currentImage.prompt}". Type: ${currentImage.type}. Created on: ${currentImage.createdAt}.`;
        speakText(details);
    };
    
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="glass-card rounded-3xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col md:flex-row overflow-hidden animate-slide-in-up" onClick={(e) => e.stopPropagation()}>
                <div className="w-full md:w-2/3 bg-[var(--bg-primary)] flex items-center justify-center p-4 relative checkerboard-bg">
                    {isLoading && (
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10">
                            <LogoIcon className="h-16 w-16 animate-pulse" />
                            <p className="mt-4 text-white">Applying AI magic...</p>
                        </div>
                    )}
                    {currentImage.originalSrc ?
                        <ImageComparator before={currentImage.originalSrc} after={currentImage.src} /> :
                        <img src={currentImage.src} alt={currentImage.prompt} className="max-h-full max-w-full object-contain rounded-2xl" />
                    }
                </div>
                <div className="w-full md:w-1/3 p-6 flex flex-col overflow-y-auto">
                    <div className="flex-1 space-y-6">
                         <div>
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-xl font-bold text-white bg-clip-text text-transparent bg-[var(--gradient-text)]">Image Details</h3>
                                <button onClick={handleSpeakImageDetails} className="p-1.5 rounded-full hover:bg-[var(--border-primary)] text-gray-400" aria-label="Speak image details">
                                    <SpeakerWaveIcon className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-sm text-[var(--text-secondary)] mt-2"><strong>Prompt:</strong> {currentImage.prompt}</p>
                            <p className="text-sm text-[var(--text-secondary)]"><strong>Type:</strong> <span className="capitalize">{currentImage.type}</span></p>
                            <p className="text-sm text-[var(--text-secondary)]"><strong>Created:</strong> {currentImage.createdAt}</p>
                        </div>
                        <div className="border-t border-[var(--border-primary)] pt-6 space-y-4">
                            <h3 className="text-xl font-bold text-white">AI Editing Tools</h3>
                             <div>
                                <label htmlFor="prompt-edit" className="font-semibold text-[var(--text-secondary)] mb-2 block">Edit with a Prompt</label>
                                <div className="relative">
                                    <input id="prompt-edit" type="text" value={editText} onChange={(e) => setEditText(e.target.value)} placeholder="e.g., Add a retro filter" className="w-full input-glow rounded-full py-2 px-4 text-sm text-white pr-12" disabled={isLoading} onKeyDown={(e) => { if (e.key === 'Enter') handleTextEdit(); }} />
                                    <button onClick={handleTextEdit} disabled={isLoading || !editText.trim()} className="absolute top-1/2 right-1.5 -translate-y-1/2 p-1.5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110 transition-transform" aria-label="Apply edit"><PaperAirplaneIcon className="h-5 w-5 text-white"/></button>
                                </div>
                            </div>
                             <div>
                                <h4 className="font-semibold text-[var(--text-secondary)] mb-2 mt-4 flex items-center gap-2"><FilterIcon className="w-5 h-5" /> AI Filters</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {filters.map(filter => (
                                        <button 
                                            key={filter.name}
                                            onClick={() => applyAIEdit(filter.prompt, 'filter', currentImage)}
                                            disabled={isLoading}
                                            className="text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] rounded-full p-2.5 transition-colors disabled:opacity-50"
                                        >
                                            {filter.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-[var(--border-primary)] pt-6 space-y-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><RealismIcon className="w-6 h-6" />AI Photorealism Engine</h3>
                            <div>
                                <h4 className="font-semibold text-[var(--text-secondary)] mb-2">AI Retouching</h4>
                                <div className="space-y-3">
                                    <label htmlFor="intensity" className="text-sm">Intensity: {retouchIntensity}</label>
                                    <input id="intensity" type="range" min="1" max="100" value={retouchIntensity} onChange={(e) => setRetouchIntensity(Number(e.target.value))} className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-cyan-400" />
                                    <button onClick={handleRetouch} disabled={isLoading} className="w-full text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] rounded-full p-2.5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                        <RetouchIcon className="w-4 h-4" />
                                        Smooth Skin & Retouch
                                    </button>
                                </div>
                            </div>
                            <div>
                                <h4 className="font-semibold text-[var(--text-secondary)] mb-2 mt-4">Skin Texture</h4>
                                 <button onClick={handleSkinTexture} disabled={isLoading} className="w-full text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] rounded-full p-2.5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                    <SparklesIcon className="w-4 h-4" />
                                    Add Realistic Skin Texture
                                </button>
                            </div>
                        </div>
                         {error && <p className="text-[var(--danger-primary)] text-sm mt-2">{error}</p>}
                    </div>
                    <div className="mt-6 pt-6 border-t border-[var(--border-primary)] flex items-center gap-4">
                        <a href={currentImage.src} download={`zma-ai-${currentImage.id}.png`} className="btn-3d flex-1 text-center">
                           Download
                        </a>
                        <button onClick={onClose} className="flex-1 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] text-white font-bold py-2.5 px-4 rounded-full transition-colors">Close</button>
                    </div>
                </div>
            </div>
             <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-50" aria-label="Close modal">
                <XMarkIcon className="h-8 w-8" />
            </button>
        </div>
    );
};

export const Gallery: React.FC<GalleryProps> = ({ images, addImageToGallery, setGalleryImages }) => {
    const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);

    const handleDelete = (e: React.MouseEvent, imageId: string) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to permanently delete this image?")) {
            setGalleryImages(prev => prev.filter(img => img.id !== imageId));
        }
    };

    return (
        <>
            <div className="space-y-8">
                <div className="text-center animate-slide-in-up">
                    <h1 className="text-4xl lg:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-[var(--gradient-text)]">Image Gallery</h1>
                    <p className="text-lg text-[var(--text-secondary)] mt-2">A collection of your AI-powered creations. Click an image to view and edit.</p>
                </div>

                {images.length === 0 ? (
                    <div className="text-center py-16 glass-card rounded-3xl animate-slide-in-up stagger-1">
                        <p className="text-[var(--text-secondary)]">Your gallery is empty.</p>
                        <p className="text-gray-500 text-sm mt-2">Create images in the Image Studio or Branding Kit to see them here.</p>
                    </div>
                ) : (
                    <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
                        {images.map((image, index) => (
                            <div 
                                key={image.id} 
                                className="break-inside-avoid group relative overflow-hidden rounded-2xl shadow-lg cursor-pointer animate-slide-in-up transition-transform duration-300 hover:!opacity-100 
                                             hover:[transform:perspective(1000px)_rotateX(2deg)_rotateY(-2deg)_scale(1.05)]"
                                style={{ animationDelay: `${index * 50}ms` }}
                                onClick={() => setSelectedImage(image)}
                            >
                                <img src={image.src} alt={image.prompt} className="w-full h-auto object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-end">
                                    <p className="text-white font-semibold text-sm line-clamp-3">{image.prompt}</p>
                                    <p className="text-xs text-gray-400 mt-1 capitalize">{image.type} - {image.createdAt}</p>
                                </div>
                                 <button onClick={(e) => handleDelete(e, image.id)} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white/80 hover:bg-red-600 hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-all" aria-label="Delete image">
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedImage && (
                <ImageDetailModal 
                    image={selectedImage} 
                    onClose={() => setSelectedImage(null)}
                    addImageToGallery={addImageToGallery}
                />
            )}
        </>
    );
};
