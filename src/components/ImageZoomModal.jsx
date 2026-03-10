import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function ImageZoomModal({ url, alt = 'Artifact', onClose }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  // Mouse Dragging State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Touch Pinch/Pan State
  const [initialDistance, setInitialDistance] = useState(null);
  const [initialScale, setInitialScale] = useState(1);

  // Handle Mouse Wheel Zoom
  const handleWheel = (e) => {
    e.preventDefault(); // Prevent page scroll
    const scaleAdjust = e.deltaY * -0.002;
    const newScale = Math.min(Math.max(0.2, scale + scaleAdjust), 20);
    setScale(newScale);
  };

  // Handle Mouse Drag Start
  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return; // ignore close button
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  // Handle Mouse Drag Move
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Calculate distance between two touch points (Pythagorean theorem)
  const getDistance = (touches) => {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  };

  // Calculate midpoint between two touch points
  const getMidpoint = (touches) => {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  // Handle Touch Start
  const handleTouchStart = (e) => {
    if (e.target.closest('button')) return;
    
    // Single finger = Pan
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ 
        x: e.touches[0].clientX - position.x, 
        y: e.touches[0].clientY - position.y 
      });
    } 
    // Two fingers = Pinch to Zoom
    else if (e.touches.length === 2) {
      setIsDragging(false); // Disable panning while pinching to prevent jumping
      setInitialDistance(getDistance(e.touches));
      setInitialScale(scale);
    }
  };

  // Handle Touch Move
  const handleTouchMove = (e) => {
    e.preventDefault(); // Prevent pull-to-refresh and native scroll
    
    // Single finger pan update
    if (e.touches.length === 1 && isDragging) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    } 
    // Two finger pinch-to-zoom update
    else if (e.touches.length === 2 && initialDistance) {
      const currentDistance = getDistance(e.touches);
      const ratio = currentDistance / initialDistance;
      // Apply ratio to the scale we had *when the pinch started*
      const newScale = Math.min(Math.max(0.2, initialScale * ratio), 20);
      setScale(newScale);
    }
  };

  // Handle Touch End
  const handleTouchEnd = (e) => {
    setIsDragging(false);
    setInitialDistance(null);
  };

  // Lock body scroll when modal mounts
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[100] bg-sepia-950/95 backdrop-blur-sm animate-in fade-in duration-200 flex items-center justify-center overflow-hidden touch-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <button 
        className="fixed top-6 right-6 text-white/50 hover:text-white bg-black/50 p-3 rounded-full backdrop-blur-md z-[110] transition-colors shadow-lg" 
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X size={24} />
      </button>
      
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-sm font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-md z-[110] pointer-events-none whitespace-nowrap">
        {Math.round(scale * 100)}% • Pinch to Zoom • Drag to Pan
      </div>

      <img 
        src={url} 
        alt={alt} 
        draggable={false}
        className="max-w-[95vw] max-h-[95vh] object-contain shadow-2xl rounded-md cursor-grab active:cursor-grabbing select-none"
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transition: isDragging || initialDistance ? 'none' : 'transform 0.05s ease-out',
          transformOrigin: 'center'
        }} 
      />
    </div>
  );
}
