
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { GeneratedImage } from '../types';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { LogoIcon, MicIcon, WandIcon, SwapIcon, RestoreIcon, TextScanIcon, AnalyzeIcon, HistoryIcon, VariationsIcon, ChevronRightIcon, ChevronLeftIcon, RealismIcon, DownloadIcon, TrashIcon, SaveIcon, UpscaleIcon, BrushIcon, AdjustmentsIcon, XMarkIcon, ScissorsIcon, EyeDropperIcon, SparklesIcon, RetouchIcon, FilterIcon, UndoIcon, RedoIcon, SpeakerWaveIcon } from './icons';
import ZoomableImage from './ZoomableImage';
import { speakText } from '../utils/tts';

interface ImageStudioProps {
    addImageToGallery: (image: GeneratedImage) => void;
    galleryImages: GeneratedImage[];
}

type Mode = 'generate' | 'edit' | 'face-swap' | 'restore' | 'extract-text' | 'analyze' | 'inpaint' | 'adjust' | 'background-removal' | 'replicate' | 'upscale' | 'converter' | 'passport-photo' | 'print-layout';

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
    const uploaderRef = useRef<HTMLDivElement>(null); // Ref for the uploader div

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
    
    // Fix: Correctly attach paste event listener to the uploader div
    useEffect(() => {
        const currentUploaderRef = uploaderRef.current;
        if (!currentUploaderRef) return;

        currentUploaderRef.addEventListener('paste', handlePaste);
        return () => currentUploaderRef.removeEventListener('paste', handlePaste);
    }, [handlePaste]);


    return (
        <div
            ref={uploaderRef} // Attach ref to the uploader div
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
        // Fix: Add onerror handler for base image loading
        img.onerror = () => {
            console.error("Failed to load base image for mask canvas.");
            setImageSize({ width: 0, height: 0 }); // Reset size
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = 'red';
                    ctx.font = '16px Arial';
                    ctx.fillText('Error loading image', 10, 30);
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
        <div ref={containerRef} className="relative w-full aspect-square overflow-hidden rounded-2xl select-none group checkerboard-bg" style={{ cursor: isDragging.current ? 'grabbing' : 'ew-resize' }} onMouseDown={handleMouseDown}>
            <img src={after} alt="After" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
            <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
                <img src={before} alt="Before" className="absolute inset-0 w-full h-full object-contain" />
            </div>
            <div className="absolute top-0 bottom-0 bg-white/70 w-1 cursor-ew-resize backdrop-blur-sm" style={{ left: `calc(${sliderPos}% - 2px)` }}>
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

interface PassportStandard {
    size: string;
    bg: string;
    headSize: string;
    dpi: number;
}

const passportStandards: Record<string, PassportStandard> = {
    'USA': { size: '2x2 inch (51x51 mm)', bg: 'White', headSize: '1-1.4in (25-35mm)', dpi: 300 },
    'United Kingdom': { size: '35x45 mm', bg: 'Light Grey', headSize: '29-34mm', dpi: 300 },
    'Schengen (EU)': { size: '35x45 mm', bg: 'Light Grey/White', headSize: '32-36mm', dpi: 300 },
    'China': { size: '33x48 mm', bg: 'White', headSize: '28-33mm', dpi: 300 },
    'India': { size: '2x2 inch (51x51 mm)', bg: 'White', headSize: '35-40mm', dpi: 300 },
    'Canada': { size: '50x70 mm', bg: 'White', headSize: '31-36mm', dpi: 300 },
    'Australia': { size: '35x45 mm', bg: 'Light Grey', headSize: '32-36mm', dpi: 300 },
    'Japan': { size: '35x45 mm', bg: 'White', headSize: '32-36mm', dpi: 300 },
    'Russia': { size: '35x45 mm', bg: 'White', headSize: '70-80% height', dpi: 300 },
    'Brazil': { size: '50x70 mm', bg: 'White', headSize: '32-36mm', dpi: 300 },
    'Turkey': { size: '50x60 mm', bg: 'White', headSize: '32-36mm', dpi: 300 },
    'Germany': { size: '35x45 mm', bg: 'Light Grey', headSize: '32-36mm', dpi: 300 },
    'France': { size: '35x45 mm', bg: 'Light Grey', headSize: '32-36mm', dpi: 300 },
    'Italy': { size: '35x40 mm', bg: 'White', headSize: '70-80% height', dpi: 300 },
    'Korea': { size: '35x45 mm', bg: 'White', headSize: '32-36mm', dpi: 300 },
    'Dubai/UAE': { size: '40x60 mm', bg: 'White', headSize: '70-80% height', dpi: 300 },
    'Pakistan': { size: '35x45 mm', bg: 'White', headSize: '70% height', dpi: 300 },
    'General 35x45': { size: '35x45 mm', bg: 'White', headSize: '70-80% height', dpi: 300 },
    'General 2x2': { size: '2x2 inch', bg: 'White', headSize: 'Centered', dpi: 300 },
};

const attireOptions = {
    Man: [
        'None (Keep Original)', 'Casual T-Shirt (Grey)', 'Casual T-Shirt (Black)', 'Casual Shirt (White, Collared)',
        'Formal Suit (Black)', 'Formal Suit (Navy)', 'Business Casual Blazer (Grey)', 'Turtleneck (Black)'
    ],
    Woman: [
        'None (Keep Original)', 'Casual Blouse (Pastel)', 'Casual T-Shirt (Black)', 'Formal Blazer (Grey)',
        'Formal Suit (Navy Skirt)', 'Formal Suit (Black Pants)', 'Modest Blouse (High Neck)', 'Professional Dress'
    ],
    Boy: [
        'None (Keep Original)', 'Casual T-Shirt (Blue)', 'Casual Polo Shirt (Green)', 'School Uniform Shirt', 'Small Blazer (Navy)'
    ],
    Girl: [
        'None (Keep Original)', 'Casual Dress (Floral)', 'Casual T-Shirt (Pink)', 'School Uniform Blouse', 'Small Cardigan (White)'
    ],
    Infant: [
        'None (Keep Original)', 'Plain Bodysuit (White)', 'Plain Bodysuit (Light Blue)', 'Plain Bodysuit (Pink)'
    ]
};

const MM_PER_INCH = 25.4;
const PRINT_DPI = 300; // High resolution for print

const a4ToPixels = (mm: number) => (mm / MM_PER_INCH) * PRINT_DPI;

// Define standard paper sizes in MM
const PAPER_SIZES_MM = {
    'A4': { width: 297, height: 210 }, // Landscape reference
    '3x4in': { width: 76.2, height: 101.6 },
    '4x4in': { width: 101.6, height: 101.6 },
    '4x6in': { width: 101.6, height: 152.4 }, // Standard photo print (portrait default)
    '5x6in': { width: 127, height: 152.4 },
    '5x7in': { width: 127, height: 177.8 }, // 5x7 inch paper
};

// Wallet size photo (commonly 2x3 inch)
const WALLET_PHOTO_WIDTH_MM = 50.8; // 2 inches
const WALLET_PHOTO_HEIGHT_MM = 76.2; // 3 inches

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
    const [sessionHistory, setSessionHistory] = useState<GeneratedImage[]>([]); // Renamed from 'history'
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [maskDrawMode, setMaskDrawMode] = useState<'draw' | 'upload'>('draw');
    const [brushSize, setBrushSize] = useState(40);
    const [textToReplace, setTextToReplace] = useState('');
    const [upscaleFactor, setUpscaleFactor] = useState('2x');
    const [passportSettings, setPassportSettings] = useState({ 
        background: 'White', 
        attire: 'None (Keep Original)', 
        country: 'USA', 
        personType: 'Man' as 'Man' | 'Woman' | 'Boy' | 'Girl' | 'Infant',
        hairstyle: '', 
        facialHair: '' 
    });
    const [complianceReport, setComplianceReport] = useState<string | null>(null);


    // New states for undo/redo functionality
    const [editStack, setEditStack] = useState<GeneratedImage[]>([]);
    const [editStackIndex, setEditStackIndex] = useState(-1);

    // New states for print layout
    const [selectedPrintImage, setSelectedPrintImage] = useState<GeneratedImage | UploadedFile | null>(null);
    const [paperSize, setPaperSize] = useState<'A4' | '3x4in' | '4x4in' | '4x6in' | '5x6in' | '5x7in'>('A4');
    const [pageOrientation, setPageOrientation] = useState<'landscape' | 'portrait'>('landscape');
    type PrintTemplateType = 'full-page' | '4x6-grid' | '5x7-grid' | 'passport-grid' | 'passport-35x45-grid' | 'wallet-grid';
    const [printTemplate, setPrintTemplate] = useState<PrintTemplateType>('full-page');
    const printCanvasRef = useRef<HTMLCanvasElement>(null);

    // Download format/quality for individual images AND print layouts
    const [downloadFormat, setDownloadFormat] = useState<'png' | 'jpeg'>('png');
    const [downloadQuality, setDownloadQuality] = useState(1); // 0-1 for JPEG, 1 for PNG


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
    
    // Modified resetOutputs to also clear edit stack for a fresh start in the panel
    const resetOutputs = useCallback(() => {
        setGeneratedImage(null);
        setExtractedText(null);
        setError('');
        setComplianceReport(null); // Clear compliance report
        setEditStack([]); // Clear edit history
        setEditStackIndex(-1); // Reset index
        // Clear print layout states too
        setSelectedPrintImage(null);
        setPrintTemplate('full-page'); // Reset template
        setPaperSize('A4'); // Reset paper size
        setPageOrientation('landscape'); // Reset orientation
        setDownloadFormat('png'); // Reset download format
        setDownloadQuality(1); // Reset download quality
        if (printCanvasRef.current) {
            const ctx = printCanvasRef.current.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, printCanvasRef.current.width, printCanvasRef.current.height);
            }
        }
    }, []);

    const handleNewFiles = (imageType: 'base' | 'face' | 'mask') => (newImages: UploadedFile[]) => {
        if (imageType === 'base') {
            setUploadedImages(prev => [...newImages, ...prev]);
            if (!activeImage) {
                setActiveImage(newImages[0]);
            }
            resetOutputs(); // Reset outputs when new base images are uploaded
        } else {
            const setter = imageType === 'face' ? setFaceImage : setMaskImage;
            setter(newImages[0]);
            if (imageType !== 'mask') resetOutputs(); // Reset outputs for face/mask changes
        }
    };
    
    const handleEnhancePrompt = async () => {
        if (!prompt) return;
        setIsLoading(true);
        setError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Enhance this image generation prompt to be more descriptive, vivid, and artistic. Add details about lighting, style, and composition. Original prompt: "${prompt}"`,
            });
            // Changed from result.text.trim() to result.text to avoid issues if result.text is undefined.
            // .text property on GenerateContentResponse returns string | undefined
            setPrompt(result.text?.trim() || '');
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
        setError(''); // Clear previous error
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

    // New function to process and store new images into generatedImage, editStack, and sessionHistory
    const processNewImage = useCallback((image: GeneratedImage, isFreshChain: boolean) => {
        setGeneratedImage(image); // Set the image to display

        setEditStack(prevStack => {
            if (isFreshChain) {
                return [image]; // Start a new stack
            } else {
                // Continue the current stack, truncating any 'redo' history
                const newStack = prevStack.slice(0, editStackIndex + 1);
                return [...newStack, image];
            }
        });
        setEditStackIndex(prevIndex => (isFreshChain ? 0 : prevIndex + 1));

        // Update session history (all distinct generated images for the session)
        setSessionHistory(prev => [image, ...prev]);
        // Add to the persistent gallery
        addImageToGallery(image);
    }, [editStackIndex, addImageToGallery, setSessionHistory]);

    const handleDownload = (image: GeneratedImage, format: 'png' | 'jpeg' = downloadFormat, quality: number = downloadQuality) => {
        // If the image is not PNG and PNG is requested, or if quality is <1, re-render via canvas
        if (format === 'jpeg' && (image.mimeType !== 'image/jpeg' || quality < 1)) {
            const img = new Image();
            img.src = image.src;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    const dataUrl = canvas.toDataURL(`image/${format}`, quality);
                    const a = document.createElement('a');
                    a.href = dataUrl;
                    a.download = `zma-ai-${image.type.replace(/\s+/g, '-')}-${image.id.replace(/:/g, '-')}.${format === 'jpeg' ? 'jpg' : format}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } else {
                    setError("Could not create canvas context for download.");
                }
            };
            img.onerror = () => {
                setError("Could not load image for download.");
            };
        } else {
            // Default download for PNG or if already JPEG with max quality
            const extension = format === 'jpeg' ? 'jpg' : 'png';
            const filename = `zma-ai-${image.type.replace(/\s+/g, '-')}-${image.id.replace(/:/g, '-')}.${extension}`;
            const a = document.createElement('a');
            a.href = image.src;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    const handleGenerate = () => runAI(async () => {
        if (!prompt && !activeImage) { setError('Please enter a prompt or upload a base image.'); return; }
        const realismDescription = settings.realismLevel < 30 ? 'artistic, stylized, abstract' : settings.realismLevel < 70 ? 'semi-realistic, detailed, high quality' : 'photorealistic, hyper-detailed, 8k';
        const finalPrompt = `${prompt}, ${realismDescription}`;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

        let newImage: GeneratedImage | undefined;
        let isFreshChainForGenerate: boolean = true;

        if (activeImage && mode === 'generate') {
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [ { inlineData: { data: activeImage.base64, mimeType: activeImage.mimeType } }, { text: finalPrompt } ] },
                config: { responseModalities: [Modality.IMAGE] }
            });
            const part = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            
            if (!part || !part.inlineData) {
                // Check if the model returned text instead (e.g. refusal)
                const textPart = result.candidates?.[0]?.content?.parts?.find(p => p.text);
                if (textPart && textPart.text) {
                     throw new Error(textPart.text);
                }
                throw new Error("AI did not return an image.");
            }
            
            newImage = {
                id: new Date().toISOString(),
                src: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                originalSrc: activeImage.url, base64: part.inlineData.data, mimeType: part.inlineData.mimeType,
                prompt, type: 'generate', createdAt: new Date().toLocaleString(),
            };
            // If the activeImage for this generation is NOT the currently displayed generated image,
            // then it's a fresh chain. Otherwise, it's a continuation.
            isFreshChainForGenerate = !generatedImage || (activeImage.url !== generatedImage.src);

        } else {
             if (!prompt) { setError('Please enter a prompt.'); return; }
             
             try {
                 const response = await ai.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt: finalPrompt,
                    config: {
                        numberOfImages: 1,
                        outputMimeType: 'image/jpeg',
                        aspectRatio: settings.aspectRatio as "1:1" | "16:9" | "9:16" | "4:3" | "3:4",
                    },
                });

                if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image) {
                    const imageData = response.generatedImages[0].image;
                    newImage = {
                        id: new Date().toISOString(),
                        src: `data:${imageData.mimeType};base64,${imageData.imageBytes}`,
                        base64: imageData.imageBytes,
                        mimeType: imageData.mimeType,
                        prompt, type: 'generate', createdAt: new Date().toLocaleString(),
                    };
                }
             } catch (imagenError: any) {
                 console.warn("Imagen failed, falling back to Gemini 2.5 Flash Image:", imagenError);
                 // Fallback to gemini-2.5-flash-image if imagen fails (e.g. unsafe prompt or model not supported by key)
             }

             if (!newImage) {
                 // Backup attempt with gemini-2.5-flash-image for text-to-image
                 const fallbackResult = await ai.models.generateContent({
                     model: 'gemini-2.5-flash-image',
                     contents: { parts: [{ text: finalPrompt }] },
                     config: { responseModalities: [Modality.IMAGE] }
                 });

                 const fallbackPart = fallbackResult.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                 
                 if (!fallbackPart || !fallbackPart.inlineData) {
                    const textPart = fallbackResult.candidates?.[0]?.content?.parts?.find(p => p.text);
                    if (textPart && textPart.text) {
                         throw new Error(`Generation failed: ${textPart.text}`);
                    }
                    throw new Error("AI did not return a generated image.");
                 }

                 newImage = {
                    id: new Date().toISOString(),
                    src: `data:${fallbackPart.inlineData.mimeType};base64,${fallbackPart.inlineData.data}`,
                    base64: fallbackPart.inlineData.data, mimeType: fallbackPart.inlineData.mimeType,
                    prompt, type: 'generate', createdAt: new Date().toLocaleString(),
                 };
             }
             
            isFreshChainForGenerate = true; // Pure text-to-image always starts a fresh chain
        }
        
        if (newImage) {
            processNewImage(newImage, isFreshChainForGenerate);
        }
    });

    const singleImageAction = (prompt: string, type: GeneratedImage['type'], image: UploadedFile | null) => runAI(async () => {
        if (!image) { setError('Please upload the required image.'); return; }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [ { inlineData: { data: image.base64, mimeType: image.mimeType } }, { text: prompt } ] },
            config: { responseModalities: [Modality.IMAGE] }
        });
        const part = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        
        if (!part || !part.inlineData) {
            const textPart = result.candidates?.[0]?.content?.parts?.find(p => p.text);
            if (textPart && textPart.text) {
                 throw new Error(textPart.text);
            }
            throw new Error("AI did not return an image.");
        }

        const newImage: GeneratedImage = {
            id: new Date().toISOString(),
            src: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            originalSrc: image.url, base64: part.inlineData.data, mimeType: part.inlineData.mimeType,
            prompt, type, createdAt: new Date().toLocaleString(),
        };
        // If the input image for this action is NOT the currently displayed generated image,
        // then it's a fresh chain. Otherwise, it's a continuation.
        const isFreshChain = !generatedImage || (image.url !== generatedImage.src);
        processNewImage(newImage, isFreshChain);

        // For passport photo, set compliance report
        if (type === 'passport-photo') {
            const standard = passportStandards[passportSettings.country] || passportStandards['USA'];
            setComplianceReport(`Compliant for ${passportSettings.country}.
Dimensions: ${standard.size}
Background: ${standard.bg}
Head Size: ${standard.headSize}
Attire: ${passportSettings.attire}
Output Format: ${downloadFormat.toUpperCase()}
Quality: ${Math.round(downloadQuality * 100)}%
Biometric-ready: Yes
Print/submit ready.`);
        } else {
            setComplianceReport(null);
        }
    });
    
    const multiImageAction = (prompt: string, type: GeneratedImage['type'], ...images: (UploadedFile|null)[]) => runAI(async () => {
        if (images.some(img => !img)) { setError('Please upload all required images.'); return; }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const parts = [...images.map(img => ({ inlineData: { data: img!.base64, mimeType: img!.mimeType } })), { text: prompt }];
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: { responseModalities: [Modality.IMAGE] }
        });
        const part = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

        if (!part || !part.inlineData) {
            const textPart = result.candidates?.[0]?.content?.parts?.find(p => p.text);
            if (textPart && textPart.text) {
                 throw new Error(textPart.text);
            }
            throw new Error("AI did not return an image.");
        }

        const newImage: GeneratedImage = {
            id: new Date().toISOString(),
            src: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            originalSrc: images[0]?.url, base64: part.inlineData.data, mimeType: part.inlineData.mimeType,
            prompt, type, createdAt: new Date().toLocaleString(),
        };
        // If the *first* input image for this action is NOT the currently displayed generated image,
        // then it's a fresh chain. Otherwise, it's a continuation.
        const isFreshChain = !generatedImage || (images[0]?.url !== generatedImage.src);
        processNewImage(newImage, isFreshChain);
    });
    
    const handleGenerateVariation = () => runAI(async () => {
        if (!generatedImage) { setError('No image to create variations from.'); return; }
        const variationPrompt = `Generate a variation of this image. The original prompt was: "${generatedImage.prompt}"`;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [ { inlineData: { data: generatedImage.base64, mimeType: generatedImage.mimeType } }, { text: variationPrompt } ] },
            config: { responseModalities: [Modality.IMAGE] }
        });
        const part = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

        if (!part || !part.inlineData) {
            const textPart = result.candidates?.[0]?.content?.parts?.find(p => p.text);
            if (textPart && textPart.text) {
                 throw new Error(textPart.text);
            }
            throw new Error("AI did not return an image.");
        }

        const newImage: GeneratedImage = {
            id: new Date().toISOString(),
            src: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            originalSrc: generatedImage.src,
            base64: part.inlineData.data, mimeType: part.inlineData.mimeType,
            prompt: generatedImage.prompt, type: 'variation', createdAt: new Date().toLocaleString(),
            parentId: generatedImage.parentId || generatedImage.id,
        };
        // Variations always continue the current chain
        processNewImage(newImage, false);
    });

    const createUpscaleHandler = (imageToUpscale: GeneratedImage | UploadedFile | null, isFromGenerated: boolean) => () => runAI(async () => {
        if (!imageToUpscale) {
            setError(isFromGenerated ? 'No image to upscale.' : 'Please upload an image to upscale.');
            return;
        }
        const upscalePrompt = `Upscale this image to ${upscaleFactor === '2x' || upscaleFactor === '4x' ? upscaleFactor : `${upscaleFactor} resolution`}. The goal is an ultra-clear, high-definition result that is a faithful, high-resolution version of the original.
Key requirements:
1.  **Preserve Details:** Retain all original fine details, textures, and sharpness without introducing blur or pixelation.
2.  **Color Accuracy:** Maintain the original color palette, tone, and gradients with perfect accuracy. Do not alter colors.
3.  **Artifact Correction:** If minor compression artifacts or noise exist, correct them seamlessly during upscaling.
4.  **No AI Hallucinations:** The upscaled image must be free of any AI-generated artifacts, strange patterns, or inconsistencies.
5.  **Lighting Consistency:** Ensure lighting and contrast are consistent with the source image.`;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [ { inlineData: { data: imageToUpscale.base64, mimeType: imageToUpscale.mimeType } }, { text: upscalePrompt } ] },
            config: { responseModalities: [Modality.IMAGE] }
        });
        const part = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

        if (!part || !part.inlineData) {
            const textPart = result.candidates?.[0]?.content?.parts?.find(p => p.text);
            if (textPart && textPart.text) {
                 throw new Error(textPart.text);
            }
            throw new Error("AI did not return an image.");
        }

        const newImage: GeneratedImage = {
            id: new Date().toISOString(),
            src: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            originalSrc: 'src' in imageToUpscale ? imageToUpscale.src : imageToUpscale.url,
            base64: part.inlineData.data, mimeType: part.inlineData.mimeType,
            prompt: `Upscaled to ${upscaleFactor}`, type: 'edit', createdAt: new Date().toLocaleString(),
            parentId: isFromGenerated ? (imageToUpscale as GeneratedImage).parentId || (imageToUpscale as GeneratedImage).id : undefined,
        };
        // Upscaling continues the current chain if it's based on generatedImage (isFromGenerated = true)
        // If upscaling an activeImage that is NOT the currently displayed generatedImage, it's a fresh chain.
        const isFreshChain = isFromGenerated ? false : (!generatedImage || (imageToUpscale as UploadedFile).url !== generatedImage.src);
        processNewImage(newImage, isFreshChain);
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
        // Do not call processNewImage here, it's just setting active input.
        // The next AI operation will decide if it's a fresh chain based on this activeImage.
        setGeneratedImage(null); // Clear the result view, ready for new operation
        setEditStack([]); // Also clear edit stack as a new explicit input is now active
        setEditStackIndex(-1);
    };
    
    const handleEdit = () => singleImageAction(prompt, 'edit', activeImage);
    const handleAdjust = () => singleImageAction(`Apply the following adjustments to the image: ${Object.entries(adjustments).filter(([, val]) => (val as number) !== 0).map(([key, val]) => `${(val as number) > 0 ? 'increase' : 'decrease'} ${key} by ${Math.abs(val as number)}%`).join(', ')}. Keep the result natural and high quality.`, 'edit', activeImage);
    const handleBackgroundRemoval = () => singleImageAction("Remove the background from this image. The final output must be a high-quality PNG file with a completely transparent background (RGBA, with alpha channel at zero). There should be no background color, patterns, or semi-transparent noise. The edges of the subject must be clean, sharp, and precisely masked.", 'background-removal', activeImage);
    const handlePassportPhoto = () => {
        const { background, attire, country, personType, hairstyle, facialHair } = passportSettings;
        const standard = passportStandards[country] || passportStandards['USA'];
        const currentAttireOptions = attireOptions[personType] || attireOptions.Man; // Fallback

        const passportPrompt = `
        Act as a professional passport/visa/ID photo editor. Process this photo into a compliant passport image for ${country}.
        
        STRICT COMPLIANCE STANDARDS (${country}):
        - Biometric Readiness: Ensure clear eyes/iris, no glare on glasses (if present and allowed), and no reflections.
        - Dimensions: Target visual aspect ratio of ${standard.size}.
        - Background: Remove original background. Replace with solid ${background}. No gradients, shadows, or patterns.
        - Head Size: ${standard.headSize}.
        - Lighting: Even studio lighting, no shadows on face/background, no glare, smooth and natural illumination.
        - Pose: Full front view, perfectly straight posture, head centered, camera at eye level.
        - Expression: Neutral expression, eyes open and visible, mouth completely closed, no smiling, no teeth showing.
        - Recent Appearance: Ensure the appearance looks recent (within 6 months).
        - No AI Hallucinations: The generated image must be free of any AI-generated artifacts, strange patterns, or inconsistencies.

        EDITING INSTRUCTIONS:
        1. Crop & Scale: Detect, center, and crop the face to exact specifications. Scale head precisely to meet regulations.
        2. Remove/Replace Background: Completely remove the original background; replace with uniform plain ${background} color (no patterns/textures).
        3. Enhance: Automatically fix brightness, contrast, saturation, sharpness. Ensure even lighting and HD studio quality. Remove red-eye if present.
        4. Subject Analysis: Process the image for a ${personType} (detecting age/gender for optimal results).
        5. Attire: ${attire === 'None (Keep Original)' ? 'Neaten the original attire. Ensure it is not white if the background is white.' : `Change outfit to a realistic ${attire} suitable for a ${personType} from a fashion collection. Ensure realistic fabric texture, fit, and lighting match. Avoid white attire if the background is white. Make it astonishing and fashionable.`}
        6. Features & Compliance: ${hairstyle ? `Hairstyle: ${hairstyle}.` : ''} ${facialHair ? `Facial Hair: ${facialHair}.` : ''} No accessories, non-religious headgear, or dark glasses unless medically required. Hair must be off the face, not covering eyes or eyebrows. No blending of hair into the background.
        
        Output: A single high-resolution, photorealistic, compliant portrait.
        `;
        singleImageAction(passportPrompt, 'passport-photo', activeImage);
    }
    const handleInpaint = () => multiImageAction(`In the first image provided, use the second image as a mask. The white area of the mask indicates the region to be modified. Replace the masked region with the following description: "${prompt}". The result should blend seamlessly and realistically with the original image's lighting, texture, and style.`, 'edit', activeImage, maskImage);
    const handleRetouch = () => multiImageAction(`In the first image provided, use the second image as a mask. The white area of the mask indicates the region to be removed. Intelligently remove the masked content (like skin blemishes, unwanted objects, or text) and fill the area by realistically generating content that matches the surrounding lighting, texture, and style. This is a magic eraser tool. The rest of the image must remain untouched.`, 'retouch', activeImage, maskImage);
    const handleReplicate = () => singleImageAction(`In the provided image, find and replace "${textToReplace}" with "${prompt}". The replacement must perfectly match the style, color, perspective, lighting, and texture of the surrounding elements. The rest of the image must remain untouched.`, 'edit', activeImage);

    // Fix: Define handleFaceSwap
    const handleFaceSwap = () => multiImageAction(
        `Swap the face in the second image (target) with the face from the first image (source). Ensure a realistic and seamless blend, maintaining natural lighting, skin tone, and expression from the target image where possible.`,
        'face-swap',
        faceImage, // Source face
        activeImage // Target image
    );

    // Fix: Define handleRestore
    const handleRestore = () => singleImageAction(
        `Restore and enhance this old photograph. Automatically detect and repair damage such as scratches, tears, fading, and discoloration. Enhance clarity, sharpness, and contrast while preserving the original historical feel and authenticity. Improve overall image quality, color accuracy, and detail.`,
        'restore',
        activeImage
    );

    const handleExtractText = () => runAI(async () => {
        if (!activeImage) { setError('Please upload an image.'); return; }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [ { text: "Extract all text from this image accurately, maintaining original formatting." }, { inlineData: { data: activeImage.base64, mimeType: activeImage.mimeType } } ] },
        });
        // Changed from result.text to result.text || '' to handle potential undefined.
        setExtractedText(result.text || '');
        // Extracting text is not an image generation/edit, so it doesn't modify generatedImage or the edit stack
    });
    
    const handleAnalyze = () => runAI(async () => {
        if (!activeImage) { setError('Please upload an image.'); return; }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [ { text: "Describe this image in detail for an AI image generation prompt. Be vivid about subject, setting, lighting, colors, style, and composition." }, { inlineData: { data: activeImage.base64, mimeType: activeImage.mimeType } } ] },
        });
        // Changed from result.text.trim() to result.text?.trim() || '' to handle potential undefined.
        setPrompt(result.text?.trim() || '');
        setMode('generate');
        // Analyzing image to generate a prompt for 'generate' mode resets the output panel
        // and starts a fresh conceptual chain for the *next* generation.
        resetOutputs(); 
        setError('Prompt generated! You can now edit it and create your image.');
    });

    const handleUndo = useCallback(() => {
        if (editStackIndex > 0) {
            const newIndex = editStackIndex - 1;
            setGeneratedImage(editStack[newIndex]);
            setEditStackIndex(newIndex);
        }
    }, [editStack, editStackIndex]);

    const handleRedo = useCallback(() => {
        if (editStackIndex < editStack.length - 1) {
            const newIndex = editStackIndex + 1;
            setGeneratedImage(editStack[newIndex]);
            setEditStackIndex(newIndex);
        }
    }, [editStack, editStackIndex]);

    const handleSpeakGeneratedImage = () => {
        if (generatedImage) {
            const textToSpeak = `Generated image details: Prompt: "${generatedImage.prompt}". Type: ${generatedImage.type}. Created: ${generatedImage.createdAt}.`;
            speakText(textToSpeak);
        }
    };

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
                            onClick={() => {
                                onSelect(img);
                                resetOutputs(); // Clear output and edit stack when selecting a different input image
                            }}
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
        'passport-photo': { title: 'Passport Photo Generator', description: 'Create professional, compliant passport photos for 90+ countries.', icon: AdjustmentsIcon },
        'extract-text': { title: 'Extract Text (OCR)', description: 'Pull text from any image using Optical Character Recognition (OCR).', icon: TextScanIcon },
        analyze: { title: 'Analyze Image', description: 'Generate a detailed prompt from an existing image.', icon: AnalyzeIcon },
        upscale: { title: 'AI Super Enlargement', description: 'Increase the resolution of your images while enhancing details.', icon: UpscaleIcon },
        converter: { title: 'Image Converter', description: 'Convert images between formats like JPG, PNG, and WEBP.', icon: SwapIcon },
        'print-layout': { title: 'Print Layout', description: 'Arrange and template images for printing on standard paper sizes.', icon: ScissorsIcon },
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
        if(mode === 'converter' || mode === 'print-layout') return; // Converter and Print Layout have their own buttons
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

    // Helper to draw an image centered and cropped within a target rectangle
    const drawImageCenteredCrop = useCallback((
        ctx: CanvasRenderingContext2D,
        img: HTMLImageElement,
        x: number,
        y: number,
        width: number,
        height: number
    ) => {
        const imgAspectRatio = img.width / img.height;
        const targetAspectRatio = width / height;

        let sx, sy, sWidth, sHeight; // Source rectangle on the image
        
        if (imgAspectRatio > targetAspectRatio) {
            // Image is wider than the target area, crop left/right
            sHeight = img.height;
            sWidth = img.height * targetAspectRatio;
            sx = (img.width - sWidth) / 2;
            sy = 0;
        } else {
            // Image is taller than the target area, crop top/bottom
            sWidth = img.width;
            sHeight = img.width / targetAspectRatio;
            sx = 0;
            sy = (img.height - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, width, height);
    }, []);

    const drawCropMarks = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, markLength: number = a4ToPixels(5)) => {
        ctx.strokeStyle = 'rgba(128,128,128,0.5)'; // Light grey, semi-transparent
        ctx.lineWidth = 1;

        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(x, y + markLength);
        ctx.lineTo(x, y);
        ctx.lineTo(x + markLength, y);
        ctx.stroke();

        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(x + width - markLength, y);
        ctx.lineTo(x + width, y);
        ctx.lineTo(x + width, y + markLength);
        ctx.stroke();

        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(x + width, y + height - markLength);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x + width - markLength, y + height);
        ctx.stroke();

        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(x + markLength, y + height);
        ctx.lineTo(x, y + height);
        ctx.lineTo(x, y + height - markLength);
        ctx.stroke();
    }, []);

    // Print Layout Logic
    const drawPrintLayout = useCallback((imageSource: GeneratedImage | UploadedFile | null, template: PrintTemplateType, orientation: typeof pageOrientation, paper: typeof paperSize) => {
        const canvas = printCanvasRef.current;
        if (!canvas || !imageSource) {
            // setError('No image or canvas available for printing.'); // Avoid constant error if no image selected yet
            return;
        }

        const paperDimensionsMM = PAPER_SIZES_MM[paper];
        let canvasWidth = a4ToPixels(orientation === 'landscape' ? paperDimensionsMM.width : paperDimensionsMM.height);
        let canvasHeight = a4ToPixels(orientation === 'landscape' ? paperDimensionsMM.height : paperDimensionsMM.width);

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setError('Could not get canvas context.');
            return;
        }

        // Clear canvas and set white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const img = new Image();
        img.src = 'src' in imageSource ? imageSource.src : imageSource.url;
        img.onload = () => {
            setError(''); // Clear previous error
            
            const margin = a4ToPixels(10); // 10mm margin for all templates
            const smallMargin = a4ToPixels(5); // 5mm margin for grids
            const cropMarkLength = a4ToPixels(5); // 5mm crop marks

            // Photo sizes in pixels
            const photo4x6inW = a4ToPixels(PAPER_SIZES_MM['4x6in'].width); // 4 inches (shorter side)
            const photo4x6inH = a4ToPixels(PAPER_SIZES_MM['4x6in'].height); // 6 inches (longer side)
            const photo5x7inW = a4ToPixels(127);
            const photo5x7inH = a4ToPixels(177.8);
            const passport2x2in = a4ToPixels(50.8); // 2 inches
            const passport35mmW = a4ToPixels(35);
            const passport45mmH = a4ToPixels(45);
            const wallet2x3inW = a4ToPixels(WALLET_PHOTO_WIDTH_MM); // 2 inches
            const wallet2x3inH = a4ToPixels(WALLET_PHOTO_HEIGHT_MM); // 3 inches

            const drawGrid = (
                itemWidth: number,
                itemHeight: number,
                innerMargin: number = smallMargin
            ) => {
                let currentX = margin;
                let currentY = margin;

                while (currentY + itemHeight <= canvas.height - margin) {
                    while (currentX + itemWidth <= canvas.width - margin) {
                        drawImageCenteredCrop(ctx, img, currentX, currentY, itemWidth, itemHeight);
                        drawCropMarks(ctx, currentX, currentY, itemWidth, itemHeight, cropMarkLength);
                        currentX += itemWidth + innerMargin;
                    }
                    currentX = margin;
                    currentY += itemHeight + innerMargin;
                }
            };

            switch (template) {
                case 'full-page': {
                    drawImageCenteredCrop(ctx, img, 0, 0, canvasWidth, canvasHeight);
                    break;
                }
                case '4x6-grid': {
                    // This is for multiple 4x6" photos (e.g. on an A4 sheet)
                    // If the target paper size itself is 4x6, it's just one full page 4x6
                    if (paper === '4x6in') {
                        drawImageCenteredCrop(ctx, img, 0, 0, canvasWidth, canvasHeight);
                    } else {
                        drawGrid(photo4x6inW, photo4x6inH);
                    }
                    break;
                }
                case '5x7-grid': {
                    if (paper === '5x7in') {
                         drawImageCenteredCrop(ctx, img, 0, 0, canvasWidth, canvasHeight);
                    } else {
                        drawGrid(photo5x7inW, photo5x7inH);
                    }
                    break;
                }
                case 'passport-grid': {
                    drawGrid(passport2x2in, passport2x2in);
                    break;
                }
                case 'passport-35x45-grid': {
                    drawGrid(passport35mmW, passport45mmH);
                    break;
                }
                case 'wallet-grid': {
                    drawGrid(wallet2x3inW, wallet2x3inH);
                    break;
                }
            }
        };
        img.onerror = () => {
            setError('Could not load image for print layout. Please ensure it is valid.');
        };
    }, [drawImageCenteredCrop, drawCropMarks, pageOrientation, paperSize]);

    // Redraw layout whenever relevant states change
    useEffect(() => {
        if (mode === 'print-layout' && selectedPrintImage) {
            drawPrintLayout(selectedPrintImage, printTemplate, pageOrientation, paperSize);
        }
    }, [mode, selectedPrintImage, printTemplate, pageOrientation, paperSize, drawPrintLayout]);

    // When paper size or orientation changes, reset template to a default for that configuration
    useEffect(() => {
        // Reset template to a sensible default based on new paper size/orientation
        setPrintTemplate('full-page');
        // Redraw layout if an image is already selected
        if (selectedPrintImage) {
            drawPrintLayout(selectedPrintImage, 'full-page', pageOrientation, paperSize);
        }
    }, [paperSize, pageOrientation, selectedPrintImage, drawPrintLayout]);


    const handlePrint = () => {
        const canvas = printCanvasRef.current;
        if (!canvas) {
            setError('No layout to print.');
            return;
        }

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Print Layout</title></head><body>');
            printWindow.document.write(`<img src="${canvas.toDataURL('image/png')}" style="max-width:100%; height:auto;">`);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.onload = () => {
                printWindow.print();
                printWindow.close();
            };
        } else {
            setError('Could not open print window. Please allow pop-ups.');
        }
    };

    const handleDownloadLayout = () => {
        const canvas = printCanvasRef.current;
        if (!canvas) {
            setError('No layout to download.');
            return;
        }
        const dataURL = canvas.toDataURL(`image/${downloadFormat}`, downloadQuality);
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = `zma-ai-print-layout-${paperSize}-${printTemplate}-${Date.now()}.${downloadFormat === 'jpeg' ? 'jpg' : 'png'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const selectImageForPrintLayout = (image: GeneratedImage | UploadedFile) => {
        setSelectedPrintImage(image);
        // Automatically generate layout upon selection (handled by useEffect)
    };

    const getAvailablePrintTemplates = (currentPaperSize: typeof paperSize, currentOrientation: typeof pageOrientation) => {
        const templates: { value: PrintTemplateType, label: string }[] = [{ value: 'full-page', label: 'Full Page' }];

        // General grids applicable to larger sheets
        if (currentPaperSize === 'A4' || currentPaperSize === '5x6in') {
            templates.push({ value: '4x6-grid', label: 'Multiple 4x6" Photos' });
        }
        
        if (currentPaperSize === 'A4') {
             templates.push({ value: '5x7-grid', label: 'Multiple 5x7" Photos' });
        }

        if (currentPaperSize !== '5x7in') {
             templates.push({ value: 'passport-grid', label: 'Multiple 2x2" (US) Passport Photos' });
             templates.push({ value: 'passport-35x45-grid', label: 'Multiple 35x45mm (EU/UK) Passport Photos' });
             templates.push({ value: 'wallet-grid', label: 'Multiple 2x3" Wallet Photos' });
        }

        if (currentPaperSize === '4x6in') {
             // For a 4x6in sheet, a "4x6 grid" means a single 4x6 photo, already covered by full page if orientation matches, but good to be explicit
        } 
        
        return templates;
    };


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
                                <span className="capitalize">{modeConfig[key].title.replace('AI ', '').replace(' Image', '')}</span> {/* Refined label */}
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
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Country Standard</label>
                                <select value={passportSettings.country} onChange={(e) => setPassportSettings(s => ({...s, country: e.target.value}))} className="w-full input-glow rounded-xl p-3 text-white">
                                    {Object.entries(passportStandards).map(([country, std]) => (
                                        <option key={country} value={country}>{country} - {std.size}</option>
                                    ))}
                                </select>
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Subject Type</label>
                                <select value={passportSettings.personType} onChange={(e) => setPassportSettings(s => ({...s, personType: e.target.value as 'Man' | 'Woman' | 'Boy' | 'Girl' | 'Infant'}))} className="w-full input-glow rounded-xl p-3 text-white">
                                    {['Man', 'Woman', 'Boy', 'Girl', 'Infant'].map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Background</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['White', 'Light Grey', 'Blue', 'Off-White'].map(color => (
                                        <button key={color} onClick={() => setPassportSettings(s => ({...s, background: color}))} className={`p-2 rounded-lg text-sm capitalize transition-colors ${passportSettings.background === color ? 'bg-cyan-500 text-white ring-2 ring-cyan-300' : 'bg-[var(--bg-tertiary)]'}`}>{color}</button>
                                    ))}
                                </div>
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Attire Change</label>
                                <select value={passportSettings.attire} onChange={(e) => setPassportSettings(s => ({...s, attire: e.target.value}))} className="w-full input-glow rounded-xl p-3 text-white">
                                    {(attireOptions[passportSettings.personType] || attireOptions.Man).map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
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
                    
                    {['generate', 'edit', 'restore', 'extract-text', 'analyze', 'adjust', 'background-removal', 'replicate', 'upscale', 'converter', 'passport-photo'].includes(mode) && uploadedImages.length > 0 && (
                        <UploadedFilesTray images={uploadedImages} activeImageUrl={activeImage?.url || null} onSelect={setActiveImage}
                            onRemove={(urlToRemove) => {
                                setUploadedImages(prev => prev.filter(img => img.url !== urlToRemove));
                                if (activeImage?.url === urlToRemove) {
                                    setActiveImage(uploadedImages.length > 1 ? uploadedImages.find(img => img.url !== urlToRemove)! : null);
                                }
                                resetOutputs(); // Reset outputs when an input image is removed
                            }}
                        />
                    )}
                    
                    {mode === 'adjust' && <AdjustmentsPanel adjustments={adjustments} onChange={(key, value) => setAdjustments(prev => ({...prev, [key]: value}))} />}

                    {mode === 'converter' && <ImageConverter activeImage={activeImage} onError={setError} />}

                    {mode === 'print-layout' && (
                        <div className="space-y-4">
                            <p className="text-sm text-[var(--text-secondary)]">Select an image and a template to create a printable layout.</p>
                            <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl space-y-3">
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Select Image for Print</label>
                                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                                    {(activeImage ? [activeImage] : []).concat(uploadedImages.filter(img => img.url !== activeImage?.url)).map(img => (
                                        <img key={img.url} src={img.url} alt="Print source"
                                            className={`w-16 h-16 object-cover rounded-md cursor-pointer border-2 ${selectedPrintImage && 'url' in selectedPrintImage && selectedPrintImage.url === img.url ? 'border-cyan-400' : 'border-transparent'}`}
                                            onClick={() => selectImageForPrintLayout(img)} />
                                    ))}
                                    {generatedImage && (
                                        <img key={generatedImage.id} src={generatedImage.src} alt="Generated for print"
                                            className={`w-16 h-16 object-cover rounded-md cursor-pointer border-2 ${selectedPrintImage && 'id' in selectedPrintImage && selectedPrintImage.id === generatedImage.id ? 'border-cyan-400' : 'border-transparent'}`}
                                            onClick={() => selectImageForPrintLayout(generatedImage)} />
                                    )}
                                    {sessionHistory.filter(img => ![activeImage?.url, generatedImage?.src].includes(img.src)).map(img => (
                                        <img key={img.id} src={img.src} alt="History for print"
                                            className={`w-16 h-16 object-cover rounded-md cursor-pointer border-2 ${selectedPrintImage && 'id' in selectedPrintImage && selectedPrintImage.id === img.id ? 'border-cyan-400' : 'border-transparent'}`}
                                            onClick={() => selectImageForPrintLayout(img)} />
                                    ))}
                                    {!activeImage && !generatedImage && uploadedImages.length === 0 && sessionHistory.length === 0 && <p className="text-xs text-[var(--text-secondary)] px-2">Upload or generate an image first.</p>}
                                </div>
                            </div>

                            {selectedPrintImage && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Paper Size</label>
                                        <select value={paperSize} onChange={(e) => setPaperSize(e.target.value as typeof paperSize)} className="w-full input-glow rounded-xl p-3 text-white">
                                            {Object.keys(PAPER_SIZES_MM).map(size => (
                                                <option key={size} value={size}>{size === 'A4' ? 'A4 (210x297mm)' : size.replace('in', '"').replace('x', 'x')}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Page Orientation</label>
                                        <div className="flex items-center gap-2 rounded-full bg-[var(--bg-tertiary)] p-1">
                                            <button onClick={() => setPageOrientation('landscape')} className={`flex-1 text-center text-sm font-semibold p-2 rounded-full transition-colors ${pageOrientation === 'landscape' ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white' : 'text-gray-300'}`}>Landscape</button>
                                            <button onClick={() => setPageOrientation('portrait')} className={`flex-1 text-center text-sm font-semibold p-2 rounded-full transition-colors ${pageOrientation === 'portrait' ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white' : 'text-gray-300'}`}>Portrait</button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Select Template</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {getAvailablePrintTemplates(paperSize, pageOrientation).map(templateOption => (
                                                <button key={templateOption.value} onClick={() => setPrintTemplate(templateOption.value)}
                                                    className={`p-3 rounded-xl transition-colors ${printTemplate === templateOption.value ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white' : 'bg-[var(--bg-tertiary)] text-gray-300 hover:bg-[var(--border-primary)]'}`}>
                                                    {templateOption.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Download Format</label>
                                        <div className="flex items-center gap-2 rounded-full bg-[var(--bg-tertiary)] p-1">
                                            <button onClick={() => {setDownloadFormat('png'); setDownloadQuality(1);}} className={`flex-1 text-center text-sm font-semibold p-2 rounded-full transition-colors ${downloadFormat === 'png' ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white' : 'text-gray-300'}`}>PNG</button>
                                            <button onClick={() => {setDownloadFormat('jpeg'); setDownloadQuality(0.9);}} className={`flex-1 text-center text-sm font-semibold p-2 rounded-full transition-colors ${downloadFormat === 'jpeg' ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white' : 'text-gray-300'}`}>JPG</button>
                                        </div>
                                    </div>
                                    {downloadFormat === 'jpeg' && (
                                        <div>
                                            <label htmlFor="downloadQuality" className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] mb-2">Quality: <span className="font-bold text-white">{Math.round(downloadQuality * 100)}%</span></label>
                                            <input id="downloadQuality" type="range" min="0.1" max="1" step="0.05" value={downloadQuality} onChange={(e) => setDownloadQuality(Number(e.target.value))} className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]" />
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <button onClick={handlePrint} disabled={!selectedPrintImage} className="btn-3d flex-1">
                                            Print Layout
                                        </button>
                                        <button onClick={handleDownloadLayout} disabled={!selectedPrintImage} className="btn-3d flex-1">
                                            Download Layout
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {error && <p className="text-sm text-[var(--danger-primary)]">{error}</p>}
                    
                    {mode !== 'converter' && mode !== 'print-layout' && (
                        <div className="pt-4 border-t border-[var(--border-primary)]">
                            <button onClick={handleSubmit} disabled={isSubmitDisabled} className="btn-3d flex items-center justify-center gap-2 w-full">
                                {React.createElement(modeConfig[mode].icon, { className: "w-5 h-5" })}
                                <span className="capitalize">{modeConfig[mode].title.replace('AI ', '')}</span> {/* Refined label */}
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
                        {!isLoading && mode === 'print-layout' && (
                            <div className="w-full h-full flex items-center justify-center bg-[var(--bg-tertiary)] rounded-2xl p-4">
                                <canvas ref={printCanvasRef}
                                    style={{ 
                                        width: '100%', 
                                        height: 'auto', 
                                        border: '1px solid var(--border-primary)', 
                                    }}
                                    className="shadow-lg"
                                />
                            </div>
                        )}
                        {!isLoading && !generatedImage && !extractedText && mode !== 'print-layout' && (
                             mode === 'generate' && !activeImage ? (
                                <div className="w-full grid grid-cols-2 lg:grid-cols-3 gap-2">
                                    {placeholders.map(p => (
                                        <div key={p.aspectRatio} className="relative group cursor-pointer" onClick={() => {handleAspectRatioChange(p.aspectRatio); setPrompt(p.prompt); resetOutputs();}}>
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
                                {/* Undo/Redo buttons */}
                                <button onClick={handleUndo} disabled={editStackIndex <= 0 || isLoading} className="flex items-center justify-center gap-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] text-white font-bold py-2 px-3 rounded-full transition-colors disabled:opacity-50 text-sm" aria-label="Undo">
                                    <UndoIcon className="w-4 h-4" /> Undo
                                </button>
                                <button onClick={handleRedo} disabled={editStackIndex >= editStack.length - 1 || isLoading} className="flex items-center justify-center gap-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] text-white font-bold py-2 px-3 rounded-full transition-colors disabled:opacity-50 text-sm" aria-label="Redo">
                                    <RedoIcon className="w-4 h-4" /> Redo
                                </button>
                                {/* Speak details */}
                                <button onClick={handleSpeakGeneratedImage} className="flex items-center justify-center gap-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] text-white font-bold py-2 px-3 rounded-full transition-colors disabled:opacity-50 text-sm" aria-label="Speak generated image details">
                                    <SpeakerWaveIcon className="w-4 h-4" /> Speak
                                </button>
                                {/* Existing buttons */}
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
                                {/* Download section: inline format/quality options */}
                                <div className="flex flex-col items-center gap-1">
                                    <button onClick={() => handleDownload(generatedImage)} className="flex items-center justify-center gap-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] text-white font-bold py-2 px-3 rounded-full transition-colors text-sm">
                                        <DownloadIcon className="w-4 h-4" /> Download ({downloadFormat.toUpperCase()})
                                    </button>
                                    <div className="flex items-center gap-1 bg-[var(--bg-primary)] p-1 rounded-full text-xs">
                                        <button 
                                            onClick={() => { setDownloadFormat('png'); setDownloadQuality(1); }} 
                                            className={`p-1 px-2 rounded-full ${downloadFormat === 'png' ? 'bg-cyan-500 text-white' : 'text-[var(--text-secondary)]'}`}
                                        >PNG</button>
                                        <button 
                                            onClick={() => { setDownloadFormat('jpeg'); setDownloadQuality(0.9); }} 
                                            className={`p-1 px-2 rounded-full ${downloadFormat === 'jpeg' ? 'bg-cyan-500 text-white' : 'text-[var(--text-secondary)]'}`}
                                        >JPG</button>
                                    </div>
                                    {downloadFormat === 'jpeg' && (
                                        <div className="w-full text-center mt-1">
                                            <label htmlFor="downloadQualityInlineGenerated" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Quality: {Math.round(downloadQuality * 100)}%</label>
                                            <input id="downloadQualityInlineGenerated" type="range" min="0.1" max="1" step="0.05" value={downloadQuality} onChange={(e) => setDownloadQuality(Number(e.target.value))} className="w-full h-1 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-cyan-400" />
                                        </div>
                                    )}
                                </div>
                                {mode === 'passport-photo' && (
                                     <button onClick={() => { selectImageForPrintLayout(generatedImage); setMode('print-layout'); }} className="flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-bold py-2 px-3 rounded-full transition-colors text-sm">
                                        <ScissorsIcon className="w-4 h-4" /> Go to Print Layout
                                    </button>
                                )}
                            </div>
                        )}
                        {!isLoading && generatedImage && complianceReport && mode === 'passport-photo' && (
                            <div className="w-full p-4 bg-[var(--bg-tertiary)] rounded-xl mt-4 text-sm text-[var(--text-secondary)]">
                                <h4 className="font-bold text-white mb-2">Compliance Report:</h4>
                                <pre className="whitespace-pre-wrap">{complianceReport}</pre>
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
                                    {sessionHistory.length > 0 && (
                                        <button 
                                            onClick={() => { if(window.confirm('Are you sure you want to clear the session history?')) setSessionHistory([]); }} 
                                            className="p-1.5 rounded-full text-[var(--text-secondary)] hover:text-white hover:bg-[var(--border-primary)] transition-colors" 
                                            aria-label="Clear history"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                                    {sessionHistory.length === 0 ? (
                                        <p className="text-center text-sm text-[var(--text-secondary)] p-4">Your generated images will appear here.</p>
                                    ) : (
                                        sessionHistory.map(item => (
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
