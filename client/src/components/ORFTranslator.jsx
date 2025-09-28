import React, { useState, useEffect } from 'react';
import { Copy, Download, AlertCircle, CheckCircle, RotateCw, X, Dna } from 'lucide-react';

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

const ORFTranslator = ({ isOpen, onClose, initialSequence = '' }) => {
  const [dnaSequence, setDnaSequence] = useState(initialSequence);
  const [selectedFrame, setSelectedFrame] = useState(1);
  const [translations, setTranslations] = useState({});
  const [errors, setErrors] = useState([]);
  const [showCodonView, setShowCodonView] = useState(false);
  const [selectedRange, setSelectedRange] = useState(null);
  const [cleanDnaSequence, setCleanDnaSequence] = useState('');

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
    let currentORF = null;

    for (let i = 0; i < protein.length; i++) {
      if (protein[i] === 'M' && !currentORF) {
        currentORF = { start: i, sequence: 'M' };
      } else if (currentORF) {
        currentORF.sequence += protein[i];
        if (protein[i] === '*') {
          currentORF.end = i;
          currentORF.length = currentORF.sequence.length;
          orfs.push(currentORF);
          currentORF = null;
        }
      }
    }

    return orfs.filter(orf => orf.length >= 10); // Only show ORFs with 10+ amino acids
  };

  if (!isOpen) return null;

  const currentTranslation = translations[selectedFrame];
  const orfs = currentTranslation ? findORFs(currentTranslation.protein) : [];

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Open Reading Frame Translator</h3>
              <p className="text-sm text-gray-600 mt-1">
                Translate DNA sequences to proteins using the standard genetic code
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
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
                    <h5 className="font-medium text-blue-900 mb-2">
                      Corresponding DNA Sequence
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-blue-700 font-medium">Selected amino acids:</span>
                        <span className="ml-2 font-mono text-blue-800">{selectedRange.selectedText}</span>
                      </div>
                      <div>
                        <span className="text-blue-700 font-medium">DNA position:</span>
                        <span className="ml-2 text-blue-800">
                          {correspondingDNA.position.start} - {correspondingDNA.position.end}
                        </span>
                      </div>
                    </div>
                    <div className="font-mono p-3 bg-white border border-blue-200 rounded">
                      {(() => {
                        const dnaSeq = correspondingDNA.sequence;
                        const lines = [];
                        
                        // Split DNA into lines of 60 characters (20 codons per line)
                        for (let i = 0; i < dnaSeq.length; i += 60) {
                          lines.push(dnaSeq.slice(i, i + 60));
                        }
                        
                        return lines.map((line, lineIndex) => (
                          <div key={lineIndex} className="mb-2">
                            <div className="flex">
                              <span className="text-xs text-blue-500 w-12 flex-shrink-0 mr-2 mt-1 select-none">
                                {correspondingDNA.position.start + (lineIndex * 60)}
                              </span>
                              <span className="text-lg tracking-wider">
                                {line.split('').map((nucleotide, index) => (
                                  <span
                                    key={lineIndex * 60 + index}
                                    className={`${
                                      (lineIndex * 60 + index) % 3 === 0 ? 'border-l-2 border-blue-300 pl-0.5 ml-1' : ''
                                    } ${
                                      nucleotide === 'A' ? 'text-red-600' :
                                      nucleotide === 'T' ? 'text-blue-600' :
                                      nucleotide === 'G' ? 'text-green-600' :
                                      'text-orange-600'
                                    }`}
                                  >
                                    {nucleotide}
                                  </span>
                                ))}
                              </span>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      <div className="text-xs text-blue-600">
                        Codons are separated by vertical lines • Position numbers show DNA coordinates
                      </div>
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
                    {orfs.map((orf, index) => (
                      <div key={index} className="bg-green-50 border border-green-200 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-green-800">
                            ORF {index + 1}: Position {orf.start + 1} - {orf.end + 1}
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
                    ))}
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
      </div>
    </div>
  );
};

export default ORFTranslator;