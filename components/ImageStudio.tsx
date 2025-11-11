import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { GeneratedImage } from '../types';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { LogoIcon, MicIcon, WandIcon, SwapIcon, RestoreIcon, TextScanIcon, AnalyzeIcon, HistoryIcon, VariationsIcon, ChevronRightIcon, ChevronLeftIcon, RealismIcon, DownloadIcon, TrashIcon, SaveIcon, UpscaleIcon, BrushIcon, AdjustmentsIcon, XMarkIcon, ScissorsIcon, EyeDropperIcon, SparklesIcon, RetouchIcon, FilterIcon } from './icons';
import ZoomableImage from './ZoomableImage';

interface ImageStudioProps {
    addImageToGallery: (image: GeneratedImage) => void;
    galleryImages: GeneratedImage[];
}

type Mode = 'generate' | 'edit' | 'face-swap' | 'restore' | 'extract-text' | 'analyze' | 'inpaint' | 'adjust' | 'background-removal' | 'replicate' | 'upscale' | 'converter' | 'passport-photo' | 'retouch';

interface UploadedFile {
    file: File;
    url: string;
    base64: string;
    mimeType: string;
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

const ImageUploader: React.FC<{
    onFilesUploaded: (files: UploadedFile[]) => void;
    title: string;
    imageUrl: string | null;
    multiple?: boolean;
}> = ({ onFilesUploaded, title, imageUrl, multiple = false }) => {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const processFiles = useCallback(async (files: FileList | File[]) => {
        if (!files || files.length === 0) return;
        const fileArray = Array.from(files);
        const imageFiles = fileArray.filter(file => file.type.startsWith('image/'));

        if(imageFiles.length === 0) return;

        const filePromises = imageFiles.map(async (file: File) => {
            const url = URL.createObjectURL(file);
            const base64 = await fileToBase64(file);
            return { file, url, base64, mimeType: file.type };
        });
        const newImages = (await Promise.all(filePromises)).filter(Boolean) as UploadedFile[];
        if(newImages.length > 0) {
          onFilesUploaded(newImages);
        }
    }, [onFilesUploaded]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) processFiles(e.target.files);
        e.target.value = ''; // Reset input
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
    };
    
    const handleDragEvents = (e: React.DragEvent<HTMLDivElement>, isEntering: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(isEntering);
    };

    const handlePaste = useCallback(async (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        const files: File[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if(blob) files.push(blob);
            }
        }
        if(files.length > 0) {
            await processFiles(files);
        }
    }, [processFiles]);
    
    useEffect(() => {
        const dropZone = document.getElementById(`uploader-${title.replace(/\s+/g, '-')}`);
        if(!dropZone) return;

        dropZone.addEventListener('paste', handlePaste);
        return () => dropZone.removeEventListener('paste', handlePaste);
    }, [handlePaste, title]);

    return (
        <div
            id={`uploader-${title.replace(/\s+/g, '-')}`}
            onDrop={handleDrop}
            onDragOver={(e) => handleDragEvents(e, true)}
            onDragEnter={(e) => handleDragEvents(e, true)}
            onDragLeave={(e) => handleDragEvents(e, false)}
            className={`bg-[var(--bg-primary)] p-4 rounded-2xl text-center border-2 border-dashed  transition-all duration-300 relative overflow-hidden ${isDragging ? 'border-[var(--accent-primary)] scale-105 shadow-[0_0_20px_var(--accent-glow)]' : 'border-[var(--border-primary)]'}`}
        >
            <div className={`absolute inset-0 transition-opacity duration-300 bg-gradient-radial from-[var(--accent-glow)] to-transparent ${isDragging ? 'opacity-100' : 'opacity-0'}`} />
            <div className="relative z-10">
                <h3 className="text-lg font-semibold mb-2 text-[var(--text-secondary)]">{title}</h3>
                <div onClick={() => inputRef.current?.click()} className="cursor-pointer group">
                    {imageUrl ? (
                        <img src={imageUrl} alt={title} className="w-full h-48 object-contain rounded-xl mb-2" />
                    ) : (
                        <div className="h-48 flex flex-col items-center justify-center bg-[var(--bg-tertiary)]/50 rounded-xl mb-2 p-2">
                            <p className="text-gray-400 font-semibold">Drag & Drop or Paste Image</p>
                            <p className="text-gray-500 text-sm">or click to browse files</p>
                        </div>
                    )}
                    <input type="file" ref={inputRef} accept="image/*" onChange={handleFileChange} className="hidden" multiple={multiple} />
                    <span className="cursor-pointer bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] text-white font-bold py-2 px-4 rounded-full transition-colors w-full inline-block">
                        {multiple ? 'Upload Images' : 'Upload Image'}
                    </span>
                </div>
            </div>
        </div>
    );
};


const MaskCanvas: React.FC<{
    baseImage: string;
    onMaskChange: (maskBase64: string) => void;
    brushSize?: number;
    enabled?: boolean;
}> = ({ baseImage, onMaskChange, brushSize = 20, enabled = true }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDrawing = useRef(false);
    // Fix: Rename the useState setter to avoid conflict with React.useState
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

    const getCoords = (e: React.MouseEvent | React.TouchEvent): { x: number, y: number } | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        
        let clientX, clientY;
        if ('touches' in e.nativeEvent) {
            clientX = e.nativeEvent.touches[0].clientX;
            clientY = e.nativeEvent.touches[0].clientY;
        } else {
            clientX = (e.nativeEvent as MouseEvent).clientX;
            clientY = (e.nativeEvent as MouseEvent).clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    };

    const draw = (x: number, y: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (!enabled) return;
        const coords = getCoords(e);
        if (coords) {
            isDrawing.current = true;
            draw(coords.x, coords.y);
        }
    };
    
    const stopDrawing = () => {
        if (!isDrawing.current) return;
        isDrawing.current = false;
        
        const canvas = canvasRef.current;
        if (canvas) {
            const base64 = canvas.toDataURL('image/png').split(',')[1];
            onMaskChange(base64);
        }
    };

    const handleDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing.current || !enabled) return;
        const coords = getCoords(e);
        if (coords) {
            draw(coords.x, coords.y);
        }
    };

    useEffect(() => {
        const img = new Image();
        img.src = baseImage;
        img.onload = () => {
            const container = containerRef.current;
            if (!container) return;
            
            const containerWidth = container.clientWidth;
            const aspectRatio = img.width / img.height;
            const width = containerWidth;
            const height = containerWidth / aspectRatio;
            
            setImageSize({ width, height }); // Use the correct setter
            
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = 'black';
                    ctx.fillRect(0, 0, width, height);
                }
            }
        };
    }, [baseImage]);

    return (
        <div ref={containerRef} className="relative w-full rounded-2xl overflow-hidden bg-[var(--bg-tertiary)]" style={{ height: imageSize.height > 0 ? `${imageSize.height}px` : 'auto' }}>
            <img src={baseImage} alt="Base for mask" className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" />
            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full cursor-crosshair opacity-50"
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onMouseMove={handleDrawing}
                onTouchStart={startDrawing}
                onTouchEnd={stopDrawing}
                onTouchMove={handleDrawing}
            />
        </div>
    );
};

const ImageComparator: React.FC<{ before: string; after: string }> = ({ before, after }) => {
    const [sliderPos, setSliderPos] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMove = (clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const percent = (x / rect.width) * 100;
        setSliderPos(percent);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const onMouseMove = (moveEvent: MouseEvent) => handleMove(moveEvent.clientX);
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
    
    return (
        <div ref={containerRef} className="relative w-full aspect-square overflow-hidden rounded-2xl select-none group checkerboard-bg" style={{ cursor: 'ew-resize' }}>
            <img src={after} alt="After" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
            <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
                <img src={before} alt="Before" className="absolute inset-0 w-full h-full object-contain" />
            </div>
            <div className="absolute top-0 bottom-0 bg-white/70 w-1 cursor-ew-resize backdrop-blur-sm" style={{ left: `calc(${sliderPos}% - 2px)` }} onMouseDown={handleMouseDown}>
                <div className="bg-white/80 backdrop-blur-sm rounded-full h-10 w-10 absolute top-1/2 -translate-y-1/2 -left-1/2 -translate-x-1/2 flex items-center justify-center shadow-md border border-white/20">
                    <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h8m-4-4v8" transform="rotate(90 12 12)" /></svg>
                </div>
            </div>
        </div>
    );
};

const AspectRatioSelector: React.FC<{ value: string, onChange: (value: string) => void }> = ({ value, onChange }) => {
    const ratios = [
        { value: '1:1', label: 'Square', icon: <div className="w-8 h-8 border-2 rounded-md" /> },
        { value: '16:9', label: 'Landscape', icon: <div className="w-10 h-6 border-2 rounded-md" /> },
        { value: '9:16', label: 'Portrait', icon: <div className="w-6 h-10 border-2 rounded-md" /> },
        { value: '4:3', label: 'Standard', icon: <div className="w-9 h-7 border-2 rounded-md" /> },
        { value: '3:4', label: 'Vertical', icon: <div className="w-7 h-9 border-2 rounded-md" /> },
    ];
    return (
        <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Aspect Ratio</label>
            <div className="flex items-center gap-2 flex-wrap">
                {ratios.map(r => (
                    <button
                        key={r.value}
                        type="button"
                        onClick={() => onChange(r.value)}
                        className={`p-2 rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-1 w-16 transform hover:scale-105 ${value === r.value ? 'bg-[var(--accent-glow)] border border-cyan-400' : 'bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)]'}`}
                        aria-label={r.label}
                    >
                        {React.cloneElement(r.icon, { className: `border-current ${value === r.value ? 'text-white' : 'text-[var(--text-secondary)]'}` })}
                        <span className={`text-xs ${value === r.value ? 'text-white font-semibold' : 'text-[var(--text-secondary)]'}`}>{r.value}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

const ImageConverter: React.FC<{ activeImage: UploadedFile | null; onError: (msg: string) => void }> = ({ activeImage, onError }) => {
    const [targetFormat, setTargetFormat] = useState<'jpeg' | 'png' | 'webp' | 'bmp' | 'gif'>('jpeg');
    const [quality, setQuality] = useState(0.9);

    const handleConvert = () => {
        if (!activeImage) {
            onError("Please upload an image to convert.");
            return;
        }
        try {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = activeImage.url;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    onError("Could not create canvas context for conversion.");
                    return;
                }
                ctx.drawImage(img, 0, 0);

                const mimeType = `image/${targetFormat}`;
                const dataUrl = canvas.toDataURL(mimeType, quality);
                
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = `zma-ai-converted-${Date.now()}.${targetFormat === 'jpeg' ? 'jpg' : targetFormat}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };
            img.onerror = () => {
                onError("Could not load image for conversion, possibly due to CORS policy. Please try downloading it and re-uploading from your computer.");
            };
        } catch (err) {
            console.error(err);
            onError("An unexpected error occurred during conversion.");
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">Upload an image to convert its format. This process happens entirely in your browser and no data is sent to a server.</p>
            {!activeImage && <p className="text-sm text-yellow-400 p-3 bg-yellow-400/10 rounded-lg">Please upload a base image to get started.</p>}
            {activeImage && (
                <>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Target Format</label>
                        <div className="flex items-center gap-2 rounded-full bg-[var(--bg-tertiary)] p-1 flex-wrap">
                            {(['jpeg', 'png', 'webp', 'bmp', 'gif'] as const).map(format => (
                                <button key={format} onClick={() => setTargetFormat(format)} className={`flex-1 text-center text-sm font-semibold p-2 rounded-full transition-colors min-w-[60px] ${targetFormat === format ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white' : 'text-gray-300'}`}>
                                    {format.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                    {(targetFormat === 'jpeg' || targetFormat === 'webp') && (
                        <div>
                            <label htmlFor="quality" className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] mb-2">Quality: <span className="font-bold text-white">{Math.round(quality * 100)}%</span></label>
                            <input id="quality" type="range" min="0.1" max="1" step="0.05" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]" />
                        </div>
                    )}
                    <button onClick={handleConvert} className="btn-3d w-full">
                        Convert & Download
                    </button>
                </>
            )}
        </div>
    );
};


const placeholders = [
    { src: 'https://storage.googleapis.com/aistudio-hosting/prompts/zma-placeholder-1-1.png', aspectRatio: '1:1', label: 'Square', prompt: 'A hyper-detailed, photorealistic portrait of a futuristic cyborg with glowing neon eyes, cinematic lighting.' },
    { src: 'https://storage.googleapis.com/aistudio-hosting/prompts/zma-placeholder-16-9.png', aspectRatio: '16:9', label: 'Landscape', prompt: 'An epic fantasy landscape with a dragon flying over a majestic castle, digital painting, dramatic light.' },
    { src: 'https://storage.googleapis.com/aistudio-hosting/prompts/zma-placeholder-9-16.png', aspectRatio: '9:16', label: 'Portrait', prompt: 'An elegant art deco poster of a woman in a flowing gown, minimalist, gold and black.' },
    { src: 'https://storage.googleapis.com/aistudio-hosting/prompts/zma-placeholder-4-3.png', aspectRatio: '4:3', label: 'Standard', prompt: 'A cozy, cluttered artist\'s studio, filled with plants and books, warm morning light, oil painting style.' },
    { src: 'https://storage.googleapis.com/aistudio-hosting/prompts/zma-placeholder-3-4.png', aspectRatio: '3:4', label: 'Vertical', prompt: 'A whimsical watercolor illustration of a fox reading a book under a mushroom.' },
];

const passportSizes: Record<string, string> = {
    'USA': '2x2 inch',
    'Spain': '30x40 mm',
    'Germany': '35x45 mm',
    'France': '35x45 mm',
    'India': '2x2 inch',
    'China': '33x48 mm',
    'Italy': '35x40 mm',
    'Korea': '35x45 mm',
    'Brazil': '30x40 mm',
    'Dubai': '40x60 mm',
    'Pakistan': '35x45 mm',
    'Other (3x4)': '3x4 cm',
    'Other (4x4)': '4x4 cm',
    'Other (4x6)': '4x6 cm',
    'Other (5x6)': '5x6 cm',
};

export const ImageStudio: React.FC<ImageStudioProps> = ({ addImageToGallery, galleryImages }) => {
    const [mode, setMode] = useState<Mode>('generate');
    const [prompt, setPrompt] = useState('');
    const [uploadedImages, setUploadedImages] = useState<UploadedFile[]>([]);
    const [activeImage, setActiveImage] = useState<UploadedFile | null>(null);
    const [maskImage, setMaskImage] = useState<UploadedFile | null>(null);
    const [faceImage, setFaceImage] = useState<UploadedFile | null>(null);
    const [adjustments, setAdjustments] = useState({ brightness: 0, contrast: 0, saturation: 0 });
    const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
    const [extractedText, setExtractedText] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [history, setHistory] = useState<GeneratedImage[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [maskDrawMode, setMaskDrawMode] = useState<'draw' | 'upload'>('draw');
    const [brushSize, setBrushSize] = useState(40);
    const [textToReplace, setTextToReplace] = useState('');
    const [upscaleFactor, setUpscaleFactor] = useState('2x');
    const [passportSettings, setPassportSettings] = useState({ background: 'white', attire: 'formal suit', country: 'USA', hairstyle: '', facialHair: '' });


    const [settings, setSettings] = useState(() => {
        try {
            const localData = localStorage.getItem('zma-ai-studio-settings');
            const parsed = localData ? JSON.parse(localData) : {};
            return { 
                aspectRatio: parsed.aspectRatio || '1:1',
                realismLevel: parsed.realismLevel || 75
            };
        } catch (error) {
            console.error("Could not load settings from localStorage", error);
            return { aspectRatio: '1:1', realismLevel: 75 };
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('zma-ai-studio-settings', JSON.stringify(settings));
        } catch (error) {
            console.error("Could not save settings to localStorage", error);
        }
    }, [settings]);

    const handleAspectRatioChange = (ratio: string) => {
        setSettings(prev => ({ ...prev, aspectRatio: ratio }));
    };

    const handlePromptChange = useCallback((newTranscript: string) => {
        setPrompt(newTranscript);
    }, []);

    const { isListening, startListening, stopListening } = useVoiceRecognition(handlePromptChange);
    
    const resetOutputs = () => {
        setGeneratedImage(null);
        setExtractedText(null);
        setError('');
    }

    const handleNewFiles = (imageType: 'base' | 'face' | 'mask') => (newImages: UploadedFile[]) => {
        if (imageType === 'base') {
            setUploadedImages(prev => [...newImages, ...prev]);
            if (!activeImage) {
                setActiveImage(newImages[0]);
            }
            resetOutputs();
        } else {
            const setter = imageType === 'face' ? setFaceImage : setMaskImage;
            setter(newImages[0]);
            if (imageType !== 'mask') resetOutputs();
        }
    };
    
    const handleEnhancePrompt = async () => {
        if (!prompt) return;
        setIsLoading(true);
        setError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string, baseUrl: '/api/gemini/v1beta' });
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Enhance this image generation prompt to be more descriptive, vivid, and artistic. Add details about lighting, style, and composition. Original prompt: "${prompt}"`,
            });
            setPrompt(result.text.trim());
        } catch (err: any) {
            console.error(err);
            let errorMessage = 'Failed to enhance prompt.';
            if (err.message && err.message.includes('RESOURCE_EXHAUSTED')) {
                errorMessage = "You've exceeded your current API quota. Please check your plan and billing details to continue.";
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    const runAI = async (handler: () => Promise<void>) => {
        setIsLoading(true);
        resetOutputs();
        try {
            await handler();
        } catch (err: any) {
            console.error(err);
            let errorMessage = `An error occurred: ${err.message || 'Please try again.'}`;
            if (err.message && err.message.includes('RESOURCE_EXHAUSTED')) {
                errorMessage = "You've exceeded your current API quota. Please check your plan and billing details to continue.";
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const processNewImage = (image: GeneratedImage) => {
        setGeneratedImage(image);
        setHistory(prev => [image, ...prev]);
        addImageToGallery(image);
    };

    const handleDownload = (image: GeneratedImage) => {
        const extension = image.mimeType.split('/')[1] || 'png';
        const filename = `zma-ai-${image.type.replace(/\s+/g, '-')}-${image.id.replace(/:/g, '-')}.${extension}`;
        const a = document.createElement('a');
        a.href = image.src;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleGenerate = () => runAI(async () => {
        if (!prompt && !activeImage) { setError('Please enter a prompt or upload a base image.'); return; }
        const realismDescription = settings.realismLevel < 30 ? 'artistic, stylized, abstract' : settings.realismLevel < 70 ? 'semi-realistic, detailed, high quality' : 'photorealistic, hyper-detailed, 8k';
        const finalPrompt = `${prompt}, ${realismDescription}`;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string, baseUrl: '/api/gemini/v1beta' });

        if (activeImage && mode === 'generate') {
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [ { inlineData: { data: activeImage.base64, mimeType: activeImage.mimeType } }, { text: finalPrompt } ] },
                config: { responseModalities: [Modality.IMAGE] }
            });
            const part = result.candidates[0].content.parts.find(p => p.inlineData);
            if (!part || !part.inlineData) throw new Error("AI did not return an image.");
            processNewImage({
                id: new Date().toISOString(),
                src: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                originalSrc: activeImage.url, base64: part.inlineData.data, mimeType: part.inlineData.mimeType,
                prompt, type: 'generate', createdAt: new Date().toLocaleString(),
            });
        } else {
             if (!prompt) { setError('Please enter a prompt.'); return; }
             const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: finalPrompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/jpeg',
                    aspectRatio: settings.aspectRatio as "1:1" | "16:9" | "9:16" | "4:3" | "3:4",
                },
            });
            const imageData = response.generatedImages[0].image;
            processNewImage({
                id: new Date().toISOString(),
                src: `data:${imageData.mimeType};base64,${imageData.imageBytes}`,
                base64: imageData.imageBytes,
                mimeType: imageData.mimeType,
                prompt, type: 'generate', createdAt: new Date().toLocaleString(),
            });
        }
    });

    const singleImageAction = (prompt: string, type: GeneratedImage['type'], image: UploadedFile | null) => runAI(async () => {
        if (!image) { setError('Please upload the required image.'); return; }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string, baseUrl: '/api/gemini/v1beta' });
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [ { inlineData: { data: image.base64, mimeType: image.mimeType } }, { text: prompt } ] },
            config: { responseModalities: [Modality.IMAGE] }
        });
        const part = result.candidates[0].content.parts.find(p => p.inlineData);
        if (!part || !part.inlineData) throw new Error("AI did not return an image.");
        processNewImage({
            id: new Date().toISOString(),
            src: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            originalSrc: image.url, base64: part.inlineData.data, mimeType: part.inlineData.mimeType,
            prompt, type, createdAt: new Date().toLocaleString(),
        });
    });
    
    const multiImageAction = (prompt: string, type: GeneratedImage['type'], ...images: (UploadedFile|null)[]) => runAI(async () => {
        if (images.some(img => !img)) { setError('Please upload all required images.'); return; }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string, baseUrl: '/api/gemini/v1beta' });
        const parts = [...images.map(img => ({ inlineData: { data: img!.base64, mimeType: img!.mimeType } })), { text: prompt }];
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: { responseModalities: [Modality.IMAGE] }
        });
        const part = result.candidates[0].content.parts.find(p => p.inlineData);
        if (!part || !part.inlineData) throw new Error("AI did not return an image.");
        processNewImage({
            id: new Date().toISOString(),
            src: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            originalSrc: images[0]?.url, base64: part.inlineData.data, mimeType: part.inlineData.mimeType,
            prompt, type, createdAt: new Date().toLocaleString(),
        });
    });
    
    const handleGenerateVariation = () => runAI(async () => {
        if (!generatedImage) { setError('No image to create variations from.'); return; }
        const variationPrompt = `Generate a variation of this image. The original prompt was: "${generatedImage.prompt}"`;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string, baseUrl: '/api/gemini/v1beta' });
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [ { inlineData: { data: generatedImage.base64, mimeType: generatedImage.mimeType } }, { text: variationPrompt } ] },
            config: { responseModalities: [Modality.IMAGE] }
        });
        const part = result.candidates[0].content.parts.find(p => p.inlineData);
        if (!part || !part.inlineData) throw new Error("AI did not return an image.");
        processNewImage({
            id: new Date().toISOString(),
            src: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            originalSrc: generatedImage.src,
            base64: part.inlineData.data, mimeType: part.inlineData.mimeType,
            prompt: generatedImage.prompt, type: 'variation', createdAt: new Date().toLocaleString(),
            parentId: generatedImage.parentId || generatedImage.id,
        });
    });

    const handleFaceSwap = () => multiImageAction('Take the face from the first image and realistically swap it onto the person in the second image. Ensure the final image matches the lighting, skin tone, and angle of the second image. The integration must be seamless, with no visible edges or artifacts.', 'face-swap', faceImage, activeImage);
    const handleRestore = () => singleImageAction('Restore this old, damaged photo. Fix cracks, scratches, and discoloration. Remove grain and noise. Enhance colors and sharpness while preserving the original character of the photograph.', 'restore', activeImage);
    
    const handleExtractText = () => runAI(async () => {
        if (!activeImage) { setError('Please upload an image.'); return; }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string, baseUrl: '/api/gemini/v1beta' });
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [ { text: "Extract all text from this image accurately, maintaining original formatting." }, { inlineData: { data: activeImage.base64, mimeType: activeImage.mimeType } } ] },
        });
        setExtractedText(result.text);
    });
    
    const handleAnalyze = () => runAI(async () => {
        if (!activeImage) { setError('Please upload an image.'); return; }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string, baseUrl: '/api/gemini/v1beta' });
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [ { text: "Describe this image in detail for an AI image generation prompt. Be vivid about subject, setting, lighting, colors, style, and composition." }, { inlineData: { data: activeImage.base64, mimeType: activeImage.mimeType } } ] },
        });
        setPrompt(result.text.trim());
        setMode('generate');
        setError('Prompt generated! You can now edit it and create your image.');
    });

    const createUpscaleHandler = (imageToUpscale: GeneratedImage | UploadedFile | null, isFromGallery: boolean) => () => runAI(async () => {
        if (!imageToUpscale) {
            setError(isFromGallery ? 'No image to upscale.' : 'Please upload an image to upscale.');
            return;
        }
        const upscalePrompt = `Upscale this image to ${upscaleFactor === '2x' || upscaleFactor === '4x' ? upscaleFactor : `${upscaleFactor} resolution`}. The goal is an ultra-clear, high-definition result that is a faithful, high-resolution version of the original.
Key requirements:
1.  **Preserve Details:** Retain all original fine details, textures, and sharpness without introducing blur or pixelation.
2.  **Color Accuracy:** Maintain the original color palette, tone, and gradients with perfect accuracy. Do not alter colors.
3.  **Artifact Correction:** If minor compression artifacts or noise exist, correct them seamlessly during upscaling.
4.  **No AI Hallucinations:** The upscaled image must be free of any AI-generated artifacts, strange patterns, or inconsistencies.
5.  **Lighting Consistency:** Ensure lighting and contrast are consistent with the source image.`;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string, baseUrl: '/api/gemini/v1beta' });
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [ { inlineData: { data: imageToUpscale.base64, mimeType: imageToUpscale.mimeType } }, { text: upscalePrompt } ] },
            config: { responseModalities: [Modality.IMAGE] }
        });
        const part = result.candidates[0].content.parts.find(p => p.inlineData);
        if (!part || !part.inlineData) throw new Error("AI did not return an image.");
        processNewImage({
            id: new Date().toISOString(),
            src: `data:${part.inlineData.mimeType};base664,${part.inlineData.data}`,
            originalSrc: 'src' in imageToUpscale ? imageToUpscale.src : imageToUpscale.url,
            base64: part.inlineData.data, mimeType: part.inlineData.mimeType,
            prompt: `Upscaled to ${upscaleFactor}`, type: 'edit', createdAt: new Date().toLocaleString(),
            parentId: isFromGallery ? (imageToUpscale as GeneratedImage).parentId || (imageToUpscale as GeneratedImage).id : undefined,
        });
    });

    const handleUpscaleGeneratedImage = createUpscaleHandler(generatedImage, true);
    const handleUpscaleActiveImage = createUpscaleHandler(activeImage, false);

    const handleUseAsInput = () => {
        if (!generatedImage) return;
        const newFile: UploadedFile = {
            file: new File([], `generated-${generatedImage.id}.png`, { type: generatedImage.mimeType }),
            url: generatedImage.src,
            base64: generatedImage.base64,
            mimeType: generatedImage.mimeType,
        };
        setUploadedImages(prev => [newFile, ...prev]);
        setActiveImage(newFile);
        setGeneratedImage(null); // Clear the result view
    };
    
    const handleEdit = () => singleImageAction(prompt, 'edit', activeImage);
    const handleAdjust = () => singleImageAction(`Apply the following adjustments to the image: ${Object.entries(adjustments).filter(([, val]) => val !== 0).map(([key, val]) => `${val > 0 ? 'increase' : 'decrease'} ${key} by ${Math.abs(val)}%`).join(', ')}. Keep the result natural and high quality.`, 'edit', activeImage);
    const handleBackgroundRemoval = () => singleImageAction("Remove the background from this image. The final output must be a high-quality PNG file with a completely transparent background (RGBA, with alpha channel at zero). There should be no background color, patterns, or semi-transparent noise. The edges of the subject must be clean, sharp, and precisely masked.", 'background-removal', activeImage);
    const handlePassportPhoto = () => {
        const { background, attire, country, hairstyle, facialHair } = passportSettings;
        const size = passportSizes[country];
        const passportPrompt = `Edit this person's photo to be a professional passport-style picture for ${country}, with official dimensions of ${size}.
        - Set the background to a solid ${background} color.
        - ${attire !== 'none' ? `If the person is not in formal attire, dress them in a professional ${attire}.` : ''}
        - ${hairstyle ? `Change their hairstyle to: ${hairstyle}.` : ''}
        - ${facialHair ? `Modify their facial hair to: ${facialHair}.` : ''}
        The final image must be a high-quality, centered headshot with the person looking directly at the camera with a neutral expression. The lighting should be even and without shadows. Do not alter the person's core facial features or identity. The output should be cropped appropriately for a passport photo.`;
        singleImageAction(passportPrompt, 'passport-photo', activeImage);
    }
    const handleInpaint = () => multiImageAction(`In the first image provided, use the second image as a mask. The white area of the mask indicates the region to be modified. Replace the masked region with the following description: "${prompt}". The result should blend seamlessly and realistically with the original image's lighting, texture, and style.`, 'edit', activeImage, maskImage);
    const handleRetouch = () => multiImageAction(`In the first image provided, use the second image as a mask. The white area of the mask indicates the region to be removed. Intelligently remove the masked content (like skin blemishes, unwanted objects, or text) and fill the area by realistically generating content that matches the surrounding lighting, texture, and style. This is a magic eraser tool. The rest of the image must remain untouched.`, 'retouch', activeImage, maskImage);
    const handleReplicate = () => singleImageAction(`In the provided image, find and replace "${textToReplace}" with "${prompt}". The replacement must perfectly match the style, color, perspective, lighting, and texture of the surrounding elements. The rest of the image must remain untouched.`, 'edit', activeImage);

    const UploadedFilesTray: React.FC<{ images: UploadedFile[], activeImageUrl: string | null, onSelect: (image: UploadedFile) => void, onRemove: (url: string) => void }> = ({ images, activeImageUrl, onSelect, onRemove }) => (
        <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Uploaded Images</label>
            <div className="flex items-center gap-2 flex-wrap bg-[var(--bg-primary)] p-2 rounded-xl">
                {images.length === 0 && <p className="text-xs text-[var(--text-secondary)] px-2">Your uploaded images will appear here.</p>}
                {images.map(img => (
                    <div key={img.url} className="relative group">
                        <img 
                            src={img.url} 
                            alt="Uploaded thumbnail" 
                            onClick={() => onSelect(img)}
                            className={`w-16 h-16 object-cover rounded-md cursor-pointer transition-all border-2 ${activeImageUrl === img.url ? 'border-cyan-400 scale-105' : 'border-transparent'}`} 
                        />
                        <button 
                            onClick={(e) => { e.stopPropagation(); onRemove(img.url); }}
                            className="absolute -top-1 -right-1 bg-[var(--danger-primary)] text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                            <XMarkIcon className="w-3 h-3" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
    
    const AdjustmentsPanel: React.FC<{ adjustments: { brightness: number, contrast: number, saturation: number }, onChange: (key: 'brightness' | 'contrast' | 'saturation', value: number) => void }> = ({ adjustments, onChange }) => {
        const adjustmentConfig = [ { key: 'brightness', label: 'Brightness' }, { key: 'contrast', label: 'Contrast' }, { key: 'saturation', label: 'Saturation' } ];
        return (
            <div className="space-y-4">
                {adjustmentConfig.map(({ key, label }) => (
                    <div key={key}>
                        <label htmlFor={key} className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] mb-2">
                            {label}: <span className="font-bold text-white">{adjustments[key as keyof typeof adjustments]}%</span>
                        </label>
                        <input
                            id={key} type="range" min="-50" max="50"
                            value={adjustments[key as keyof typeof adjustments]}
                            onChange={(e) => onChange(key as keyof typeof adjustments, Number(e.target.value))}
                            className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        />
                    </div>
                ))}
            </div>
        );
    };

    const UpscaleOptions: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => {
        const options = ['2x', '4x', '2K', '4K', '8K'];
        return (
            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Upscale Factor</label>
                <div className="flex items-center gap-2 flex-wrap">
                    {options.map(opt => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => onChange(opt)}
                            className={`p-2 px-4 rounded-full transition-all duration-200 text-sm font-semibold transform hover:scale-105 ${value === opt ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white' : 'bg-[var(--bg-tertiary)] text-gray-300 hover:bg-[var(--border-primary)]'}`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const modeConfig = {
        generate: { title: 'Generate Image', description: 'Describe your vision and generate a unique image from scratch.', icon: VariationsIcon },
        edit: { title: 'AI Edit Image', description: 'Upload an image and describe your desired changes.', icon: WandIcon },
        retouch: { title: 'Magic Eraser', description: 'Erase unwanted objects, spots, or blemishes from your image.', icon: RetouchIcon },
        replicate: { title: 'Replicate Style', description: 'Replace text or objects in an image while perfectly matching the original style.', icon: EyeDropperIcon },
        'background-removal': { title: 'Background Removal', description: 'Upload an image to automatically remove the background.', icon: ScissorsIcon },
        inpaint: { title: 'AI Inpainting', description: 'Upload an image and draw a mask to edit specific areas.', icon: BrushIcon },
        adjust: { title: 'AI Adjustments', description: 'Fine-tune brightness, contrast, and saturation with AI.', icon: AdjustmentsIcon },
        'face-swap': { title: 'AI Face Swap', description: 'Upload a source face and a target image for a realistic swap.', icon: SwapIcon },
        restore: { title: 'Restore Old Photo', description: 'Automatically repair and enhance old photographs.', icon: RestoreIcon },
        'passport-photo': { title: 'Passport Photo Generator', description: 'Create professional, compliant passport photos from your images.', icon: AdjustmentsIcon },
        'extract-text': { title: 'Extract Text (OCR)', description: 'Pull text from any image.', icon: TextScanIcon },
        analyze: { title: 'Analyze Image', description: 'Generate a detailed prompt from an existing image.', icon: AnalyzeIcon },
        upscale: { title: 'AI Super Enlargement', description: 'Increase the resolution of your images while enhancing details.', icon: UpscaleIcon },
        converter: { title: 'Image Converter', description: 'Convert images between formats like JPG, PNG, and WEBP.', icon: SwapIcon },
    };

    const handleDrawnMaskUpdate = (maskBase64: string) => {
        setMaskImage({
            file: new File([], 'mask.png', { type: 'image/png' }),
            url: `data:image/png;base64,${maskBase64}`,
            base64: maskBase64,
            mimeType: 'image/png'
        });
    };

    const handleSubmit = () => {
        if(mode === 'converter') return; // Converter has its own button
        switch (mode) {
            case 'generate': return handleGenerate();
            case 'edit': return handleEdit();
            case 'face-swap': return handleFaceSwap();
            case 'restore': return handleRestore();
            case 'extract-text': return handleExtractText();
            case 'analyze': return handleAnalyze();
            case 'adjust': return handleAdjust();
            case 'inpaint': return handleInpaint();
            case 'retouch': return handleRetouch();
            case 'background-removal': return handleBackgroundRemoval();
            case 'replicate': return handleReplicate();
            case 'upscale': return handleUpscaleActiveImage();
            case 'passport-photo': return handlePassportPhoto();
        }
    };

    const isSubmitDisabled = isLoading ||
        (mode === 'generate' && !prompt && !activeImage) ||
        (mode === 'edit' && (!prompt || !activeImage)) ||
        (mode === 'adjust' && !activeImage) ||
        (mode === 'inpaint' && (!prompt || !activeImage || !maskImage)) ||
        (mode === 'retouch' && (!activeImage || !maskImage)) ||
        (mode === 'face-swap' && (!activeImage || !faceImage)) ||
        (['restore', 'extract-text', 'analyze', 'background-removal', 'upscale', 'passport-photo'].includes(mode) && !activeImage) ||
        (mode === 'replicate' && (!activeImage || !prompt || !textToReplace));

    const isImageSaved = generatedImage ? galleryImages.some(img => img.id === generatedImage.id) : false;

    return (
        <div className="space-y-8">
            <div className="text-center space-y-2 animate-slide-in-up">
                <h1 className="text-4xl lg:text-5xl font-bold text-white tracking-tight bg-clip-text text-transparent bg-[var(--gradient-text)]">{modeConfig[mode].title}</h1>
                 <p className="text-lg text-[var(--text-secondary)] mt-2 max-w-2xl mx-auto">{modeConfig[mode].description}</p>
            </div>

            <div className="glass-card max-w-7xl mx-auto p-2 rounded-3xl animate-slide-in-up stagger-1">
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-7 xl:grid-cols-auto flex-wrap gap-2">
                    {(Object.keys(modeConfig) as Mode[]).map(key => {
                        const Icon = modeConfig[key].icon;
                        return (
                            <button key={key} onClick={() => {setMode(key); resetOutputs();}} className={`flex flex-col items-center justify-center text-center gap-2 p-3 text-xs font-semibold rounded-2xl transition-all duration-300 transform hover:scale-105 ${mode === key ? 'bg-gradient-to-br from-cyan-500/50 to-purple-600/50 text-white shadow-md shadow-[var(--accent-glow)]' : 'text-gray-300 hover:bg-[var(--bg-tertiary)]'}`}>
                                <Icon className="w-8 h-8" />
                                <span className="capitalize">{key === 'converter' ? 'Convert' : key.replace('-', ' ')}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-slide-in-up stagger-2">
                <div className="lg:col-span-1 glass-card p-6 rounded-3xl space-y-6 self-start">
                    {['generate', 'edit', 'inpaint', 'replicate'].includes(mode) && (
                        <div>
                            <label htmlFor="prompt" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{mode === 'replicate' ? 'Replacement Description' : 'Your Prompt'}</label>
                            <div className="relative">
                                <textarea id="prompt" rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full input-glow rounded-xl p-2 text-white pr-20" placeholder={mode === 'inpaint' ? "e.g., A majestic eagle soaring" : (mode==='replicate' ? 'a blue car' : "A photorealistic cat in a wizard hat")} />
                                <div className="absolute top-2 right-2 flex flex-col gap-2">
                                    <button onClick={isListening ? stopListening : startListening} className={`p-1 rounded-full ${isListening ? 'bg-red-500/50 text-white animate-pulse' : 'hover:bg-[var(--border-primary)] text-gray-400'}`}><MicIcon className="w-5 h-5" /></button>
                                    <button onClick={handleEnhancePrompt} disabled={!prompt || isLoading} className="p-1 rounded-full hover:bg-[var(--border-primary)] text-gray-400 disabled:opacity-50" aria-label="Enhance Prompt"><WandIcon className="w-5 h-5" /></button>
                                </div>
                            </div>
                        </div>
                    )}
                    {mode === 'replicate' && (
                         <div>
                            <label htmlFor="textToReplace" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Element to Replace</label>
                            <input
                                type="text"
                                id="textToReplace"
                                value={textToReplace}
                                onChange={(e) => setTextToReplace(e.target.value)}
                                className="w-full input-glow rounded-xl p-2 text-white"
                                placeholder="e.g., the red apple on the table"
                            />
                        </div>
                    )}
                    {(mode === 'generate' && !activeImage) && (
                        <div className="space-y-4">
                            <AspectRatioSelector value={settings.aspectRatio} onChange={handleAspectRatioChange} />
                            <div>
                                <label htmlFor="realism" className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] mb-2">
                                    <RealismIcon className="w-5 h-5" />
                                    Realism Level: <span className="font-bold text-white">{settings.realismLevel}</span>
                                </label>
                                <input
                                    id="realism" type="range" min="1" max="100" value={settings.realismLevel}
                                    onChange={(e) => setSettings(prev => ({ ...prev, realismLevel: Number(e.target.value) }))}
                                    className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-cyan-400"
                                />
                            </div>
                        </div>
                    )}
                    
                    {['generate', 'edit', 'restore', 'extract-text', 'analyze', 'adjust', 'background-removal', 'replicate', 'upscale', 'converter', 'passport-photo'].includes(mode) && <ImageUploader onFilesUploaded={handleNewFiles('base')} imageUrl={activeImage?.url || null} title="Base Image" multiple />}
                    {mode === 'face-swap' && <div className="space-y-4"><ImageUploader onFilesUploaded={handleNewFiles('face')} imageUrl={faceImage?.url || null} title="Source Face" /><ImageUploader onFilesUploaded={handleNewFiles('base')} imageUrl={activeImage?.url || null} title="Target Image" multiple /></div>}
                    
                    {mode === 'passport-photo' && activeImage && (
                        <div className="space-y-4">
                             <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Size</label>
                                <select value={passportSettings.country} onChange={(e) => setPassportSettings(s => ({...s, country: e.target.value}))} className="w-full input-glow rounded-xl p-3 text-white">
                                    {Object.entries(passportSizes).map(([country, size]) => (
                                        <option key={country} value={country}>{country} ({size})</option>
                                    ))}
                                </select>
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Background Color</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['white', 'blue', 'grey'] as const).map(color => (
                                        <button key={color} onClick={() => setPassportSettings(s => ({...s, background: color}))} className={`p-2 rounded-lg text-sm capitalize transition-colors ${passportSettings.background === color ? 'bg-cyan-500 text-white ring-2 ring-cyan-300' : 'bg-[var(--bg-tertiary)]'}`}>{color}</button>
                                    ))}
                                </div>
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Suit Switch</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['formal suit', 'formal blouse', "women's blazer", 'turtleneck', 'none'] as const).map(attire => (
                                        <button key={attire} onClick={() => setPassportSettings(s => ({...s, attire: attire}))} className={`p-2 rounded-lg text-sm capitalize transition-colors ${passportSettings.attire === attire ? 'bg-cyan-500 text-white ring-2 ring-cyan-300' : 'bg-[var(--bg-tertiary)]'}`}>{attire}</button>
                                    ))}
                                </div>
                             </div>
                              <div>
                                <label htmlFor="hairstyle" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Hairstyle (Optional)</label>
                                <input type="text" id="hairstyle" value={passportSettings.hairstyle} onChange={(e) => setPassportSettings(s => ({...s, hairstyle: e.target.value}))} className="w-full input-glow rounded-xl p-2 text-white" placeholder="e.g., short, slicked back" />
                            </div>
                              <div>
                                <label htmlFor="facialHair" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Facial Hair (Optional)</label>
                                <input type="text" id="facialHair" value={passportSettings.facialHair} onChange={(e) => setPassportSettings(s => ({...s, facialHair: e.target.value}))} className="w-full input-glow rounded-xl p-2 text-white" placeholder="e.g., clean shaven, light stubble" />
                            </div>
                        </div>
                    )}

                    {(mode === 'inpaint' || mode === 'retouch') && (
                        <div className="space-y-4">
                            <ImageUploader onFilesUploaded={handleNewFiles('base')} imageUrl={activeImage?.url || null} title="Base Image" multiple />
                            {mode === 'inpaint' &&
                                <div className="bg-[var(--bg-tertiary)] p-1 rounded-full flex items-center">
                                    <button onClick={() => setMaskDrawMode('draw')} className={`flex-1 text-center text-sm font-semibold p-2 rounded-full transition-colors ${maskDrawMode === 'draw' ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white' : 'text-gray-300'}`}>Draw Mask</button>
                                    <button onClick={() => setMaskDrawMode('upload')} className={`flex-1 text-center text-sm font-semibold p-2 rounded-full transition-colors ${maskDrawMode === 'upload' ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white' : 'text-gray-300'}`}>Upload Mask</button>
                                </div>
                            }
                            {(maskDrawMode === 'draw' || mode === 'retouch') && activeImage && (
                                <div className="space-y-2">
                                     <p className="text-sm text-[var(--text-secondary)] -mt-2">{mode === 'retouch' ? 'Paint over the area you want to remove.' : 'Draw on the area you want to replace.'}</p>
                                    <MaskCanvas baseImage={activeImage.url} onMaskChange={handleDrawnMaskUpdate} brushSize={brushSize} />
                                     <div>
                                        <label htmlFor="brushSize" className="text-sm font-medium text-[var(--text-secondary)]">Brush Size: {brushSize}</label>
                                        <input id="brushSize" type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-cyan-400" />
                                    </div>
                                </div>
                            )}
                            {maskDrawMode === 'upload' && mode === 'inpaint' && (
                                <ImageUploader onFilesUploaded={handleNewFiles('mask')} imageUrl={maskImage?.url || null} title="Mask Image" />
                            )}
                        </div>
                    )}

                    {mode === 'upscale' && activeImage && (
                        <UpscaleOptions value={upscaleFactor} onChange={setUpscaleFactor} />
                    )}
                    
                    {uploadedImages.length > 0 && (
                        <UploadedFilesTray images={uploadedImages} activeImageUrl={activeImage?.url || null} onSelect={setActiveImage}
                            onRemove={(urlToRemove) => {
                                setUploadedImages(prev => prev.filter(img => img.url !== urlToRemove));
                                if (activeImage?.url === urlToRemove) {
                                    setActiveImage(uploadedImages.length > 1 ? uploadedImages.find(img => img.url !== urlToRemove)! : null);
                                }
                            }}
                        />
                    )}
                    
                    {mode === 'adjust' && <AdjustmentsPanel adjustments={adjustments} onChange={(key, value) => setAdjustments(prev => ({...prev, [key]: value}))} />}

                    {mode === 'converter' && <ImageConverter activeImage={activeImage} onError={setError} />}

                    {error && <p className="text-sm text-[var(--danger-primary)]">{error}</p>}
                    
                    {mode !== 'converter' && (
                        <div className="pt-4 border-t border-[var(--border-primary)]">
                            <button onClick={handleSubmit} disabled={isSubmitDisabled} className="btn-3d flex items-center justify-center gap-2 w-full">
                                {React.createElement(modeConfig[mode].icon, { className: "w-5 h-5" })}
                                <span className="capitalize">{mode.replace('-', ' ')}</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-2 flex items-start gap-4">
                   <div className="flex-1 glass-card p-4 min-h-[400px] flex flex-col items-center justify-center aspect-square rounded-3xl">
                        {isLoading && (
                            <div className="text-center flex flex-col items-center gap-4">
                                <LogoIcon className="h-24 w-24 animate-pulse" />
                                <p className="mt-4 text-lg text-[var(--text-secondary)]">AI is creating...</p>
                                <p className="text-sm text-[var(--text-secondary)]/70">This can take a moment.</p>
                            </div>
                        )}
                        {!isLoading && generatedImage && (
                            generatedImage.originalSrc ?
                            <ImageComparator before={generatedImage.originalSrc} after={generatedImage.src} /> :
                            <ZoomableImage src={generatedImage.src} alt="Generated" />
                        )}
                        {!isLoading && extractedText && (
                            <div className="w-full h-full bg-[var(--bg-tertiary)] p-4 rounded-xl overflow-y-auto animate-fade-in">
                                <pre className="text-white whitespace-pre-wrap text-sm">{extractedText}</pre>
                            </div>
                        )}
                        {!isLoading && !generatedImage && !extractedText && (
                             mode === 'generate' && !activeImage ? (
                                <div className="w-full grid grid-cols-2 lg:grid-cols-3 gap-2">
                                    {placeholders.map(p => (
                                        <div key={p.aspectRatio} className="relative group cursor-pointer" onClick={() => {handleAspectRatioChange(p.aspectRatio); setPrompt(p.prompt)}}>
                                            <img src={p.src} alt={p.label} className="rounded-lg w-full h-full object-cover aspect-square transition-transform duration-300 group-hover:scale-105" />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 rounded-lg">
                                                <p className="text-white text-center font-semibold text-sm">{p.label}<br/>({p.aspectRatio})</p>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="bg-[var(--bg-tertiary)] rounded-lg flex items-center justify-center text-center text-[var(--text-secondary)] p-2">Click a style to start</div>
                                </div>
                             ) : (
                                <div className="text-center text-[var(--text-secondary)]">
                                    {activeImage ? <img src={activeImage.url} alt="Active" className="max-h-full max-w-full object-contain rounded-2xl" /> : React.createElement(modeConfig[mode].icon, { className: "w-24 h-24 mx-auto opacity-10" })}
                                    <p className="mt-4">{activeImage ? 'Ready for your instructions.' : 'Your result will appear here.'}</p>
                                </div>
                            )
                        )}
                        {generatedImage && !isLoading && (
                            <div className="w-full pt-4 mt-auto flex items-center justify-center flex-wrap gap-2">
                                <button onClick={handleGenerateVariation} disabled={isLoading} className="flex items-center justify-center gap-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] text-white font-bold py-2 px-3 rounded-full transition-colors disabled:opacity-50 text-sm">
                                    <VariationsIcon className="w-4 h-4" /> Variation
                                </button>
                                <button onClick={handleUpscaleGeneratedImage} disabled={isLoading} className="flex items-center justify-center gap-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] text-white font-bold py-2 px-3 rounded-full transition-colors disabled:opacity-50 text-sm">
                                    <UpscaleIcon className="w-4 h-4" /> Upscale
                                </button>
                                <button onClick={handleUseAsInput} disabled={isLoading} className="flex items-center justify-center gap-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] text-white font-bold py-2 px-3 rounded-full transition-colors disabled:opacity-50 text-sm">
                                    <WandIcon className="w-4 h-4" /> Use as Input
                                </button>
                                <button disabled={true} className="flex items-center justify-center gap-2 bg-[var(--bg-tertiary)] text-white font-bold py-2 px-3 rounded-full transition-colors disabled:opacity-70 disabled:cursor-default text-sm">
                                    <SaveIcon className="w-4 h-4" /> {isImageSaved ? 'Saved to Gallery' : 'Saving...'}
                                </button>
                                <button onClick={() => handleDownload(generatedImage)} className="flex items-center justify-center gap-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] text-white font-bold py-2 px-3 rounded-full transition-colors text-sm">
                                    <DownloadIcon className="w-4 h-4" /> Download
                                </button>
                            </div>
                        )}
                   </div>
                    <div className="relative">
                        <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="absolute -left-5 top-1/2 -translate-y-1/2 z-20 p-2 glass-card rounded-full hover:bg-[var(--border-primary)] transition-all" aria-label="Toggle history panel">
                            {isHistoryOpen ? <ChevronRightIcon className="w-5 h-5" /> : <ChevronLeftIcon className="w-5 h-5" />}
                        </button>
                        <div className={`flex flex-col glass-card h-full self-stretch rounded-3xl transition-all duration-300 ease-in-out ${isHistoryOpen ? 'w-72' : 'w-0'}`}>
                            <div className="overflow-hidden flex flex-col h-full">
                                <div className="p-4 border-b border-[var(--border-primary)] flex items-center justify-between gap-2">
                                     <div className="flex items-center gap-2">
                                        <HistoryIcon className="w-6 h-6" />
                                        <h3 className="font-bold text-lg text-white whitespace-nowrap">Session History</h3>
                                    </div>
                                    {history.length > 0 && (
                                        <button 
                                            onClick={() => { if(window.confirm('Are you sure you want to clear the session history?')) setHistory([]); }} 
                                            className="p-1.5 rounded-full text-[var(--text-secondary)] hover:text-white hover:bg-[var(--border-primary)] transition-colors" 
                                            aria-label="Clear history"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                                    {history.length === 0 ? (
                                        <p className="text-center text-sm text-[var(--text-secondary)] p-4">Your generated images will appear here.</p>
                                    ) : (
                                        history.map(item => (
                                            <div key={item.id} onClick={() => setGeneratedImage(item)} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-[var(--bg-primary)] transition-colors group">
                                                <img src={item.src} alt={item.prompt} className="w-16 h-16 object-cover rounded-md flex-shrink-0" />
                                                <div className="flex-1 overflow-hidden">
                                                    <p className="text-xs text-white truncate font-medium">"{item.prompt}"</p>
                                                    <p className="text-xs text-[var(--text-secondary)] capitalize">{item.type}</p>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDownload(item); }} 
                                                    className="p-1.5 rounded-full text-transparent group-hover:text-[var(--text-secondary)] hover:!text-white hover:bg-[var(--border-primary)] transition-colors"
                                                    aria-label="Download image"
                                                >
                                                    <DownloadIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};