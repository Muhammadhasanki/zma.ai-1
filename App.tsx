
import React, { useState, useEffect } from 'react';
import { View, GeneratedImage } from './types';
import { ImageStudio } from './components/ImageStudio';
import { BrandingKit } from './components/BrandingKit';
import { Gallery } from './components/Gallery';
import { Chatbot } from './components/Chatbot';
import { LogoIcon } from './components/icons';

const Header: React.FC<{ activeView: View; setActiveView: (view: View) => void }> = ({ activeView, setActiveView }) => {
    const navItems: { id: View; label: string }[] = [
        { id: 'studio', label: 'Image Studio' },
        { id: 'branding', label: 'Branding Kit' },
        { id: 'gallery', label: 'Gallery' },
    ];

    return (
        <header className="glass-header sticky top-0 z-30">
            <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 flex items-center gap-3">
                             <LogoIcon className="h-10 w-10" />
                            <span className="text-2xl font-bold text-white tracking-wider">zma.ai</span>
                        </div>
                    </div>
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-2 bg-[var(--bg-primary)] p-1 rounded-full">
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveView(item.id)}
                                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 transform ${
                                        activeView === item.id
                                            ? 'bg-gradient-to-r from-cyan-400 to-purple-500 text-white shadow-lg shadow-[var(--accent-glow)]'
                                            : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-tertiary)]'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="md:hidden">
                        <select
                          onChange={(e) => setActiveView(e.target.value as View)}
                          value={activeView}
                          className="input-glow rounded-md px-3 py-2"
                        >
                            {navItems.map((item) => (
                                <option key={item.id} value={item.id}>{item.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </nav>
        </header>
    );
};


function App() {
    const [view, setView] = useState<View>('studio');
    const [galleryImages, setGalleryImages] = useState<GeneratedImage[]>(() => {
        try {
            const localData = localStorage.getItem('zma-ai-gallery');
            if (!localData) return [];
            // Stored images are missing 'src' and 'originalSrc'. We reconstruct 'src' here.
            // 'originalSrc' is not persisted to save space.
            const storedImages: Omit<GeneratedImage, 'src' | 'originalSrc'>[] = JSON.parse(localData);
            return storedImages.map(img => ({
                ...img,
                src: `data:${img.mimeType};base64,${img.base64}`,
            }));
        } catch (error) {
            console.error("Could not load images from localStorage", error);
            return [];
        }
    });

    useEffect(() => {
        const saveToLocalStorage = () => {
            const persistedGalleryJSON = localStorage.getItem('zma-ai-gallery');
    
            if (galleryImages.length === 0) {
                if (persistedGalleryJSON) {
                    localStorage.removeItem('zma-ai-gallery');
                }
                return;
            }
    
            // Create a savable version of images by removing data that can be reconstructed (src)
            // or is not essential to persist (originalSrc for comparison). This drastically reduces storage footprint.
            const savableImages = galleryImages.map(img => {
                const { src, originalSrc, ...rest } = img;
                return rest;
            });
            
            if (persistedGalleryJSON && JSON.stringify(savableImages) === persistedGalleryJSON) {
                return;
            }
    
            let imagesToTry = [...savableImages];
            while (imagesToTry.length > 0) {
                try {
                    localStorage.setItem('zma-ai-gallery', JSON.stringify(imagesToTry));
                    
                    if (imagesToTry.length < galleryImages.length) {
                        console.warn(`Removed ${galleryImages.length - imagesToTry.length} oldest images from storage to free up space.`);
                        // State is out of sync with what was just saved. Update it by filtering
                        // the full-quality images based on the IDs of what was successfully saved.
                        const keptImageIds = new Set(imagesToTry.map(img => img.id));
                        setGalleryImages(prevImages => prevImages.filter(img => keptImageIds.has(img.id)));
                    }
                    return; // Success!
                } catch (error: any) {
                    if (error.name === 'QuotaExceededError' || (error.message && (error.message.toLowerCase().includes('quota') || error.message.toLowerCase().includes('exceeded')))) {
                        console.warn(`LocalStorage quota exceeded. Removing oldest image.`);
                        imagesToTry.pop(); // Remove oldest image and retry
                    } else {
                        console.error("Could not save images to localStorage", error);
                        return; // Exit on other errors
                    }
                }
            }
    
            if (imagesToTry.length === 0 && galleryImages.length > 0) {
                console.error("Could not save the latest image to localStorage, it is too large.");
                alert("Could not save the latest image to the gallery because it is too large, even after optimizing for storage. Your existing gallery is safe.");
                
                // Revert to the last known good state from localStorage.
                if (persistedGalleryJSON) {
                    const persistedGallery = JSON.parse(persistedGalleryJSON);
                    const reconstructedGallery = persistedGallery.map((img: Omit<GeneratedImage, 'src' | 'originalSrc'>) => ({
                        ...img,
                        src: `data:${img.mimeType};base64,${img.base64}`,
                    }));
                    setGalleryImages(reconstructedGallery);
                } else {
                    setGalleryImages([]);
                }
            }
        };
        saveToLocalStorage();
    }, [galleryImages]);


    const addImageToGallery = (image: GeneratedImage) => {
        setGalleryImages(prev => {
            // Prevent duplicates
            if (prev.some(img => img.id === image.id)) {
                return prev; 
            }
            return [image, ...prev];
        });
    };

    const renderView = () => {
        switch (view) {
            case 'studio':
                return <ImageStudio addImageToGallery={addImageToGallery} galleryImages={galleryImages} />;
            case 'branding':
                return <BrandingKit addImageToGallery={addImageToGallery} galleryImages={galleryImages} />;
            case 'gallery':
                return <Gallery images={galleryImages} addImageToGallery={addImageToGallery} setGalleryImages={setGalleryImages} />;
            default:
                return <ImageStudio addImageToGallery={addImageToGallery} galleryImages={galleryImages} />;
        }
    };

    return (
        <div className="min-h-screen bg-transparent text-[var(--text-primary)]">
            <Header activeView={view} setActiveView={setView} />
            <main>
                <div key={view} className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 view-container">
                    {renderView()}
                </div>
            </main>
            <Chatbot currentView={view} />
        </div>
    );
}

export default App;
