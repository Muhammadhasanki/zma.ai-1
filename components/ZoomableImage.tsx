
import React, { useState, useRef, WheelEvent, MouseEvent } from 'react';
import { ZoomInIcon, ZoomOutIcon, ExpandIcon } from './icons';

const ZoomableImage: React.FC<{ src: string, alt: string }> = ({ src, alt }) => {
    const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const isPanning = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const scaleAmount = -e.deltaY * 0.001;
        const newScale = Math.max(0.5, Math.min(transform.scale + scaleAmount, 5));

        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newX = transform.x - (mouseX - transform.x) * (newScale / transform.scale - 1);
        const newY = transform.y - (mouseY - transform.y) * (newScale / transform.scale - 1);

        setTransform({ scale: newScale, x: newX, y: newY });
    };

    const handleMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        isPanning.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isPanning.current) return;
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        isPanning.current = false;
        if (containerRef.current) containerRef.current.style.cursor = 'grab';
    };

    const zoom = (direction: 'in' | 'out') => {
        const scaleAmount = direction === 'in' ? 0.2 : -0.2;
        const newScale = Math.max(0.5, Math.min(transform.scale + scaleAmount, 5));
        setTransform(prev => ({ ...prev, scale: newScale }));
    };

    const reset = () => {
        setTransform({ scale: 1, x: 0, y: 0 });
    };

    return (
        <div className="relative w-full h-full overflow-hidden bg-[var(--bg-tertiary)] rounded-xl select-none" ref={containerRef} onWheel={handleWheel}>
            <img
                src={src}
                alt={alt}
                className="absolute transition-transform duration-100 ease-out h-full w-full object-contain"
                style={{
                    transformOrigin: 'center center',
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                    cursor: 'grab'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                draggable="false"
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass-card p-1.5 rounded-full flex items-center gap-1">
                <button onClick={() => zoom('out')} className="p-2 rounded-full hover:bg-[var(--border-primary)] transition-colors" aria-label="Zoom out"><ZoomOutIcon className="w-5 h-5" /></button>
                <button onClick={reset} className="p-2 rounded-full hover:bg-[var(--border-primary)] transition-colors" aria-label="Reset zoom"><ExpandIcon className="w-5 h-5" /></button>
                <button onClick={() => zoom('in')} className="p-2 rounded-full hover:bg-[var(--border-primary)] transition-colors" aria-label="Zoom in"><ZoomInIcon className="w-5 h-5" /></button>
            </div>
        </div>
    );
};

export default ZoomableImage;