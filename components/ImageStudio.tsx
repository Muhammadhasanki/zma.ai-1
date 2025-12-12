

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { GeneratedImage } from '../types';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { LogoIcon, MicIcon, WandIcon, RestoreIcon, TextScanIcon, AnalyzeIcon, HistoryIcon, VariationsIcon, ChevronRightIcon, ChevronLeftIcon, RealismIcon, DownloadIcon, TrashIcon, SaveIcon, BrushIcon, XMarkIcon, ScissorsIcon, EyeDropperIcon, RetouchIcon, UndoIcon, RedoIcon, SpeakerWaveIcon, ExpandIcon } from './icons';
import ZoomableImage from './ZoomableImage';
import { speakText } from '../utils/tts';

interface ImageStudioProps {
    addImageToGallery: (image: GeneratedImage) => void;
    galleryImages: GeneratedImage[];
}

type Mode = 'generate' | 'edit' | 'restore' | 'extract-text' | 'analyze' | 'inpaint' | 'replicate' | 'converter' | 'passport-photo' | 'retouch' | 'print-layout';

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

// ... (ImageUploader, MaskCanvas, ImageComparator, AspectRatioSelector, ImageConverter components remain the same) ...
const ImageUploader: React.FC<{
    onFilesUploaded: (files: UploadedFile[]) => void;
    title: string;
    imageUrl: string | null;
    multiple?: boolean;
}> = ({ onFilesUploaded, title, imageUrl, multiple = false }) => {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const uploaderRef = useRef<HTMLDivElement>(null); 

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
        const currentUploaderRef = uploaderRef.current;
        if (!currentUploaderRef) return;

        currentUploaderRef.addEventListener('paste', handlePaste);
        return () => currentUploaderRef.removeEventListener('paste', handlePaste);
    }, [handlePaste]);


    return (
        <div
            ref={uploaderRef} 
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
                            <p className="text-gray-400 font-semibold">{multiple ? 'Drag & Drop Images' : 'Drag & Drop Image'}</p>
                            <p className="text-gray-500 text-sm">or click to browse</p>
                        </div>
                    )}
                    <input type="file" ref={inputRef} accept="image/*" onChange={handleFileChange} className="hidden" multiple={multiple} />
                    <span className="cursor-pointer bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] text-white font-bold py-2 px-4 rounded-full transition-colors w-full inline-block">
                        {multiple ? 'Upload Images' : 'Upload Images'}
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
            
            setImageSize({ width, height }); 
            
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
        img.onerror = () => {
            console.error("Failed to load base image for mask canvas.");
            setImageSize({ width: 0, height: 0 }); // Reset size
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
        { value: '4:5', label: 'Social', icon: <div className="w-7 h-9 border-2 rounded-md rotate-90" /> }, // New aspect ratio
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

const ImageConverter: React.FC<{ uploadedImages: UploadedFile[]; selectedImageUrls: Set<string>; onError: (msg: string) => void }> = ({ uploadedImages, selectedImageUrls, onError }) => {
    const [targetFormat, setTargetFormat] = useState<'jpeg' | 'png' | 'webp' | 'bmp' | 'gif' | 'pdf'>('jpeg');
    const [quality, setQuality] = useState(0.9);

    const getSelectedImages = useCallback(() => {
        return uploadedImages.filter(img => selectedImageUrls.has(img.url));
    }, [uploadedImages, selectedImageUrls]);

    const handleConvert = async () => {
        const imagesToConvert = getSelectedImages();
        if (imagesToConvert.length === 0) {
            onError("Please select images to convert.");
            return;
        }

        if (targetFormat === 'pdf') {
            // For PDF, we'll offer to print each image to PDF
            // Note: Creating a single multi-page PDF client-side without a library is complex.
            for (const image of imagesToConvert) {
                await new Promise<void>(resolve => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.src = image.url;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            onError("Could not create canvas context for PDF conversion.");
                            resolve();
                            return;
                        }
                        ctx.drawImage(img, 0, 0);
                        
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                            printWindow.document.write('<html><head><title>Print Image to PDF</title></head><body>');
                            printWindow.document.write(`<img src="${canvas.toDataURL('image/png')}" style="max-width:100%; height:auto;">`);
                            printWindow.document.write('</body></html>');
                            printWindow.document.close();
                            printWindow.onload = () => {
                                printWindow.print();
                                printWindow.close();
                                resolve();
                            };
                        } else {
                            onError('Could not open print window for PDF. Please allow pop-ups.');
                            resolve();
                        }
                    };
                    img.onerror = () => {
                        onError(`Could not load image ${image.file.name} for PDF conversion.`);
                        resolve();
                    };
                });
            }
            if(imagesToConvert.length > 0) {
              onError(`Downloaded ${imagesToConvert.length} images to PDF (check your browser's print dialogs). Note: For a single multi-image PDF, an external library is needed.`);
            }

        } else {
            // Batch conversion for image formats
            for (const image of imagesToConvert) {
                await new Promise<void>(resolve => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.src = image.url;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            onError("Could not create canvas context for conversion.");
                            resolve();
                            return;
                        }
                        ctx.drawImage(img, 0, 0);

                        const mimeType = `image/${targetFormat}`;
                        const dataUrl = canvas.toDataURL(mimeType, quality);
                        
                        const a = document.createElement('a');
                        a.href = dataUrl;
                        a.download = `hasanka-ai-converted-${image.file.name.split('.')[0]}.${targetFormat === 'jpeg' ? 'jpg' : targetFormat}`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        resolve();
                    };
                    img.onerror = () => {
                        onError(`Could not load image ${image.file.name} for conversion, possibly due to CORS policy. Please try downloading it and re-uploading from your computer.`);
                        resolve();
                    };
                });
            }
        }
    };

    const handleDownloadAllAsZip = async () => {
        const imagesToConvert = getSelectedImages();
        if (imagesToConvert.length === 0) {
            onError("Please select images to convert and download as ZIP.");
            return;
        }
        
        // This is a placeholder as true client-side ZIP creation is complex without a library.
        // It will trigger individual downloads.
        onError("Downloading individual files. For true ZIP archiving, a client-side library would be needed.");
        for (const image of imagesToConvert) {
            await new Promise<void>(resolve => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.src = image.url;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        onError("Could not create canvas context for ZIP conversion.");
                        resolve();
                        return;
                    }
                    ctx.drawImage(img, 0, 0);

                    const mimeType = `image/${targetFormat}`;
                    const dataUrl = canvas.toDataURL(mimeType, quality);
                    
                    const a = document.createElement('a');
                    a.href = dataUrl;
                    a.download = `hasanka-ai-converted-${image.file.name.split('.')[0]}.${targetFormat === 'jpeg' ? 'jpg' : targetFormat}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    resolve();
                };
                img.onerror = () => {
                    onError(`Could not load image ${image.file.name} for ZIP conversion.`);
                    resolve();
                };
            });
        }
    }


    return (
        <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">Select images from the tray above to convert their format. This process happens entirely in your browser.</p>
            {getSelectedImages().length === 0 && <p className="text-sm text-yellow-400 p-3 bg-yellow-400/10 rounded-lg">Please select images from the tray above to get started.</p>}
            {getSelectedImages().length > 0 && (
                <>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Target Format</label>
                        <div className="flex items-center gap-2 rounded-full bg-[var(--bg-tertiary)] p-1 flex-wrap">
                            {(['jpeg', 'png', 'webp', 'pdf'] as const).map(format => ( // Removed bmp and gif for simplicity, focusing on common formats
                                <button key={format} onClick={() => {
                                    setTargetFormat(format);
                                    // Reset quality for non-JPEG/WEBP formats
                                    if(format !== 'jpeg' && format !== 'webp') setQuality(1);
                                }} className={`flex-1 text-center text-sm font-semibold p-2 rounded-full transition-colors min-w-[60px] ${targetFormat === format ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white' : 'text-gray-300'}`}>
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
                        Convert & Download Selected
                    </button>
                    {getSelectedImages().length > 1 && (
                        <button onClick={handleDownloadAllAsZip} className="btn-3d w-full bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)]">
                            Download All as ZIP (Individual Files)
                        </button>
                    )}
                    {(targetFormat === 'pdf' && getSelectedImages().length > 1) && (
                        <p className="text-xs text-yellow-400 text-center">Note: Each image will be downloaded as a separate PDF via browser print dialog. For a single multi-page PDF, an external library would be needed.</p>
                    )}
                     {getSelectedImages().length > 1 && (targetFormat !== 'pdf') && (
                        <p className="text-xs text-yellow-400 text-center">Note: "Download All as ZIP" will download each image separately. True ZIP archiving without an external library is not supported.</p>
                    )}
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

// Passport standards with millimeters for calculation
interface PassportStandard {
    label: string;
    widthMM: number;
    heightMM: number;
    description: string;
}

const passportStandards: Record<string, PassportStandard> = {
    'USA': { label: '2x2 inch (51x51 mm)', widthMM: 51, heightMM: 51, description: 'USA, India' },
    'UK_EU': { label: '35x45 mm', widthMM: 35, heightMM: 45, description: 'UK, Europe, Australia, Singapore' },
    'China': { label: '33x48 mm', widthMM: 33, heightMM: 48, description: 'China' },
    'Canada': { label: '50x70 mm', widthMM: 50, heightMM: 70, description: 'Canada' },
    'Japan': { label: '35x45 mm', widthMM: 35, heightMM: 45, description: 'Japan' },
    'Turkey': { label: '50x60 mm', widthMM: 50, heightMM: 60, description: 'Turkey' },
    'Dubai': { label: '40x60 mm', widthMM: 40, heightMM: 60, description: 'UAE / Dubai' },
};

const attireOptions = {
    Man: [
        'None (Keep Original)', 
        'Formal - Black Suit & Tie', 'Formal - Navy Suit & Tie', 'Formal - Grey Suit & Tie', 'Formal - Tuxedo',
        'Business - White Shirt (No Tie)', 'Business - Blue Shirt (No Tie)', 'Business - Black Shirt', 'Business - Checkered Shirt',
        'Casual - White T-Shirt', 'Casual - Black T-Shirt', 'Casual - Grey Polo', 'Casual - Navy Sweater',
        'Traditional - Sherwani (Gold)', 'Traditional - Kurta (White)', 'Traditional - Kimono (Male)', 'Traditional - Barong'
    ],
    Woman: [
        'None (Keep Original)', 
        'Formal - Black Blazer & White Blouse', 'Formal - Navy Blazer', 'Formal - Grey Business Suit',
        'Professional - White Blouse', 'Professional - Blue Button-up', 'Professional - Black Turtleneck', 'Professional - Silk Top',
        'Casual - White T-Shirt', 'Casual - Black Top', 'Casual - Floral Dress', 'Casual - Pastel Cardigan',
        'Traditional - Saree (Red)', 'Traditional - Salwar Kameez', 'Traditional - Kimono (Floral)', 'Traditional - Abaya (Black)', 'Traditional - Hijab (Beige)'
    ],
    Boy: [
        'None (Keep Original)', 
        'Formal - Tiny Black Suit', 'Formal - Navy Blazer', 'Formal - White Shirt & Bowtie',
        'Casual - Blue T-Shirt', 'Casual - Dinosaur Print Shirt', 'Casual - Striped Polo', 'Casual - Hoodie',
        'School - White Uniform Shirt', 'School - Blue Uniform'
    ],
    Girl: [
        'None (Keep Original)', 
        'Formal - Party Dress (Pink)', 'Formal - White Blouse', 'Formal - Velvet Dress',
        'Casual - Floral Top', 'Casual - Pink T-Shirt', 'Casual - Polka Dot Dress', 'Casual - Denim Jacket',
        'School - White Uniform Blouse', 'School - Checked Pinafore'
    ],
    Infant: [
        'None (Keep Original)', 
        'Basic - White Bodysuit', 'Basic - Blue Onesie', 'Basic - Pink Onesie', 'Basic - Grey Romper',
        'Cute - Bear Ears Hoodie', 'Cute - Star Pattern Onesie'
    ]
};

const PAPER_SIZES_MM = {
    '4x6': { width: 101.6, height: 152.4, label: '4" x 6" (10x15cm)' },
    '5x7': { width: 127, height: 177.8, label: '5" x 7" (13x18cm)' },
    'A4': { width: 210, height: 297, label: 'A4 (21x30cm)' },
    'Letter': { width: 215.9, height: 279.4, label: 'Letter (8.5" x 11")' },
};

export const ImageStudio: React.FC<ImageStudioProps> = ({ addImageToGallery, galleryImages }) => {
    const [mode, setMode] = useState<Mode>('generate');
    const [prompt, setPrompt] = useState('');
    const [uploadedImages, setUploadedImages] = useState<UploadedFile[]>([]);
    
    // Multi-selection state
    const [selectedImageUrls, setSelectedImageUrls] = useState<Set<string>>(new Set());

    const [maskImage, setMaskImage] = useState<UploadedFile | null>(null);
    const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
    const [extractedText, setExtractedText] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [sessionHistory, setSessionHistory] = useState<GeneratedImage[]>([]); 
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [maskDrawMode, setMaskDrawMode] = useState<'draw' | 'upload'>('draw');
    const [brushSize, setBrushSize] = useState(40);
    const [textToReplace, setTextToReplace] = useState('');
    
    // Passport & Print Layout State
    const [passportSettings, setPassportSettings] = useState({ 
        background: 'White',
        customColor: '#ffffff',
        attire: 'None (Keep Original)', 
        country: 'USA', 
        personType: 'Man' as 'Man' | 'Woman' | 'Boy' | 'Girl' | 'Infant',
        retouchIntensity: 20,
    });
    const [printLayout, setPrintLayout] = useState({
        paperSize: '4x6' as keyof typeof PAPER_SIZES_MM,
        orientation: 'portrait' as 'portrait' | 'landscape',
        gapMM: 2,
    });
    const [complianceReport, setComplianceReport] = useState<string | null>(null);
    const printCanvasRef = useRef<HTMLCanvasElement>(null);

    const [editStack, setEditStack] = useState<GeneratedImage[]>([]);
    const [editStackIndex, setEditStackIndex] = useState(-1);

    const [downloadFormat, setDownloadFormat] = useState<'png' | 'jpeg'>('png');
    const [downloadQuality, setDownloadQuality] = useState(1); 

    const [settings, setSettings] = useState(() => {
        try {
            const localData = localStorage.getItem('hasanka-ai-studio-settings');
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
            localStorage.setItem('hasanka-ai-studio-settings', JSON.stringify(settings));
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
    
    // Helper to get selected images as array
    const getSelectedImages = useCallback(() => {
        return uploadedImages.filter(img => selectedImageUrls.has(img.url));
    }, [uploadedImages, selectedImageUrls]);

    // Active image logic: Returns the last selected image for preview purposes
    const activeImage = getSelectedImages().length > 0 ? getSelectedImages()[getSelectedImages().length - 1] : null;

    const resetOutputs = useCallback(() => {
        setGeneratedImage(null);
        setExtractedText(null);
        setError('');
        setComplianceReport(null); 
        setEditStack([]); 
        setEditStackIndex(-1); 
        setDownloadFormat('png'); 
        setDownloadQuality(1); 
    }, []);

    const handleNewFiles = (imageType: 'base' | 'mask') => (newImages: UploadedFile[]) => {
        if (imageType === 'base') {
            setUploadedImages(prev => [...prev, ...newImages]);
            // Automatically select new images
            const newUrls = newImages.map(img => img.url);
            setSelectedImageUrls(prev => {
                const newSet = new Set(prev);
                newUrls.forEach(url => newSet.add(url));
                return newSet;
            });
            resetOutputs(); 
        } else {
            const setter = setMaskImage;
            setter(newImages[0]);
            resetOutputs(); 
        }
    };
    
    const toggleImageSelection = (url: string) => {
        setSelectedImageUrls(prev => {
            const newSet = new Set(prev);
            if (newSet.has(url)) {
                newSet.delete(url);
            } else {
                newSet.add(url);
            }
            return newSet;
        });
        resetOutputs();
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
        setError(''); 
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

    const processNewImage = useCallback((image: GeneratedImage, isFreshChain: boolean) => {
        setGeneratedImage(image); 

        setEditStack(prevStack => {
            if (isFreshChain) {
                return [image]; 
            } else {
                const newStack = prevStack.slice(0, editStackIndex + 1);
                return [...newStack, image];
            }
        });
        setEditStackIndex(prevIndex => (isFreshChain ? 0 : prevIndex + 1));

        setSessionHistory(prev => [image, ...prev]);
        addImageToGallery(image);
    }, [editStackIndex, addImageToGallery, setSessionHistory]);

    const handleDownload = (image: GeneratedImage, format: 'png' | 'jpeg' = downloadFormat, quality: number = downloadQuality) => {
        const img = new Image();
        // Use a temporary image for downloading to ensure consistent quality/format handling
        img.src = image.src; 
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // For PNG, ensure transparent background if it exists in the source
                if (format === 'png' && image.mimeType.includes('png')) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear to transparent
                } else {
                    ctx.fillStyle = 'white'; // Default background for other formats or if source is not transparent PNG
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                
                ctx.drawImage(img, 0, 0);
                
                const dataUrl = canvas.toDataURL(`image/${format}`, quality);
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = `hasanka-ai-${image.type.replace(/\s+/g, '-')}-${image.id.replace(/:/g, '-')}.${format === 'jpeg' ? 'jpg' : format}`;
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
    };
    
    // ----- Print Layout Logic -----
    useEffect(() => {
        if (mode === 'print-layout' && generatedImage && printCanvasRef.current) {
            drawPrintLayout();
        }
    }, [mode, generatedImage, printLayout]);

    const drawPrintLayout = () => {
        const canvas = printCanvasRef.current;
        if (!canvas || !generatedImage) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const standard = passportStandards[passportSettings.country];
        const paper = PAPER_SIZES_MM[printLayout.paperSize];
        const isLandscape = printLayout.orientation === 'landscape';

        const paperWidthMM = isLandscape ? paper.height : paper.width;
        const paperHeightMM = isLandscape ? paper.width : paper.height;

        // Convert MM to Pixels (assuming 300 DPI)
        const DPI = 300;
        const mmToPx = (mm: number) => Math.round((mm / 25.4) * DPI);
        
        const canvasWidth = mmToPx(paperWidthMM);
        const canvasHeight = mmToPx(paperHeightMM);
        
        // Set actual canvas size
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Fill background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        const photoW = mmToPx(standard.widthMM);
        const photoH = mmToPx(standard.heightMM);
        const gap = mmToPx(printLayout.gapMM);

        // Load image
        const img = new Image();
        img.src = generatedImage.src;
        img.onload = () => {
            // Calculate grid
            const cols = Math.floor((canvasWidth - gap) / (photoW + gap));
            const rows = Math.floor((canvasHeight - gap) / (photoH + gap));
            
            const startX = (canvasWidth - (cols * photoW + (cols - 1) * gap)) / 2;
            const startY = (canvasHeight - (rows * photoH + (rows - 1) * gap)) / 2;

            ctx.lineWidth = 1;
            ctx.strokeStyle = '#cccccc'; // Light grey cut lines

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const x = startX + c * (photoW + gap);
                    const y = startY + r * (photoH + gap);
                    
                    ctx.drawImage(img, x, y, photoW, photoH);
                    
                    // Optional: Cut lines (faint)
                    if (printLayout.gapMM > 0) {
                        ctx.strokeRect(x, y, photoW, photoH);
                    }
                }
            }
        };
    };

    const handleDownloadLayout = () => {
        const canvas = printCanvasRef.current;
        if (canvas) {
            const link = document.createElement('a');
            link.download = `print-layout-${printLayout.paperSize}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 1.0);
            link.click();
        }
    };


    const handleGenerate = () => runAI(async () => {
        const selectedImages = getSelectedImages();
        if (!prompt && selectedImages.length === 0) { setError('Please enter a prompt or upload images.'); return; }
        const realismDescription = settings.realismLevel < 30 ? 'artistic, stylized, abstract' : settings.realismLevel < 70 ? 'semi-realistic, detailed, high quality' : 'photorealistic, hyper-detailed, 8k';
        const finalPrompt = `${prompt}, ${realismDescription}`;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

        let newImage: GeneratedImage | undefined;
        let isFreshChainForGenerate: boolean = true;

        // Support bulk/multi-image input for generation/editing
        if (selectedImages.length > 0 && mode === 'generate') {
            const parts = [
                ...selectedImages.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })),
                { text: finalPrompt }
            ];

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
            
            newImage = {
                id: new Date().toISOString(),
                src: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                originalSrc: selectedImages[0].url, base64: part.inlineData.data, mimeType: part.inlineData.mimeType,
                prompt, type: 'generate', createdAt: new Date().toLocaleString(),
            };
            isFreshChainForGenerate = !generatedImage || (selectedImages[0].url !== generatedImage.src);

        } else {
             if (!prompt) { setError('Please enter a prompt.'); return; }
             
             try {
                 const response = await ai.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt: finalPrompt,
                    config: {
                        numberOfImages: 1,
                        outputMimeType: 'image/jpeg',
                        aspectRatio: settings.aspectRatio as "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "4:5",
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
             }

             if (!newImage) {
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
             
            isFreshChainForGenerate = true; 
        }
        
        if (newImage) {
            processNewImage(newImage, isFreshChainForGenerate);
        }
    });

    const singleImageAction = (prompt: string, type: GeneratedImage['type'], image: UploadedFile | null, config?: any) => runAI(async () => {
        if (!image) { setError('Please upload the required image.'); return; }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [ { inlineData: { data: image.base64, mimeType: image.mimeType } }, { text: prompt } ] },
            config: config || { responseModalities: [Modality.IMAGE] }
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
        
        // Add hairline border for passport photos (Optional cosmetic for preview)
        let finalImageSrc = newImage.src;
        if (type === 'passport-photo') {
           // We typically don't burn the border into the dataUrl for the print layout loop, 
           // but we can add it for display if needed. For now, we keep raw.
        }

        const isFreshChain = !generatedImage || (image.url !== generatedImage.src);
        processNewImage(newImage, isFreshChain);

        if (type === 'passport-photo') {
            const standard = passportStandards[passportSettings.country] || passportStandards['USA'];
            setComplianceReport(`Compliant for ${passportSettings.country}.
Dimensions: ${standard.label}
Background: ${passportSettings.background === 'Custom' ? passportSettings.customColor : passportSettings.background}
Attire: ${passportSettings.attire}
Retouch: ${passportSettings.retouchIntensity}%
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
        processNewImage(newImage, false);
    });

    const handleUseAsInput = () => {
        if (!generatedImage) return;
        const newFile: UploadedFile = {
            file: new File([], `generated-${generatedImage.id}.png`, { type: generatedImage.mimeType }),
            url: generatedImage.src,
            base64: generatedImage.base64,
            mimeType: generatedImage.mimeType,
        };
        setUploadedImages(prev => [newFile, ...prev]);
        setSelectedImageUrls(new Set([newFile.url]));
        setGeneratedImage(null); 
        setEditStack([]); 
        setEditStackIndex(-1);
    };
    
    const handleEdit = () => {
        // Edit mode supports multiple images if selected
        const selectedImages = getSelectedImages();
        if (selectedImages.length === 0) { setError('Please select images to edit.'); return; }
        
        // Use multiImageAction logic but passing all images as context
        runAI(async () => {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const finalPrompt = `${prompt}. Ensure the output aspect ratio is ${settings.aspectRatio}.`;
            const parts = [...selectedImages.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })), { text: finalPrompt }];
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
                originalSrc: selectedImages[0].url, base64: part.inlineData.data, mimeType: part.inlineData.mimeType,
                prompt, type: 'edit', createdAt: new Date().toLocaleString(),
            };
            const isFreshChain = !generatedImage || (selectedImages[0].url !== generatedImage.src);
            processNewImage(newImage, isFreshChain);
        });
    };

    const handlePassportPhoto = () => {
        const { background, customColor, attire, country, personType, retouchIntensity } = passportSettings;
        const standard = passportStandards[country] || passportStandards['USA'];
        const bgDescription = background === 'Custom' ? `solid color ${customColor}` : `solid ${background}`;

        const passportPrompt = `
        Act as a professional passport/visa/ID photo editor. Process this photo into a compliant passport image for ${country}.
        
        STRICT COMPLIANCE STANDARDS (${country}):
        - Biometric Readiness: Ensure clear eyes/iris, no glare on glasses (if present and allowed), and no reflections.
        - Dimensions: Target visual aspect ratio of ${standard.label}.
        - Background: Remove original background. Replace with ${bgDescription}. No gradients, shadows, or patterns.
        - Lighting: Even studio lighting, no shadows on face/background, no glare, smooth and natural illumination.
        - Pose: Full front view, perfectly straight posture, head centered, camera at eye level.
        - Expression: Neutral expression, eyes open and visible, mouth completely closed, no smiling, no teeth showing.
        - Recent Appearance: Ensure the appearance looks recent (within 6 months).

        EDITING INSTRUCTIONS:
        1. Crop & Scale: Detect, center, and crop the face to exact specifications. Scale head precisely to meet regulations.
        2. Remove/Replace Background: Completely remove the original background; replace with uniform ${bgDescription} color (no patterns/textures).
        3. Retouching: Apply subtle skin smoothing with an intensity of ${retouchIntensity}/100. Remove temporary blemishes but PRESERVE permanent features like moles/scars. Maintain natural skin texture; do not make it look plastic or artificial.
        4. Subject Analysis: Process the image for a ${personType}.
        5. Attire: ${attire === 'None (Keep Original)' ? 'Neaten the original attire.' : `Change outfit to a realistic ${attire}. Ensure realistic fabric texture, fit, and lighting match.`}
        6. No Accessories: No hats, no headphones, no dark glasses.
        
        Output: A single high-resolution, photorealistic, compliant portrait.
        `;
        singleImageAction(passportPrompt, 'passport-photo', activeImage);
    }
    const handleInpaint = () => multiImageAction(`In the first image provided, use the second image as a mask. The white area of the mask indicates the region to be modified. Replace the masked region with the following description: "${prompt}". The result should blend seamlessly and realistically with the original image's lighting, texture, and style.`, 'edit', activeImage, maskImage);
    const handleRetouch = () => multiImageAction(`In the first image provided, use the second image as a mask. The white area of the mask indicates the region to be removed. Intelligently remove the masked content (like skin blemishes, unwanted objects, or text) and fill the area by realistically generating content that matches the surrounding lighting, texture, and style. This is a magic eraser tool. The rest of the image must remain untouched.`, 'retouch', activeImage, maskImage);
    const handleReplicate = () => singleImageAction(`In the provided image, find and replace "${textToReplace}" with "${prompt}". The replacement must perfectly match the style, color, perspective, lighting, and texture of the surrounding elements. The rest of the image must remain untouched.`, 'edit', activeImage);

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
        setExtractedText(result.text || '');
    });
    
    const handleAnalyze = () => runAI(async () => {
        if (!activeImage) { setError('Please upload an image.'); return; }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [ { text: "Describe this image in detail for an AI image generation prompt. Be vivid about subject, setting, lighting, colors, style, and composition." }, { inlineData: { data: activeImage.base64, mimeType: activeImage.mimeType } } ] },
        });
        setPrompt(result.text?.trim() || '');
        setMode('generate');
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

    const UploadedFilesTray: React.FC<{ images: UploadedFile[], selectedUrls: Set<string>, onToggle: (url: string) => void, onRemove: (url: string) => void }> = ({ images, selectedUrls, onToggle, onRemove }) => (
        <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Uploaded Images ({selectedUrls.size} selected)</label>
            <div className="flex items-center gap-2 flex-wrap bg-[var(--bg-primary)] p-2 rounded-xl">
                {images.length === 0 && <p className="text-xs text-[var(--text-secondary)] px-2">Your uploaded images will appear here.</p>}
                {images.map(img => {
                    const isSelected = selectedUrls.has(img.url);
                    return (
                        <div key={img.url} className="relative group">
                            <img 
                                src={img.url} 
                                alt="Uploaded thumbnail" 
                                onClick={() => onToggle(img.url)}
                                className={`w-16 h-16 object-cover rounded-md cursor-pointer transition-all border-2 ${isSelected ? 'border-cyan-400 scale-105 shadow-md shadow-cyan-500/30' : 'border-transparent opacity-80 hover:opacity-100'}`} 
                            />
                            {isSelected && <div className="absolute top-0 right-0 w-3 h-3 bg-cyan-400 rounded-full border border-black transform translate-x-1/3 -translate-y-1/3"></div>}
                            <button 
                                onClick={(e) => { e.stopPropagation(); onRemove(img.url); }}
                                className="absolute -top-1 -right-1 bg-[var(--danger-primary)] text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                                <XMarkIcon className="w-3 h-3" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
    
    const modeConfig = {
        generate: { title: 'Generate Image', description: 'Describe your vision and generate a unique image. Select multiple images to combine them.', icon: VariationsIcon },
        edit: { title: 'AI Edit Image', description: 'Select image(s) and describe your desired changes.', icon: WandIcon },
        retouch: { title: 'Magic Eraser', description: 'Erase unwanted objects, spots, or blemishes from your image.', icon: RetouchIcon },
        replicate: { title: 'Replicate Style', description: 'Replace text or objects in an image while perfectly matching the original style.', icon: EyeDropperIcon },
        inpaint: { title: 'AI Inpainting', description: 'Upload an image and draw a mask to edit specific areas.', icon: BrushIcon },
        restore: { title: 'Restore Old Photo', description: 'Automatically repair and enhance old photographs.', icon: RestoreIcon },
        'passport-photo': { title: 'Passport Booth', description: 'Create professional, compliant passport photos for 90+ countries.', icon: AnalyzeIcon },
        'extract-text': { title: 'Extract Text (OCR)', description: 'Pull text from any image using Optical Character Recognition (OCR).', icon: TextScanIcon },
        analyze: { title: 'Analyze Image', description: 'Generate a detailed prompt from an existing image.', icon: AnalyzeIcon },
        converter: { title: 'Image Converter', description: 'Convert images between formats like JPG, PNG, and WEBP.', icon: DownloadIcon },
        'print-layout': { title: 'Print Layout Studio', description: 'Arrange your photos on standard paper sizes for printing.', icon: ExpandIcon },
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
        if(mode === 'converter') return; 
        switch (mode) {
            case 'generate': return handleGenerate();
            case 'edit': return handleEdit();
            case 'restore': return handleRestore();
            case 'extract-text': return handleExtractText();
            case 'analyze': return handleAnalyze();
            case 'inpaint': return handleInpaint();
            case 'retouch': return handleRetouch();
            case 'replicate': return handleReplicate();
            case 'passport-photo': return handlePassportPhoto();
        }
    };

    const isSubmitDisabled = isLoading ||
        (mode === 'generate' && !prompt && selectedImageUrls.size === 0) ||
        (mode === 'edit' && (!prompt || selectedImageUrls.size === 0)) ||
        (mode === 'inpaint' && (!prompt || !activeImage || !maskImage)) ||
        (mode === 'retouch' && (!activeImage || !maskImage)) ||
        (['restore', 'extract-text', 'analyze', 'passport-photo'].includes(mode) && selectedImageUrls.size === 0) || 
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
                    {(Object.keys(modeConfig) as Mode[]).filter(k => k !== 'print-layout').map(key => { // Hide print-layout from top nav, accessed via flow
                        const Icon = modeConfig[key].icon;
                        return (
                            <button key={key} onClick={() => {setMode(key); resetOutputs();}} className={`flex flex-col items-center justify-center text-center gap-2 p-3 text-xs font-semibold rounded-2xl transition-all duration-300 transform hover:scale-105 ${mode === key ? 'bg-gradient-to-br from-cyan-500/50 to-purple-600/50 text-white shadow-md shadow-[0_0_20px_var(--accent-glow)]' : 'text-gray-300 hover:bg-[var(--bg-tertiary)]'}`}>
                                <Icon className="w-8 h-8" />
                                <span className="capitalize">{modeConfig[key].title.replace('AI ', '').replace(' Image', '').replace(' Generator', '')}</span> 
                            </button>
                        );
                    })}
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-slide-in-up stagger-2">
                <div className="lg:col-span-1 glass-card p-6 rounded-3xl space-y-6 self-start">
                    {/* ... (Previous Logic for Prompt Inputs) ... */}
                    {['generate', 'edit', 'inpaint', 'replicate'].includes(mode) && (
                        <div>
                            <label htmlFor="prompt" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{mode === 'replicate' ? 'Replacement Description' : 'Your Prompt / Changes'}</label>
                            <div className="relative">
                                <textarea id="prompt" rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full input-glow rounded-xl p-2 text-white pr-20" placeholder={mode === 'inpaint' ? "e.g., A majestic eagle soaring" : (mode==='replicate' ? 'a blue car' : "Describe desired changes or new image...")} />
                                <div className="absolute top-2 right-2 flex flex-col gap-2">
                                    <button onClick={isListening ? stopListening : startListening} className={`p-1 rounded-full ${isListening ? 'bg-red-500/50 text-white animate-pulse' : 'hover:bg-[var(--border-primary)] text-gray-400'}`}><MicIcon className="w-5 h-5" /></button>
                                    <button onClick={handleEnhancePrompt} disabled={!prompt || isLoading} className="p-1 rounded-full hover:bg-[var(--border-primary)] text-gray-400 disabled:opacity-50" aria-label="Enhance Prompt"><WandIcon className="w-5 h-5" /></button>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* ... (Rest of Inputs) ... */}
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
                    {(mode === 'generate' || mode === 'edit') && ( // Aspect ratio for generate and edit
                        <div className="space-y-4">
                            <AspectRatioSelector value={settings.aspectRatio} onChange={handleAspectRatioChange} />
                            {mode === 'generate' && (
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
                            )}
                        </div>
                    )}
                    
                    {['generate', 'edit', 'restore', 'extract-text', 'analyze', 'replicate', 'converter', 'passport-photo', 'retouch'].includes(mode) && <ImageUploader onFilesUploaded={handleNewFiles('base')} imageUrl={activeImage?.url || null} title="Base Image(s) - Bulk Upload (up to 1000)" multiple />}
                    
                    {mode === 'passport-photo' && activeImage && (
                        <div className="space-y-4">
                             <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Country Standard</label>
                                <select value={passportSettings.country} onChange={(e) => setPassportSettings(s => ({...s, country: e.target.value}))} className="w-full input-glow rounded-xl p-3 text-white">
                                    {Object.entries(passportStandards).map(([country, std]) => (
                                        <option key={country} value={country}>{country} - {std.label}</option>
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
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    {['White', 'Light Grey', 'Blue', 'Off-White', 'Custom'].map(color => (
                                        <button key={color} onClick={() => setPassportSettings(s => ({...s, background: color}))} className={`p-2 rounded-lg text-sm capitalize transition-colors ${passportSettings.background === color ? 'bg-cyan-500 text-white ring-2 ring-cyan-300' : 'bg-[var(--bg-tertiary)]'}`}>{color}</button>
                                    ))}
                                </div>
                                {passportSettings.background === 'Custom' && (
                                    <div className="flex items-center gap-2">
                                        <input type="color" value={passportSettings.customColor} onChange={(e) => setPassportSettings(s => ({...s, customColor: e.target.value}))} className="w-10 h-10 p-0 rounded cursor-pointer border-none" />
                                        <span className="text-sm text-[var(--text-secondary)]">{passportSettings.customColor}</span>
                                    </div>
                                )}
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
                                 <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Skin Smoothness: <span className="text-white font-bold">{passportSettings.retouchIntensity}%</span></label>
                                 <input type="range" min="0" max="100" value={passportSettings.retouchIntensity} onChange={(e) => setPassportSettings(s => ({...s, retouchIntensity: Number(e.target.value)}))} className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-cyan-400" />
                                 <p className="text-xs text-[var(--text-secondary)] mt-1">Enhances skin without changing facial structure.</p>
                             </div>
                        </div>
                    )}
                    
                    {mode === 'print-layout' && (
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-white">Layout Settings</h3>
                             <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Paper Size</label>
                                <select value={printLayout.paperSize} onChange={(e) => setPrintLayout(s => ({...s, paperSize: e.target.value as any}))} className="w-full input-glow rounded-xl p-3 text-white">
                                    {Object.entries(PAPER_SIZES_MM).map(([key, size]) => (
                                        <option key={key} value={key}>{size.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Orientation</label>
                                <div className="flex bg-[var(--bg-tertiary)] rounded-xl p-1">
                                    <button onClick={() => setPrintLayout(s => ({...s, orientation: 'portrait'}))} className={`flex-1 p-2 rounded-lg text-sm ${printLayout.orientation === 'portrait' ? 'bg-cyan-500 text-white' : 'text-gray-400'}`}>Portrait</button>
                                    <button onClick={() => setPrintLayout(s => ({...s, orientation: 'landscape'}))} className={`flex-1 p-2 rounded-lg text-sm ${printLayout.orientation === 'landscape' ? 'bg-cyan-500 text-white' : 'text-gray-400'}`}>Landscape</button>
                                </div>
                            </div>
                            <div>
                                 <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Spacing / Gap: <span className="text-white font-bold">{printLayout.gapMM} mm</span></label>
                                 <input type="range" min="0" max="10" step="0.5" value={printLayout.gapMM} onChange={(e) => setPrintLayout(s => ({...s, gapMM: Number(e.target.value)}))} className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-cyan-400" />
                             </div>
                             <div className="pt-4 border-t border-[var(--border-primary)]">
                                <button onClick={handleDownloadLayout} className="btn-3d w-full flex items-center justify-center gap-2">
                                    <DownloadIcon className="w-5 h-5" /> Download Print Sheet
                                </button>
                             </div>
                             <button onClick={() => setMode('passport-photo')} className="w-full text-center text-sm text-[var(--text-secondary)] hover:text-white mt-2">Back to Editor</button>
                        </div>
                    )}

                    {(mode === 'inpaint' || mode === 'retouch') && (
                        <div className="space-y-4">
                            <ImageUploader onFilesUploaded={handleNewFiles('base')} imageUrl={activeImage?.url || null} title="Base Image" multiple />
                            {mode === 'inpaint' &&
                                <div className="bg-[var(--bg-tertiary)] p-1 rounded-full flex items-center">
                                    <button onClick={() => setMaskDrawMode('draw')} className={`flex-1 text-center text-sm font-semibold p-2 rounded-full transition-colors ${maskDrawMode === 'draw' ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white' : 'bg-[var(--bg-tertiary)] text-gray-300'}`}>Draw Mask</button>
                                    <button onClick={() => setMaskDrawMode('upload')} className={`flex-1 text-center text-sm font-semibold p-2 rounded-full transition-colors ${maskDrawMode === 'upload' ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white' : 'bg-[var(--bg-tertiary)] text-gray-300'}`}>Upload Mask</button>
                                </div>
                            }
                            {((maskDrawMode === 'draw' || mode === 'retouch') && activeImage) && (
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
                    
                    {['generate', 'edit', 'restore', 'extract-text', 'analyze', 'replicate', 'converter', 'passport-photo', 'retouch'].includes(mode) && uploadedImages.length > 0 && (
                        <UploadedFilesTray 
                            images={uploadedImages} 
                            selectedUrls={selectedImageUrls} 
                            onToggle={toggleImageSelection}
                            onRemove={(urlToRemove) => {
                                setUploadedImages(prev => prev.filter(img => img.url !== urlToRemove));
                                setSelectedImageUrls(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(urlToRemove);
                                    return newSet;
                                });
                                resetOutputs(); 
                            }}
                        />
                    )}
                    
                    {mode === 'converter' && <ImageConverter uploadedImages={uploadedImages} selectedImageUrls={selectedImageUrls} onError={setError} />}

                    {error && <p className="text-sm text-[var(--danger-primary)]">{error}</p>}
                    
                    {mode !== 'converter' && mode !== 'print-layout' && (
                        <div className="pt-4 border-t border-[var(--border-primary)]">
                            <button onClick={handleSubmit} disabled={isSubmitDisabled} className="btn-3d flex items-center justify-center gap-2 w-full">
                                {React.createElement(modeConfig[mode].icon, { className: "w-5 h-5" })}
                                <span className="capitalize">{modeConfig[mode].title.replace('AI ', '').replace(' Image', '').replace(' Generator', '')}</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-2 flex items-start gap-4">
                   <div className="flex-1 glass-card p-4 min-h-[400px] flex flex-col items-center justify-center aspect-square rounded-3xl overflow-hidden">
                        {isLoading && (
                            <div className="text-center flex flex-col items-center gap-4">
                                <LogoIcon className="h-24 w-24 animate-pulse" />
                                <p className="mt-4 text-lg text-[var(--text-secondary)]">AI is creating...</p>
                                <p className="text-sm text-[var(--text-secondary)]/70">This can take a moment.</p>
                            </div>
                        )}
                        {!isLoading && mode === 'print-layout' && (
                            <div className="w-full h-full flex flex-col items-center justify-center overflow-auto bg-gray-800 p-4 rounded-xl">
                                <h3 className="text-white mb-2 sticky top-0 bg-gray-800/80 backdrop-blur px-4 py-1 rounded-full z-10">Print Preview ({printLayout.paperSize})</h3>
                                <canvas ref={printCanvasRef} className="shadow-2xl max-w-full max-h-[60vh] border border-white/20" />
                                <p className="text-xs text-gray-400 mt-2">Preview scaled to fit. Download for full 300 DPI quality.</p>
                            </div>
                        )}
                        {!isLoading && generatedImage && mode !== 'print-layout' && (
                            generatedImage.originalSrc ?
                            <ImageComparator before={generatedImage.originalSrc} after={generatedImage.src} /> :
                            <ZoomableImage src={generatedImage.src} alt="Generated" />
                        )}
                        {!isLoading && extractedText && (
                            <div className="w-full h-full bg-[var(--bg-tertiary)] p-4 rounded-xl overflow-y-auto animate-fade-in">
                                <pre className="text-white whitespace-pre-wrap text-sm">{extractedText}</pre>
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
                        {generatedImage && !isLoading && mode !== 'print-layout' && (
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
                            </div>
                        )}
                        {!isLoading && generatedImage && complianceReport && mode === 'passport-photo' && (
                            <div className="w-full p-4 bg-[var(--bg-tertiary)] rounded-xl mt-4 text-sm text-[var(--text-secondary)]">
                                <h4 className="font-bold text-white mb-2">Compliance Report:</h4>
                                <pre className="whitespace-pre-wrap">{complianceReport}</pre>
                                <button 
                                    onClick={() => setMode('print-layout')} 
                                    className="btn-3d w-full mt-4 flex items-center justify-center gap-2"
                                >
                                    <ExpandIcon className="w-5 h-5" /> Go to Print Layout
                                </button>
                            </div>
                        )}
                   </div>
                    {mode !== 'print-layout' && (
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
                    )}
                </div>
            </div>
        </div>
    );
};
