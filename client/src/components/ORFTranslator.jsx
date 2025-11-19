import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Copy, Download, AlertCircle, CheckCircle, RotateCw, X, Dna, Minus, Maximize2 } from 'lucide-react';

// Standard genetic code table
const GENETIC_CODE = {
  'TTT': 'F', 'TTC': 'F', 'TTA': 'L', 'TTG': 'L',
  'TCT': 'S', 'TCC': 'S', 'TCA': 'S', 'TCG': 'S',
  'TAT': 'Y', 'TAC': 'Y', 'TAA': '*', 'TAG': '*',
  'TGT': 'C', 'TGC': 'C', 'TGA': '*', 'TGG': 'W',
  'CTT': 'L', 'CTC': 'L', 'CTA': 'L', 'CTG': 'L',
  'CCT': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
  'CAT': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
  'CGT': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
  'ATT': 'I', 'ATC': 'I', 'ATA': 'I', 'ATG': 'M',
  'ACT': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T',
  'AAT': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K',
  'AGT': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R',
  'GTT': 'V', 'GTC': 'V', 'GTA': 'V', 'GTG': 'V',
  'GCT': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
  'GAT': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
  'GGT': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G'
};

// Amino acid full names for tooltips
const AMINO_ACID_NAMES = {
  'A': 'Alanine', 'R': 'Arginine', 'N': 'Asparagine', 'D': 'Aspartic acid',
  'C': 'Cysteine', 'Q': 'Glutamine', 'E': 'Glutamic acid', 'G': 'Glycine',
  'H': 'Histidine', 'I': 'Isoleucine', 'L': 'Leucine', 'K': 'Lysine',
  'M': 'Methionine', 'F': 'Phenylalanine', 'P': 'Proline', 'S': 'Serine',
  'T': 'Threonine', 'W': 'Tryptophan', 'Y': 'Tyrosine', 'V': 'Valine',
  '*': 'Stop codon'
};

const ORFTranslator = ({ isOpen, onClose, initialSequence = '', onMinimize, onRestore, minimizedStackIndex = 0, onFocus, zIndex = 50 }) => {
  const [dnaSequence, setDnaSequence] = useState(initialSequence);
  const [selectedFrame, setSelectedFrame] = useState(1);
  const [translations, setTranslations] = useState({});
  const [errors, setErrors] = useState([]);
  const [showCodonView, setShowCodonView] = useState(false);
  const [selectedRange, setSelectedRange] = useState(null);
  const [cleanDnaSequence, setCleanDnaSequence] = useState('');

  // Dragging and positioning state
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [savedPosition, setSavedPosition] = useState(null);
  const [animatingMinimize, setAnimatingMinimize] = useState(false);
  const modalRef = useRef(null);

  // RAF throttling refs
  const rafPending = useRef(false);
  const latestTouchPos = useRef({ clientX: 0, clientY: 0 });

  // Resize state
  const [size, setSize] = useState({ width: window.innerWidth * 0.6, height: window.innerHeight * 0.8 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    if (dnaSequence) {
      translateSequence();
    }
  }, [dnaSequence]);

  // Clear selection when frame changes
  useEffect(() => {
    setSelectedRange(null);
  }, [selectedFrame]);

  // Add document-level selection listener
  useEffect(() => {
    const handleDocumentSelection = () => {
      handleTextSelection();
    };

    document.addEventListener('mouseup', handleDocumentSelection);
    document.addEventListener('selectionchange', handleDocumentSelection);

    return () => {
      document.removeEventListener('mouseup', handleDocumentSelection);
      document.removeEventListener('selectionchange', handleDocumentSelection);
    };
  }, [translations, selectedFrame]); // Added selectedFrame dependency // Changed from currentTranslation to translations

  // Initialize position on first open (centered)
  useEffect(() => {
    if (isOpen && modalRef.current && !isMinimized) {
      const modalWidth = modalRef.current.offsetWidth;
      const modalHeight = modalRef.current.offsetHeight;
      const centerX = (window.innerWidth - modalWidth) / 2;
      const centerY = Math.max(50, (window.innerHeight - modalHeight) / 2);

      setPosition({ x: centerX, y: centerY });
    }
  }, [isOpen, isMinimized]);

  // Drag handlers
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.drag-handle')) {
      // Prevent default touch behavior to stop scrolling
      if (e.touches) {
        e.preventDefault();
      }

      setIsDragging(true);

      // Unified touch/mouse coordinate extraction
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      setDragOffset({
        x: clientX - position.x,
        y: clientY - position.y
      });
    }
  }, [position]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !modalRef.current) return;

    e.preventDefault();

    // Unified touch/mouse coordinate extraction
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // Store latest position
    latestTouchPos.current = { clientX, clientY };

    // Only schedule one RAF at a time to prevent flooding
    if (!rafPending.current) {
      rafPending.current = true;

      requestAnimationFrame(() => {
        rafPending.current = false;

        if (!modalRef.current) return;

        // Use the latest touch position
        const { clientX: latestX, clientY: latestY } = latestTouchPos.current;

        const modalWidth = modalRef.current.offsetWidth;
        const modalHeight = modalRef.current.offsetHeight;

        let newX = latestX - dragOffset.x;
        let newY = latestY - dragOffset.y;

        const minX = -modalWidth + 100;
        const maxX = window.innerWidth - 100;
        const minY = 0;
        const maxY = window.innerHeight - 60;

        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));

        setPosition({ x: newX, y: newY });
      });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Resize handlers (mouse-only)
  const handleResizeStart = useCallback((e) => {
    if (e.target.closest('.resize-handle')) {
      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: size.width,
        height: size.height
      });
    }
  }, [size]);

  const handleResizeMove = useCallback((e) => {
    if (!isResizing) return;

    e.preventDefault();

    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;

    const newWidth = Math.max(600, Math.min(window.innerWidth - 100, resizeStart.width + deltaX));
    const newHeight = Math.max(400, Math.min(window.innerHeight - 100, resizeStart.height + deltaY));

    setSize({ width: newWidth, height: newHeight });
  }, [isResizing, resizeStart]);

  const handleResizeUp = useCallback(() => {
    setIsResizing(false);
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
      document.addEventListener('touchmove', handleMouseMove, { passive: false });
      document.addEventListener('touchend', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleMouseMove);
        document.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Set up event listeners for resizing (mouse-only)
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeUp);

      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeUp);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeUp]);

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

  const validateDNASequence = (sequence) => {
    const cleanSequence = sequence.replace(/\s/g, '').toUpperCase();
    const validChars = /^[ATGC]*$/;
    const errors = [];

    if (!validChars.test(cleanSequence)) {
      const invalidChars = cleanSequence.match(/[^ATGC]/g);
      errors.push(`Invalid characters found: ${[...new Set(invalidChars)].join(', ')}. Only A, T, G, C are allowed.`);
    }

    if (cleanSequence.length === 0) {
      errors.push('Please enter a DNA sequence.');
    }

    if (cleanSequence.length < 3) {
      errors.push('Sequence must be at least 3 nucleotides long for translation.');
    }

    return { isValid: errors.length === 0, errors, cleanSequence };
  };

  const translateDNA = (sequence, frame) => {
    const startPos = frame - 1;
    const frameSequence = sequence.slice(startPos);
    const protein = [];
    const codons = [];

    for (let i = 0; i < frameSequence.length - 2; i += 3) {
      const codon = frameSequence.slice(i, i + 3);
      if (codon.length === 3) {
        const aminoAcid = GENETIC_CODE[codon] || 'X';
        protein.push(aminoAcid);
        codons.push(codon);
      }
    }

    return { protein: protein.join(''), codons };
  };

  const translateSequence = () => {
    const validation = validateDNASequence(dnaSequence);
    setErrors(validation.errors);
    setCleanDnaSequence(validation.cleanSequence);

    if (validation.isValid) {
      const newTranslations = {};
      for (let frame = 1; frame <= 3; frame++) {
        newTranslations[frame] = translateDNA(validation.cleanSequence, frame);
      }
      setTranslations(newTranslations);
    } else {
      setTranslations({});
      setCleanDnaSequence('');
    }
    
    // Clear selection when sequence changes
    setSelectedRange(null);
  };

  const handleSequenceChange = (e) => {
    setDnaSequence(e.target.value);
  };

  const clearSequence = () => {
    setDnaSequence('');
    setTranslations({});
    setErrors([]);
    setSelectedRange(null);
    setCleanDnaSequence('');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
    });
  };

  const downloadSequence = (frame) => {
    const translation = translations[frame];
    if (!translation) return;

    const content = `>Reading Frame +${frame}\n${translation.protein}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translation_frame_${frame}.fasta`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTextSelection = () => {
    setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      if (selectedText.length > 0) {
        // Get all the amino acid lines
        const proteinContainer = document.querySelector('.protein-sequence');
        if (proteinContainer) {
          // Use the current frame's translation
          const currentFrameTranslation = translations[selectedFrame];
          if (currentFrameTranslation) {
            const fullProteinText = currentFrameTranslation.protein;
            
            console.log('Selected frame:', selectedFrame);
            console.log('Selected text:', selectedText);
            console.log('Full protein text:', fullProteinText.substring(0, 100) + '...');
            
            // Find where this selection appears in the current frame's protein sequence
            const selectionIndex = fullProteinText.indexOf(selectedText);
            
            console.log('Selection index:', selectionIndex);
            
            if (selectionIndex !== -1) {
              setSelectedRange({
                start: selectionIndex,
                end: selectionIndex + selectedText.length,
                selectedText: selectedText
              });
              console.log('Set selection range:', selectionIndex, 'to', selectionIndex + selectedText.length);
            } else {
              console.log('Selection not found in protein sequence');
              setSelectedRange(null);
            }
          } else {
            console.log('No translation found for frame:', selectedFrame);
          }
        }
      } else {
        setSelectedRange(null);
      }
    }, 50);
  };

  const getCorrespondingDNA = () => {
    if (!selectedRange || !cleanDnaSequence || !currentTranslation) {
      return null;
    }
    
    const frameStart = selectedFrame - 1;
    const dnaStart = frameStart + (selectedRange.start * 3);
    const dnaEnd = frameStart + (selectedRange.end * 3);
    
    if (dnaEnd > cleanDnaSequence.length) {
      return null;
    }
    
    return {
      sequence: cleanDnaSequence.slice(dnaStart, dnaEnd),
      position: { start: dnaStart + 1, end: dnaEnd }
    };
  };

  const formatProteinSequence = (protein, codons, frame) => {
    if (showCodonView) {
      return codons.map((codon, index) => (
        <span
          key={index}
          className="inline-block mx-0.5 px-1 py-0.5 bg-blue-50 border border-blue-200 rounded text-xs font-mono"
          title={`${codon} → ${protein[index]} (${AMINO_ACID_NAMES[protein[index]] || 'Unknown'})`}
        >
          {codon}→{protein[index]}
        </span>
      ));
    } else {
      return (
        <div 
          className="protein-sequence font-mono text-xl tracking-wider select-text cursor-text"
          style={{ 
            userSelect: 'text',
            lineHeight: '1.5',
            wordBreak: 'break-all',
            width: '60ch', // Exactly 60 characters wide
            overflow: 'hidden'
          }}
        >
          {protein.split('').map((aa, index) => (
            <span
              key={index}
              className={`${
                aa === '*' ? 'text-red-600 font-bold' :
                aa === 'M' ? 'text-green-600 font-bold' :
                'text-gray-800'
              }`}
              title={`${AMINO_ACID_NAMES[aa] || 'Unknown'} (position ${index + 1})`}
            >
              {aa}
            </span>
          ))}
        </div>
      );
    }
  };

  const findORFs = (protein) => {
    const orfs = [];

    // Check for ORF from position 1 (index 0) to first stop codon
    const firstStopIndex = protein.indexOf('*');
    if (firstStopIndex !== -1 && firstStopIndex + 1 >= 10) {
      orfs.push({
        start: 0,
        end: firstStopIndex,
        sequence: protein.slice(0, firstStopIndex + 1),
        length: firstStopIndex + 1
      });
    }

    // Find all M-to-* ORFs
    let currentORF = null;
    for (let i = 0; i < protein.length; i++) {
      if (protein[i] === 'M' && !currentORF) {
        currentORF = { start: i, sequence: 'M' };
      } else if (currentORF) {
        currentORF.sequence += protein[i];
        if (protein[i] === '*' || i === protein.length - 1) {
          currentORF.end = i;
          currentORF.length = currentORF.sequence.length;

          if (currentORF.length >= 10) {
            // Check if this is different from any ORF we already added
            const isDuplicate = orfs.some(orf =>
              orf.start === currentORF.start && orf.end === currentORF.end
            );
            if (!isDuplicate) {
              orfs.push(currentORF);
            }
          }
          currentORF = null;
        }
      }
    }

    return orfs;
  };

  if (!isOpen) return null;

  const currentTranslation = translations[selectedFrame];
  const orfs = currentTranslation ? findORFs(currentTranslation.protein) : [];

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ display: isOpen ? 'block' : 'none', zIndex }}
    >
      {isMinimized ? (
        // Minimized view - compact pill in bottom-right corner
        <div
          className="absolute right-6 pointer-events-auto"
          style={{ bottom: `${24 + (minimizedStackIndex * 72)}px` }}
        >
          <button
            onClick={handleRestore}
            className="flex items-center space-x-3 bg-indigo-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-indigo-700 transition-all duration-200 hover:shadow-xl transform hover:scale-105 w-64"
          >
            <Dna className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium truncate">ORF Translator</span>
          </button>
        </div>
      ) : (
        // Full modal view
        <div
          ref={modalRef}
          className={`absolute bg-white rounded-lg shadow-2xl pointer-events-auto flex flex-col ${animatingMinimize ? 'transition-all duration-200 ease-in-out' : ''}`}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
            overflow: 'auto',
            touchAction: 'none',
            transform: (() => {
              if (animatingMinimize) {
                // Calculate translation to pill position (bottom-right corner)
                const pillX = window.innerWidth - 24 - 128; // right-6 (24px) + half pill width (128px)
                const pillY = window.innerHeight - (24 + (minimizedStackIndex * 72)) - 24; // bottom position + half pill height
                const translateX = pillX - position.x - (modalRef.current?.offsetWidth || 900) / 2;
                const translateY = pillY - position.y - (modalRef.current?.offsetHeight || 500) / 2;
                return `translate(${translateX}px, ${translateY}px) scale(0.8)`;
              }
              return 'scale(1)';
            })(),
            opacity: animatingMinimize ? 0 : 1
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
          onClick={onFocus}
        >
          {/* Header */}
          <div
            className={`drag-handle p-4 bg-indigo-600 rounded-t-lg ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            style={{ touchAction: 'none' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Dna className="w-5 h-5 text-white" />
                <h3 className="text-lg font-bold text-white">Open Reading Frame Translator</h3>
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

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          {/* Input Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              DNA Sequence (5' to 3')
            </label>
            <textarea
              value={dnaSequence}
              onChange={handleSequenceChange}
              placeholder="Enter DNA sequence (A, T, G, C only)..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500">
                Length: {dnaSequence.replace(/\s/g, '').length} nucleotides
              </p>
              <button
                onClick={clearSequence}
                className="text-xs text-red-600 hover:text-red-800 flex items-center space-x-1"
              >
                <RotateCw className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <h4 className="text-sm font-medium text-red-800">Input Errors:</h4>
              </div>
              <ul className="text-sm text-red-700 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Controls */}
          {Object.keys(translations).length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Reading Frame:</label>
                <div className="flex space-x-1">
                  {[1, 2, 3].map(frame => (
                    <button
                      key={frame}
                      onClick={() => setSelectedFrame(frame)}
                      className={`px-3 py-1 text-sm rounded ${
                        selectedFrame === frame
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      +{frame}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">View:</label>
                <button
                  onClick={() => setShowCodonView(!showCodonView)}
                  className={`px-3 py-1 text-sm rounded ${
                    showCodonView
                      ? 'bg-green-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {showCodonView ? 'Codon View' : 'Amino Acid View'}
                </button>
              </div>
            </div>
          )}

          {/* Translation Results */}
          {currentTranslation && (
            <div className="space-y-6">
              {/* Frame Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">
                  Reading Frame +{selectedFrame} Translation
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700 font-medium">Length:</span>
                    <span className="ml-2 text-blue-800">{currentTranslation.protein.length} amino acids</span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Stop codons:</span>
                    <span className="ml-2 text-blue-800">
                      {currentTranslation.protein.split('*').length - 1}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Potential ORFs:</span>
                    <span className="ml-2 text-blue-800">{orfs.length}</span>
                  </div>
                </div>
              </div>

              {/* Protein Sequence */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-medium text-gray-900">Protein Sequence</h5>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => copyToClipboard(currentTranslation.protein)}
                      className="p-1 text-gray-500 hover:text-gray-700"
                      title="Copy sequence"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => downloadSequence(selectedFrame)}
                      className="p-1 text-gray-500 hover:text-gray-700"
                      title="Download FASTA"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="font-mono text-sm p-3 bg-gray-50 border border-gray-200 rounded">
                  <div className={`protein-sequence ${showCodonView ? 'flex flex-wrap gap-0.5' : ''}`}>
                    {formatProteinSequence(currentTranslation.protein, currentTranslation.codons, selectedFrame)}
                  </div>
                </div>
                
                {!showCodonView && (
                  <div className="mt-2 text-xs text-gray-600">
                    Tip: Highlight amino acids to see corresponding DNA sequence
                  </div>
                )}
              </div>

              {/* Corresponding DNA Sequence */}
              {selectedRange && !showCodonView && (() => {
                const correspondingDNA = getCorrespondingDNA();
                return correspondingDNA ? (
                  <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                    <h5 className="font-medium text-blue-900 mb-3">
                      Corresponding DNA Sequence
                    </h5>
                    <div className="font-mono p-3 bg-white border border-blue-200 rounded text-gray-800 break-all">
                      <span className="text-blue-600 font-semibold">[{correspondingDNA.position.start}]</span>
                      <span className="mx-2">{correspondingDNA.sequence}</span>
                      <span className="text-blue-600 font-semibold">[{correspondingDNA.position.end}]</span>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => copyToClipboard(correspondingDNA.sequence)}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy DNA</span>
                      </button>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Open Reading Frames */}
              {orfs.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h5 className="font-medium text-gray-900 mb-3">
                    Open Reading Frames (≥10 amino acids)
                  </h5>
                  <div className="space-y-3">
                    {orfs.map((orf, index) => {
                      const dnaStart = selectedFrame + (orf.start * 3);
                      const dnaEnd = selectedFrame + (orf.end * 3) + 2;
                      return (
                        <div key={index} className="bg-green-50 border border-green-200 rounded p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-green-800">
                              ORF {index + 1}: Position {orf.start + 1} - {orf.end + 1} (DNA: {dnaStart}-{dnaEnd})
                            </span>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-green-600">
                                {orf.length} amino acids
                              </span>
                              <button
                                onClick={() => copyToClipboard(orf.sequence)}
                                className="p-1 text-green-600 hover:text-green-800"
                                title="Copy ORF sequence"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="font-mono text-xs text-green-700 break-all">
                            {orf.sequence}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All Frames Summary */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h5 className="font-medium text-gray-900 mb-3">All Reading Frames Summary</h5>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Frame</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Length (AA)</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Start Codons</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Stop Codons</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Potential ORFs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3].map(frame => {
                        const translation = translations[frame];
                        const frameORFs = translation ? findORFs(translation.protein) : [];
                        const startCount = translation ? (translation.protein.match(/M/g) || []).length : 0;
                        const stopCount = translation ? (translation.protein.match(/\*/g) || []).length : 0;
                        
                        return (
                          <tr key={frame} className={`border-b border-gray-100 ${selectedFrame === frame ? 'bg-blue-50' : ''}`}>
                            <td className="py-2 px-3 font-mono">+{frame}</td>
                            <td className="py-2 px-3">{translation ? translation.protein.length : 0}</td>
                            <td className="py-2 px-3">{startCount}</td>
                            <td className="py-2 px-3">{stopCount}</td>
                            <td className="py-2 px-3">{frameORFs.length}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h5 className="font-medium text-gray-900 mb-2">Legend</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="inline-block w-4 h-4 bg-green-100 border border-green-300 rounded"></span>
                  <span>Start codon (M - Methionine)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="inline-block w-4 h-4 bg-red-100 border border-red-300 rounded"></span>
                  <span>Stop codon (*)</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="inline-block w-4 h-4 bg-gray-50 border border-gray-200 rounded"></span>
                  <span>Regular amino acid</span>
                </div>
                <div className="text-xs text-gray-600">
                  Hover over amino acids for full names
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resize Handle (mouse-only) - 25% smaller than ChromatogramModal */}
        <div
          className="resize-handle absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize bg-indigo-600 hover:bg-indigo-700 rounded-tl-lg opacity-70 hover:opacity-100 transition-opacity flex items-center justify-center"
          onMouseDown={handleResizeStart}
          style={{ touchAction: 'auto' }}
        >
          <Maximize2 className="w-4 h-4 text-white" />
        </div>
        </div>
      )}
    </div>
  );
};

export default ORFTranslator;