
import React, { useState } from 'react';
import { GoogleGenAI, Type, Modality } from '@google/genai';
import { GeneratedImage, BrandingElements } from '../types';
import { LogoIcon, SparklesIcon, SaveIcon } from './icons';

interface BrandingKitProps {
    addImageToGallery: (image: GeneratedImage) => void;
    galleryImages: GeneratedImage[];
}

export const BrandingKit: React.FC<BrandingKitProps> = ({ addImageToGallery, galleryImages }) => {
    const [brandName, setBrandName] = useState('');
    const [brandDescription, setBrandDescription] = useState('');
    const [targetAudience, setTargetAudience] = useState('');
    const [brandKeywords, setBrandKeywords] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState('');
    const [brandingElements, setBrandingElements] = useState<BrandingElements | null>(null);
    const [logo, setLogo] = useState<GeneratedImage | null>(null);
    const [brandImagery, setBrandImagery] = useState<GeneratedImage[]>([]);

    const handleGenerate = async () => {
        if (!brandName || !brandDescription) {
            setError('Please provide a brand name and description.');
            return;
        }

        setIsLoading(true);
        setError('');
        setBrandingElements(null);
        setLogo(null);
        setBrandImagery([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            
            setLoadingMessage('Crafting brand identity...');
            const textPrompt = `Generate a comprehensive branding kit for a company named "${brandName}". 
            - Company Description: "${brandDescription}".
            - Target Audience: "${targetAudience}".
            - Brand Keywords: "${brandKeywords}".
            
            Provide the following elements according to the specified JSON schema:
            1. A concise, powerful mission statement.
            2. An array of 3 catchy slogans.
            3. An array of 5 brand voice keywords (e.g., "Confident", "Playful").
            4. A color palette of 5 colors with descriptive names and hex codes.

            IMPORTANT: The entire response must be a single, valid JSON object. Ensure all string values are properly escaped to be valid JSON (e.g., internal double quotes must be escaped with a backslash).`;
            
            const textModelResult = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: textPrompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            missionStatement: { type: Type.STRING },
                            slogans: { type: Type.ARRAY, items: { type: Type.STRING }},
                            brandVoice: { type: Type.ARRAY, items: { type: Type.STRING }},
                            colorPalette: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        name: { type: Type.STRING },
                                        hex: { type: Type.STRING },
                                    }
                                }
                            }
                        }
                    }
                }
            });

            const parsedTextElements: BrandingElements = JSON.parse(textModelResult.text);
            setBrandingElements(parsedTextElements);

            setLoadingMessage('Designing your logo...');
            const logoPrompt = `Create a modern, minimalist logo for "${brandName}", a company that is "${brandDescription}". The logo should be iconic, scalable, and on a clean white background. Use the following color palette if possible: ${parsedTextElements.colorPalette.map((c) => c.hex).join(', ')}`;
            
            const imageModelResult = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: logoPrompt }] },
                config: { responseModalities: [Modality.IMAGE] }
            });
            
            // Fix: Safely access parts using optional chaining and provide a fallback
            const parts = imageModelResult.candidates?.[0]?.content?.parts || [];
            
            for (const part of parts) {
                if (part.inlineData) {
                    const newLogo: GeneratedImage = {
                        id: new Date().toISOString(),
                        src: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                        base64: part.inlineData.data,
                        mimeType: part.inlineData.mimeType,
                        prompt: `Logo for ${brandName}`,
                        type: 'logo',
                        createdAt: new Date().toLocaleString(),
                    };
                    setLogo(newLogo);
                    addImageToGallery(newLogo);
                    break;
                }
            }

            // Define imageryPrompt using parsed brand elements
            const imageryPrompt = `Generate a set of brand imagery for "${brandName}", a company described as "${brandDescription}". The imagery should reflect the brand's mission statement: "${parsedTextElements.missionStatement}", brand voice keywords: "${parsedTextElements.brandVoice.join(', ')}", and use the color palette: ${parsedTextElements.colorPalette.map(c => c.name + ' ' + c.hex).join(', ')}. Target audience: "${targetAudience || 'general'}" and brand keywords: "${brandKeywords || 'none specified'}" to guide the visual style.`;

            setLoadingMessage('Generating brand imagery...');
            const imageryResult = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: imageryPrompt,
                config: {
                    numberOfImages: 4,
                    outputMimeType: 'image/jpeg',
                    aspectRatio: '16:9',
                },
            });

            const newImagery = imageryResult.generatedImages
                .filter(imgData => imgData && imgData.image) // Add check here
                .map(imgData => {
                 const newImage: GeneratedImage = {
                    id: new Date().toISOString() + Math.random(),
                    src: `data:${imgData.image.mimeType};base64,${imgData.image.imageBytes}`,
                    base64: imgData.image.imageBytes,
                    mimeType: imgData.image.mimeType,
                    prompt: `Brand asset for ${brandName}`,
                    type: 'brand-asset',
                    createdAt: new Date().toLocaleString(),
                };
                addImageToGallery(newImage);
                return newImage;
            });
            setBrandImagery(newImagery);


        } catch (err: any) {
            console.error(err);
            let errorMessage = 'Failed to generate branding kit. Please try again.';
            if (err.message && err.message.includes('RESOURCE_EXHAUSTED')) {
                errorMessage = "You've exceeded your current API quota. Please check your plan and billing details to continue.";
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const isLogoSaved = logo ? galleryImages.some(img => img.id === logo.id) : false;

    return (
        <div className="space-y-8">
            <div className="text-center animate-slide-in-up">
                <h1 className="text-4xl lg:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-[var(--gradient-text)]">Branding Identity Kit</h1>
                <p className="text-lg text-[var(--text-secondary)] mt-2">Define your brand and let AI craft your identity system.</p>
            </div>

            <div className="max-w-2xl mx-auto glass-card p-6 rounded-3xl space-y-6 animate-slide-in-up stagger-1">
                <div>
                    <label htmlFor="brandName" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Brand Name</label>
                    <input type="text" id="brandName" value={brandName} onChange={(e) => setBrandName(e.target.value)} className="w-full input-glow rounded-xl p-3 text-white" placeholder="e.g., Zenith Dynamics" />
                </div>
                <div>
                    <label htmlFor="brandDescription" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Brand Description</label>
                    <textarea id="brandDescription" rows={3} value={brandDescription} onChange={(e) => setBrandDescription(e.target.value)} className="w-full input-glow rounded-xl p-3 text-white" placeholder="e.g., A forward-thinking tech company specializing in AI solutions." />
                </div>
                <div>
                    <label htmlFor="targetAudience" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Target Audience (Optional)</label>
                    <input type="text" id="targetAudience" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="w-full input-glow rounded-xl p-3 text-white" placeholder="e.g., Tech startups, enterprise clients" />
                </div>
                 <div>
                    <label htmlFor="brandKeywords" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Brand Keywords (Optional)</label>
                    <input type="text" id="brandKeywords" value={brandKeywords} onChange={(e) => setBrandKeywords(e.target.value)} className="w-full input-glow rounded-xl p-3 text-white" placeholder="e.g., Innovative, clean, modern, trustworthy" />
                </div>
                <button onClick={handleGenerate} disabled={isLoading} className="btn-3d flex items-center justify-center gap-2 w-full">
                    {isLoading ? 'Generating...' : 'Generate Brand Kit'}
                    {!isLoading && <SparklesIcon className="w-5 h-5" />}
                </button>
                {error && <p className="text-[var(--danger-primary)] text-sm">{error}</p>}
            </div>

            {isLoading && (
                <div className="text-center p-8 glass-card rounded-3xl animate-fade-in">
                    <LogoIcon className="h-24 w-24 animate-pulse mx-auto" />
                    <p className="mt-4 text-lg text-[var(--text-secondary)]">{loadingMessage}</p>
                    <p className="text-sm text-[var(--text-secondary)]/70">This may take a minute.</p>
                </div>
            )}

            {(brandingElements || logo) && (
                <div className="space-y-8 animate-fade-in">
                    {logo && (
                        <div className="glass-card p-6 rounded-3xl animate-slide-in-up">
                            <h3 className="text-2xl font-semibold mb-4 bg-clip-text text-transparent bg-[var(--gradient-text)]">Generated Logo</h3>
                            <div className="flex flex-col items-center gap-4">
                                <div className="flex justify-center bg-white/90 p-4 rounded-2xl shadow-inner">
                                    <img src={logo.src} alt="Generated Logo" className="h-48 w-48 object-contain" />
                                </div>
                                <button
                                    disabled={true}
                                    className="flex items-center justify-center gap-2 bg-[var(--bg-tertiary)] text-white font-bold py-2 px-4 rounded-full opacity-70 cursor-default"
                                >
                                    <SaveIcon className="w-5 h-5" />
                                    Saved to Gallery
                                </button>
                            </div>
                        </div>
                    )}
                    {brandingElements && (
                         <div className="glass-card p-6 rounded-3xl animate-slide-in-up stagger-1">
                            <h3 className="text-2xl font-semibold mb-4 bg-clip-text text-transparent bg-[var(--gradient-text)]">Mission Statement</h3>
                            <p className="text-[var(--text-secondary)] italic text-lg leading-relaxed">"{brandingElements.missionStatement}"</p>
                        </div>
                    )}
                     {brandingElements && brandingElements.slogans && (
                         <div className="glass-card p-6 rounded-3xl animate-slide-in-up stagger-2">
                            <h3 className="text-2xl font-semibold mb-4 bg-clip-text text-transparent bg-[var(--gradient-text)]">Slogans</h3>
                            <ul className="list-disc list-inside space-y-2">
                                {brandingElements.slogans.map((slogan, i) => <li key={i} className="text-[var(--text-secondary)]">{slogan}</li>)}
                            </ul>
                        </div>
                    )}
                     {brandImagery.length > 0 && (
                        <div className="glass-card p-6 rounded-3xl animate-slide-in-up stagger-2">
                            <h3 className="text-2xl font-semibold mb-4 bg-clip-text text-transparent bg-[var(--gradient-text)]">Brand Imagery</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {brandImagery.map((image) => (
                                    <div key={image.id} className="rounded-xl overflow-hidden shadow-lg">
                                        <img src={image.src} alt={image.prompt} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        </div>
                     )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {brandingElements && brandingElements.colorPalette && (
                             <div className="glass-card p-6 rounded-3xl animate-slide-in-up stagger-3">
                                <h3 className="text-2xl font-semibold mb-4 bg-clip-text text-transparent bg-[var(--gradient-text)]">Color Palette</h3>
                                <div className="flex flex-wrap justify-center gap-6">
                                    {brandingElements.colorPalette.map((color) => (
                                        <div key={color.hex} className="text-center flex flex-col items-center">
                                            <div className="w-20 h-20 rounded-full border-2 border-[var(--border-primary)] shadow-lg" style={{ backgroundColor: color.hex }}></div>
                                            <p className="mt-3 font-semibold">{color.name}</p>
                                            <p className="text-sm text-[var(--text-secondary)] uppercase tracking-wider">{color.hex}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {brandingElements && brandingElements.brandVoice && (
                             <div className="glass-card p-6 rounded-3xl animate-slide-in-up stagger-4">
                                <h3 className="text-2xl font-semibold mb-4 bg-clip-text text-transparent bg-[var(--gradient-text)]">Brand Voice</h3>
                                <div className="flex flex-wrap justify-center gap-3">
                                    {brandingElements.brandVoice.map((voice, i) => <span key={i} className="bg-[var(--bg-tertiary)] text-white font-medium py-2 px-4 rounded-full">{voice}</span>)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
