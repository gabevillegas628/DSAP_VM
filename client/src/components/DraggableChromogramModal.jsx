import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, Move, Loader2, Minus, BarChart3 } from 'lucide-react';
import ChromatogramViewer from './ChromatogramViewer';

const DraggableChromogramModal = ({
  isOpen,
  onClose,
  chromatogramData,
  loading,
  fileName,
  fileType,
  onMinimize,
  onRestore,
  minimizedStackIndex = 0,
  onFocus,
  zIndex = 50
}) => {
  // Position state - start near top-right
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [savedPosition, setSavedPosition] = useState(null);
  const [animatingMinimize, setAnimatingMinimize] = useState(false);
  const modalRef = useRef(null);

  // Initialize position on first open (centered)
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const modalWidth = modalRef.current.offsetWidth;
      const modalHeight = modalRef.current.offsetHeight;
      const centerX = (window.innerWidth - modalWidth) / 2;
      const centerY = Math.max(50, (window.innerHeight - modalHeight) / 2);

      setPosition({ x: centerX, y: centerY });
    }
  }, [isOpen]);

  // Drag handlers adapted from WebcamCapture.jsx
  const handleMouseDown = useCallback((e) => {
    // Only allow dragging from the header
    if (e.target.closest('.drag-handle')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  }, [position]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !modalRef.current) return;

    e.preventDefault();

    const modalWidth = modalRef.current.offsetWidth;
    const modalHeight = modalRef.current.offsetHeight;

    // Calculate new position
    let newX = e.clientX - dragOffset.x;
    let newY = e.clientY - dragOffset.y;

    // Boundary checking - keep modal on screen
    const minX = -modalWidth + 100; // Allow partial off-screen
    const maxX = window.innerWidth - 100;
    const minY = 0; // Don't allow above viewport
    const maxY = window.innerHeight - 60; // Keep header visible

    newX = Math.max(minX, Math.min(maxX, newX));
    newY = Math.max(minY, Math.min(maxY, newY));

    setPosition({ x: newX, y: newY });
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Minimize/restore handlers
  const handleMinimize = useCallback(() => {
    setSavedPosition(position);
    setAnimatingMinimize(true);

    // Wait for animation to complete before actually minimizing
    setTimeout(() => {
      setIsMinimized(true);
      setAnimatingMinimize(false);
      if (onMinimize) {
        onMinimize();
      }
    }, 200);
  }, [position, onMinimize]);

  const handleRestore = useCallback(() => {
    setIsMinimized(false);

    if (savedPosition) {
      setPosition(savedPosition);
    }
    if (onRestore) {
      onRestore();
    }
  }, [savedPosition, onRestore]);

  // Set up event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle window resize - reposition if off-screen
  useEffect(() => {
    const handleResize = () => {
      if (!modalRef.current) return;

      const modalWidth = modalRef.current.offsetWidth;
      const maxX = window.innerWidth - 100;

      setPosition(prev => ({
        x: Math.min(prev.x, maxX),
        y: Math.min(prev.y, window.innerHeight - 60)
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    // Container with no backdrop - allows interaction with background
    // Keep mounted but hidden when closed to preserve ChromatogramViewer state
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ display: isOpen ? 'block' : 'none', zIndex }}
    >
      {/* Minimized view - compact pill in bottom-right corner */}
      <div
        className="absolute right-6 pointer-events-auto"
        style={{
          bottom: `${24 + (minimizedStackIndex * 72)}px`,
          display: isMinimized ? 'block' : 'none'
        }}
      >
        <button
          onClick={handleRestore}
          className="flex items-center space-x-3 bg-indigo-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-indigo-700 transition-all duration-200 hover:shadow-xl transform hover:scale-105 w-64"
        >
          <BarChart3 className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium truncate">
            {fileName ? `Chromatogram: ${fileName}` : 'Chromatogram Viewer'}
          </span>
        </button>
      </div>

      {/* Full modal view - Keep in DOM even when minimized to preserve state */}
      <div
        ref={modalRef}
        className={`absolute bg-white rounded-lg shadow-2xl pointer-events-auto flex flex-col ${animatingMinimize ? 'transition-all duration-200 ease-in-out' : ''}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '80vw',
          maxWidth: '1400px',
          maxHeight: '85vh',
          display: isMinimized && !animatingMinimize ? 'none' : 'flex',
          transform: (() => {
            if (animatingMinimize) {
              // Calculate translation to pill position (bottom-right corner)
              const pillX = window.innerWidth - 24 - 128; // right-6 (24px) + half pill width (128px)
              const pillY = window.innerHeight - (24 + (minimizedStackIndex * 72)) - 24; // bottom position + half pill height
              const translateX = pillX - position.x - (modalRef.current?.offsetWidth || 800) / 2;
              const translateY = pillY - position.y - (modalRef.current?.offsetHeight || 400) / 2;
              return `translate(${translateX}px, ${translateY}px) scale(0.8)`;
            }
            return 'scale(1)';
          })(),
          opacity: animatingMinimize ? 0 : 1
        }}
        onMouseDown={handleMouseDown}
        onClick={onFocus}
      >
        {/* Draggable Header */}
        <div
          className={`drag-handle bg-indigo-600 p-4 text-white rounded-t-lg ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <h3 className="text-lg font-bold">Chromatogram Viewer</h3>
              {fileName && (
                <span className="text-sm text-indigo-100">- {fileName}</span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleMinimize}
                className="text-white hover:text-gray-200 transition-colors p-1 rounded hover:bg-white/20"
                title="Minimize"
              >
                <Minus className="w-6 h-6" />
              </button>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors p-1 rounded hover:bg-white/20"
                title="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-auto p-4 bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <span className="ml-3 text-gray-600">Loading chromatogram...</span>
            </div>
          ) : chromatogramData ? (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <ChromatogramViewer
                fileData={chromatogramData}
                fileName={fileName}
                fileType={fileType}
                onClose={onClose}
              />
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-600">No chromatogram data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DraggableChromogramModal;
