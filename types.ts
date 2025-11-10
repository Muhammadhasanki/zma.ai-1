
export type View = 'studio' | 'branding' | 'gallery';

export interface GenerationSettings {
  aspectRatio?: string;
  realismLevel?: number;
  [key: string]: any; // For other potential settings
}

export interface GeneratedImage {
  id: string;
  src: string;
  originalSrc?: string; // Used for before/after comparison
  base64: string;
  mimeType: string;
  prompt: string;
  type: 'generate' | 'edit' | 'logo' | 'filter' | 'face-swap' | 'retouch' | 'restore' | 'variation' | 'background-removal' | 'passport-photo' | 'enhance' | 'brand-asset' | 'portrait-enhance';
  createdAt: string;
  parentId?: string; // Link to the original image for variations
  settings?: GenerationSettings;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface BrandingElements {
  missionStatement: string;
  slogans: string[];
  brandVoice: string[];
  colorPalette: {
    name: string;
    hex: string;
  }[];
}