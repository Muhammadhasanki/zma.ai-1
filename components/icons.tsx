
import React from 'react';

// Shared definitions for gradients and filters to be used across icons
const IconDefs = () => (
    <defs>
        <linearGradient id="glass-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
        </linearGradient>
        <linearGradient id="accent-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00F2FE" />
            <stop offset="100%" stopColor="#EE00FF" />
        </linearGradient>
        <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="1" stdDeviation="1" floodColor="rgba(0,0,0,0.3)" />
        </filter>
    </defs>
);

const IconWrapper = ({ children, viewBox = "0 0 24 24" }: { children: React.ReactNode, viewBox?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox={viewBox} strokeWidth={1.5} stroke="currentColor">
        <IconDefs />
        <g filter="url(#drop-shadow)">
            {children}
        </g>
    </svg>
);

export const AdjustmentsIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" /><path fill="url(#glass-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" /></g></svg>
);

export const AnalyzeIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639l4.43-7.185a2.25 2.25 0 0 1 3.96 0l4.43 7.185a1.012 1.012 0 0 1 0 .639l-4.43 7.185a2.25 2.25 0 0 1-3.96 0l-4.43-7.185Z" /><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></g></svg>
);

export const BrushIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /><path fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" strokeLinecap="round" strokeLinejoin="round" d="M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></g></svg>
);

export const ChatBubbleIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" strokeLinecap="round" strokeLinejoin="round" d="M21 12c0 4.556-4.03 8.25-9 8.25a9.761 9.761 0 0 1-2.542-.381 1.487 1.487 0 0 0-.97.02c-.521.236-.94.465-1.284.665A10.024 10.024 0 0 1 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" /><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375" /></g></svg>
);

export const ChevronLeftIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
);

export const ChevronRightIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
);

export const CompareIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M12 3.75v16.5M3.75 12h16.5" /></g></svg>
);

export const DownloadIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /><path fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5" /></g></svg>
);

export const ExpandIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></g></svg>
);

export const EyeDropperIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 0 .75.75h4.5a.75.75 0 0 0 .75-.75v-4.5a.75.75 0 0 0-.75-.75h-4.5Z" /><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="m15.836 4.402.12-.12a3.375 3.375 0 0 0-4.773-4.773l-.12.12-1.685 1.685a3.375 3.375 0 0 0 0 4.773l1.685 1.685a3.375 3.375 0 0 0 4.773 0l1.685-1.685Zm-2.936 8.353 3.536-3.536m-3.536 3.536-1.414 1.414a.75.75 0 0 1-1.06 0l-1.415-1.414a.75.75 0 0 1 0-1.06l1.414-1.414m2.121-2.121L9.643 8.353m2.121 2.121L13.18 12" /></g></svg>
);

export const FilterIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M12 3c-1.1 0-2.07.39-2.83.94L3 11.25v2.5l6.17-7.34C9.93 5.39 10.9 5 12 5s2.07.39 2.83.94L21 13.75v-2.5L14.83 3.94A3.94 3.94 0 0 0 12 3Zm0 18c1.1 0 2.07-.39 2.83-.94L21 12.75v-2.5l-6.17 7.34c-.76.55-1.73.94-2.83.94s-2.07-.39-2.83-.94L3 10.25v2.5l6.17 7.34c.76.55 1.73.94 2.83.94Z" /></g></svg>
);

export const HistoryIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5" /></g></svg>
);

export const LogoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#00F2FE" />
        <stop offset="100%" stopColor="#EE00FF" />
      </linearGradient>
       <filter id="logo-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.5)" />
        </filter>
    </defs>
    <g filter="url(#logo-shadow)">
      <path d="M50 0L93.3 25V75L50 100L6.7 75V25L50 0Z" fill="url(#logo-grad)" opacity="0.8"/>
      <path d="M50 0L93.3 25V75L50 100L6.7 75V25L50 0Z" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
      <path d="M50 15L80.31 32.5V67.5L50 85L19.69 67.5V32.5L50 15Z" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
      <path d="M25 38L50 50L75 38" stroke="white" strokeWidth="3" strokeOpacity="0.5"/>
      <path d="M50 100V50" stroke="white" strokeWidth="3" strokeOpacity="0.5"/>
    </g>
  </svg>
);

export const MicIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5" /><path stroke="url(#accent-gradient)" d="M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 0 1 6 0v8.25a3 3 0 0 1-3 3Z" /></g></svg>
);

export const PaperAirplaneIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><g filter="url(#drop-shadow)"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></g></svg>
);

export const RealismIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M6.75 21a2.25 2.25 0 0 0 2.25-2.25V15M6.75 21a2.25 2.25 0 0 1-2.25-2.25V15M17.25 21a2.25 2.25 0 0 0 2.25-2.25V15m0 0a2.25 2.25 0 0 0-2.25-2.25H15M6.75 15a2.25 2.25 0 0 0-2.25-2.25H3m14.25 0a2.25 2.25 0 0 1 2.25 2.25m0 0a2.25 2.25 0 0 0-2.25-2.25M6.75 15a2.25 2.25 0 0 1 2.25 2.25m11.25-6.75a2.25 2.25 0 0 0-2.25-2.25H15a2.25 2.25 0 0 0-2.25 2.25m-7.5 0a2.25 2.25 0 0 0-2.25-2.25H3a2.25 2.25 0 0 0-2.25 2.25m11.25 0a2.25 2.25 0 0 1 2.25 2.25m-3.75 0a2.25 2.25 0 0 0-2.25-2.25M3 12h18" /></g></svg>
);

export const RedoIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l6 6m0 0-6 6m6-6H9a6 6 0 0 1 0-12h3" />
    </svg>
);

export const RestoreIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="m15.75 15.75-2.489-2.489m0 0a3.375 3.375 0 1 0-4.773-4.773 3.375 3.375 0 0 0 4.774 4.774Z" /><path stroke="url(#accent-gradient)" strokeOpacity="0.5" strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v.01m0 3.49v.01m0 3.49v.01m0 3.49v.01M4.5 12h.01m3.49 0h.01m3.49 0h.01m3.49 0h.01" strokeDasharray="0.1 2" /></g></svg>
);

export const RetouchIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5" /></g></svg>
);

export const SaveIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c.1.121.176.26.224.403.048.143.072.294.072.445v15.25a.75.75 0 0 1-1.28.53l-4.72-4.72a.75.75 0 0 0-1.06 0l-4.72 4.72a.75.75 0 0 1-1.28-.53V4.17c0-.151.024-.302.072-.445.048-.143.124-.282.224-.403a.75.75 0 0 1 .53-.217h10.5a.75.75 0 0 1 .53.217Z" /></g></svg>
);

export const ScissorsIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M7.848 8.25l1.536.887m-1.536.887a2.165 2.165 0 0 1 1.083 1.839V12m-1.083-1.024L4.22 15.3m3.628-6.163 11.32-6.508m-11.32 6.508 1.536.887m-1.536-.887-1.536.887m0 0 11.32 6.508" /><circle cx="6" cy="6" r="3" fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" /><circle cx="6" cy="18" r="3" fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" /><circle cx="18" cy="6" r="3" fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" /></g></svg>
);

export const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path fill="url(#accent-gradient)" stroke="white" strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" /></svg>
);

export const SpeakerWaveIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.66a9.206 9.206 0 0 0-4.322-2.385A9.71 9.71 0 0 0 12 2.25c-5.32 0-9.714 4.195-9.714 9.4s4.394 9.4 9.714 9.4c1.765 0 3.46-.49 4.9-1.354l-.324-.973c-1.282.52-2.677.817-4.14.817-4.404 0-7.974-3.447-7.974-7.66s3.57-7.66 7.974-7.66c1.077 0 2.115.228 3.064.673a8.81 8.81 0 0 1 3.238 2.05L19.114 5.66Z" /><path fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" strokeLinecap="round" strokeLinejoin="round" d="M15.75 9.75h.007874999999993v.007874999999993H15.75V9.75Zm0 3.75h.007874999999993v.007874999999993H15.75v-.007874999999993Zm0 3.75h.007874999999993v.007874999999993H15.75v-.007874999999993Z" /></g></svg>
);

export const StopIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><rect width="18" height="18" x="3" y="3" rx="2" fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" /><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" /></g></svg>
);

export const SwapIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></g></svg>
);

export const TextScanIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><rect width="20" height="20" x="2" y="2" rx="2" fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" /><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></g></svg>
);

export const TrashIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.067-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></g></svg>
);

export const UndoIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
    </svg>
);

export const UpscaleIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9V4.5M15 9h4.5M15 9l5.25-5.25M15 15v4.5M15 15h4.5M15 15l5.25 5.25" /></g></svg>
);

export const VariationsIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124" /><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="m7.5 10.376 3.375-3.375m0 0L14.25 4.5m-3.375 2.5 3.375 3.375" /><path fill="url(#glass-gradient)" stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5" /></g></svg>
);

export const WandIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" d="M9.528 3.472l.944-.944a3.75 3.75 0 0 1 5.304 5.304l-.944.944" /><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /><path fill="rgba(255,255,255,0.2)" stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="m9.528 3.472 6.992 6.992" /><path stroke="white" strokeOpacity="0.7" strokeLinecap="round" strokeLinejoin="round" d="M12.75 5.25 9 9" /></g></svg>
);

export const XMarkIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
);

export const ZoomInIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M10.5 7.5v6m3-3h-6" /></g></svg>
);

export const ZoomOutIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><IconDefs /><g filter="url(#drop-shadow)"><path fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.3)" strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /><path stroke="url(#accent-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5h-6" /></g></svg>
);
