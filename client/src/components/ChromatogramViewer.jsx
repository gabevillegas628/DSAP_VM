import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';

const ChromatogramViewer = ({ fileData, fileName, onClose }) => {
  console.log('ChromatogramViewer props:', { fileData, fileName }); // Debug log
  const canvasRef = useRef(null);
  const [parsedData, setParsedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(2.5);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showChannels, setShowChannels] = useState({
    A: true,
    T: true,
    G: true,
    C: true
  });
  const [qualityThreshold, setQualityThreshold] = useState(20);
  const [hoveredPosition, setHoveredPosition] = useState(null);

  // Add state for selected position
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [selectedNucleotide, setSelectedNucleotide] = useState(null);

  // Add state for highligting regions
  const [highlightStart, setHighlightStart] = useState('');
  const [highlightEnd, setHighlightEnd] = useState('');
  const [showHighlight, setShowHighlight] = useState(false);

  // Add state for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editedPositions, setEditedPositions] = useState(new Set());

  useEffect(() => {
    if (fileData) {
      parseChromatogramFile(fileData);
    }
  }, [fileData]);

  // FIX: Improved effect with proper cleanup and timing
  useEffect(() => {
    if (parsedData && canvasRef.current) {
      const timer = setTimeout(() => {
        drawChromatogram();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [parsedData, zoomLevel, scrollPosition, showChannels, qualityThreshold, selectedPosition, hoveredPosition, isEditing]);

  // FIX: Add cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup canvas context if component unmounts
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };
  }, []);

  // Handle window resize events
  useEffect(() => {
    const handleResize = () => {
      if (parsedData) {
        // Add small delay to avoid rapid redraws
        setTimeout(() => {
          drawChromatogram();
        }, 100);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [parsedData]);

  // Add this useEffect for wheel event handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const scrollDelta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      const scrollAmount = scrollDelta > 0 ? 0.0007 : -0.0007;

      setScrollPosition(prev => Math.max(0, Math.min(1, prev + scrollAmount)));

      return false;
    };

    // Add with passive: false to ensure preventDefault works
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [scrollPosition]);

  const handleSaveEdit = () => {
    if (!editValue || selectedPosition === null) return;

    // Create a new copy of the baseCalls array with the edit
    const newBaseCalls = [...parsedData.baseCalls];
    newBaseCalls[selectedPosition] = editValue;

    // Update the parsedData with the new base calls
    const newParsedData = {
      ...parsedData,
      baseCalls: newBaseCalls,
      sequence: newBaseCalls.join('') // Update the sequence string too
    };

    // Track that this position was edited
    setEditedPositions(prev => new Set([...prev, selectedPosition]));

    setParsedData(newParsedData);

    // Update the selected nucleotide display
    setSelectedNucleotide(editValue);

    // Exit editing mode
    setIsEditing(false);
    setEditValue('');

    console.log(`Edited position ${selectedPosition + 1} from ${selectedNucleotide} to ${editValue}`);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue('');
  };


  const parseChromatogramFile = async (data) => {
    try {
      setLoading(true);
      console.log('parseChromatogramFile called with data:', data, 'fileName:', fileName);

      let parsedData;

      // Check if we have real binary data or mock indicator
      if (data === 'mock' || !data || data.length < 100) {
        console.log('Using mock data - no real file available');
        parsedData = generateMockChromatogramData(fileName || 'unknown');
      } else {
        console.log('Parsing real file data, size:', data.length, 'bytes');
        try {
          // Detect file type
          const fileType = detectFileType(data);
          console.log('Detected file type:', fileType);

          if (fileType === 'SCF') {
            parsedData = parseRealSCFData(data, fileName);
          } else if (fileType === 'AB1') {
            parsedData = parseRealAB1Data(data, fileName);
          } else {
            throw new Error('Unsupported file format - not AB1 or SCF');
          }
        } catch (parseError) {
          console.error('Failed to parse file data, falling back to mock:', parseError);
          parsedData = generateMockChromatogramData(fileName || 'unknown');
        }
      }

      setParsedData(parsedData);
      setLoading(false);
    } catch (err) {
      console.error('Error in parseChromatogramFile:', err);
      setError('Failed to parse chromatogram file: ' + err.message);
      setLoading(false);
    }
  };

  // File type detection function
  const detectFileType = (uint8Array) => {
    if (uint8Array.length < 4) {
      throw new Error('File too small to determine type');
    }

    // Check for SCF magic bytes: 2E 73 63 66 (.scf in ASCII)
    if (uint8Array[0] === 0x2E && uint8Array[1] === 0x73 &&
      uint8Array[2] === 0x63 && uint8Array[3] === 0x66) {
      return 'SCF';
    }

    // Check for AB1 magic bytes: ABIF
    const signature = new TextDecoder().decode(uint8Array.slice(0, 4));
    if (signature === 'ABIF') {
      return 'AB1';
    }

    throw new Error('Unknown file format - not AB1 or SCF');
  };

  // New function to parse real SCF binary data
  // New function to parse real SCF binary data
  const parseRealSCFData = (uint8Array, fileName) => {
    console.log('Starting real SCF parsing...');

    // SCF files start with ".scf" signature (2E 73 63 66)
    if (uint8Array[0] !== 0x2E || uint8Array[1] !== 0x73 ||
      uint8Array[2] !== 0x63 || uint8Array[3] !== 0x66) {
      throw new Error('Not a valid SCF file - missing .scf signature');
    }

    // Create DataView for reading binary data
    const dataView = new DataView(uint8Array.buffer);

    // SCF header structure (starting at byte 0)
    const magic = dataView.getUint32(0, false); // Should be 0x2E736366 (.scf)
    const samples = dataView.getUint32(4, false); // Number of sample points
    const samplesOffset = dataView.getUint32(8, false); // Offset to sample data
    const bases = dataView.getUint32(12, false); // Number of bases
    const basesLeftClip = dataView.getUint32(16, false); // Left clip point
    const basesRightClip = dataView.getUint32(20, false); // Right clip point  
    const basesOffset = dataView.getUint32(24, false); // Offset to base data
    const commentsSize = dataView.getUint32(28, false); // Size of comments
    const commentsOffset = dataView.getUint32(32, false); // Offset to comments
    const version = new TextDecoder().decode(uint8Array.slice(36, 40)); // Version string
    const sampleSize = dataView.getUint32(40, false); // Sample size (1 or 2 bytes)
    const codeSet = dataView.getUint32(44, false); // Code set
    const privateSize = dataView.getUint32(48, false); // Private data size
    const privateOffset = dataView.getUint32(52, false); // Private data offset

    console.log(`SCF file: ${samples} samples, ${bases} bases, version ${version}`);

    // Validate header values
    if (samples === 0 || bases === 0) {
      throw new Error('Invalid SCF file - no samples or bases found');
    }

    console.log('SCF Header Details:', {
      samples,
      samplesOffset,
      bases,
      basesOffset,
      sampleSize,
      version: version.replace(/\0/g, ''), // Remove null bytes
      codeSet
    });

    // Read trace data (samples)
    const traces = { A: [], T: [], G: [], C: [] };
    const channels = ['A', 'C', 'G', 'T']; // SCF standard order

    // SCF stores 4 channels of sample data
    for (let channel = 0; channel < 4; channel++) {
      const channelName = channels[channel];
      const channelOffset = samplesOffset + (channel * samples * sampleSize);

      for (let i = 0; i < samples; i++) {
        const sampleOffset = channelOffset + (i * sampleSize);
        let value;

        if (sampleSize === 1) {
          // 8-bit samples
          value = uint8Array[sampleOffset];
        } else if (sampleSize === 2) {
          // 16-bit samples (big-endian)
          value = dataView.getUint16(sampleOffset, false);
        } else {
          throw new Error(`Unsupported sample size: ${sampleSize}`);
        }

        traces[channelName].push(value);
      }

      console.log(`Loaded ${traces[channelName].length} trace points for channel ${channelName}`);
    }

    // Apply smoothing to SCF traces
    console.log('Applying smoothing to SCF traces...');
    traces.A = smoothData(traces.A, 3);
    traces.C = smoothData(traces.C, 3);
    traces.G = smoothData(traces.G, 3);
    traces.T = smoothData(traces.T, 3);

    // Read base call data
    const baseCalls = [];
    const quality = [];
    const peakLocations = [];

    // Each base entry is 12 bytes in SCF format
    const baseEntrySize = 12;

    for (let i = 0; i < bases; i++) {
      const baseOffset = basesOffset + (i * baseEntrySize);

      if (baseOffset + baseEntrySize > uint8Array.length) {
        console.warn(`Base ${i} extends beyond file length, stopping at ${baseCalls.length} bases`);
        break;
      }

      try {
        // Read all the base entry data first
        const peakIndex = dataView.getUint16(baseOffset, false); // SCF uses 16-bit peak locations
        const probA = uint8Array[baseOffset + 4] || 0;
        const probC = uint8Array[baseOffset + 5] || 0;
        const probG = uint8Array[baseOffset + 6] || 0;
        const probT = uint8Array[baseOffset + 7] || 0;

        // For this SCF variant, always use estimated peak positions
        const estimatedPeak = Math.floor((i / bases) * samples);
        peakLocations.push(estimatedPeak);

        // Enhanced debugging for problematic range
        if (i >= 405 && i <= 410) {
          const byte0 = uint8Array[baseOffset];
          const byte1 = uint8Array[baseOffset + 1];
          const byte2 = uint8Array[baseOffset + 2];
          const byte3 = uint8Array[baseOffset + 3];
          const peak16 = dataView.getUint16(baseOffset, false);
          const peak32 = dataView.getUint32(baseOffset, false);
          console.log(`Base ${i}: bytes=[${byte0}, ${byte1}, ${byte2}, ${byte3}], peak16=${peak16}, peak32=${peak32}, probs=[A:${probA}, C:${probC}, G:${probG}, T:${probT}]`);
        }

        // Peak location handling with better validation
        // Peak location handling - use estimated positions for SCF files
        // SCF peak data in this file appears unreliable, so we'll calculate positions
        peakLocations.push(estimatedPeak);

        // Debug comparison for a few bases
        if (i >= 405 && i <= 410) {
          const storedPeak16 = dataView.getUint16(baseOffset, false);
          const storedPeak32 = dataView.getUint32(baseOffset, false);
          console.log(`Base ${i}: stored16=${storedPeak16}, stored32=${storedPeak32}, estimated=${estimatedPeak}, probs=[A:${probA}, C:${probC}, G:${probG}, T:${probT}]`);
        }

        if (i >= 405 && i <= 410) {
          console.log(`=== Base ${i} - Full 12-byte structure ===`);
          for (let j = 0; j < 12; j++) {
            const byteVal = uint8Array[baseOffset + j];
            console.log(`  Byte ${j}: ${byteVal} (0x${byteVal.toString(16).padStart(2, '0')}) = '${byteVal > 31 && byteVal < 127 ? String.fromCharCode(byteVal) : 'non-printable'}'`);
          }

          // Try reading peak index from different positions
          const peak_0_16 = dataView.getUint16(baseOffset + 0, false);
          const peak_0_32 = dataView.getUint32(baseOffset + 0, false);
          const peak_2_16 = dataView.getUint16(baseOffset + 2, false);
          const peak_4_16 = dataView.getUint16(baseOffset + 4, false);

          console.log(`  Peak attempts: @0(16)=${peak_0_16}, @0(32)=${peak_0_32}, @2(16)=${peak_2_16}, @4(16)=${peak_4_16}`);
          console.log(`  Probs: A:${probA}, C:${probC}, G:${probG}, T:${probT}`);
          console.log('');
        }

        // Base call determination with multiple methods
        const rawByteValue = uint8Array[baseOffset + 8];
        let baseCall = 'N';

        // Method 1: Try ASCII character at byte 8
        if (rawByteValue >= 65 && rawByteValue <= 90) {
          baseCall = String.fromCharCode(rawByteValue);
        } else if (rawByteValue >= 97 && rawByteValue <= 122) {
          baseCall = String.fromCharCode(rawByteValue).toUpperCase();
        } else {
          // Method 2: Derive from probability values
          const maxProb = Math.max(probA, probC, probG, probT);
          if (maxProb > 0) {
            if (probA === maxProb) {
              baseCall = 'A';
            } else if (probC === maxProb) {
              baseCall = 'C';
            } else if (probG === maxProb) {
              baseCall = 'G';
            } else if (probT === maxProb) {
              baseCall = 'T';
            }
          }

          // Method 3: Try other bytes if still 'N'
          if (baseCall === 'N' && maxProb === 0) {
            for (let j = 9; j < 12; j++) {
              const altByte = uint8Array[baseOffset + j];
              if (altByte >= 65 && altByte <= 90) {
                baseCall = String.fromCharCode(altByte);
                break;
              } else if (altByte >= 97 && altByte <= 122) {
                baseCall = String.fromCharCode(altByte).toUpperCase();
                break;
              }
            }
          }
        }

        // Debug base call derivation for first 10 bases
        if (i < 10) {
          const maxProb = Math.max(probA, probC, probG, probT);
          console.log(`Base ${i}: derived='${baseCall}' from probs [A:${probA}, C:${probC}, G:${probG}, T:${probT}], max=${maxProb}`);
        }

        // Final validation
        if (!/^[ATGCN]$/.test(baseCall)) {
          baseCall = 'N';
        }

        baseCalls.push(baseCall);

        // Calculate quality score
        const maxProb = Math.max(probA, probC, probG, probT);
        const qualityScore = maxProb > 0 ? Math.round((maxProb / 255) * 60) : 20;
        quality.push(qualityScore);

      } catch (error) {
        console.warn(`Error reading base ${i}:`, error);
        baseCalls.push('N');
        quality.push(20);
        peakLocations.push(Math.floor((i / bases) * samples));
      }
    }

    console.log(`Successfully read ${baseCalls.length} bases`);
    console.log('First 10 bases:', baseCalls.slice(0, 10));
    console.log('First 10 peak locations:', peakLocations.slice(0, 10));
    console.log('Base call distribution:', {
      A: baseCalls.filter(b => b === 'A').length,
      T: baseCalls.filter(b => b === 'T').length,
      G: baseCalls.filter(b => b === 'G').length,
      C: baseCalls.filter(b => b === 'C').length,
      N: baseCalls.filter(b => b === 'N').length
    });

    console.log(`Loaded ${baseCalls.length} base calls with peak locations`);

    // Build sequence string  
    const sequence = baseCalls.join('');

    // Validate we have data
    if (Object.values(traces).every(trace => trace.length === 0)) {
      throw new Error('No trace data found in SCF file');
    }

    if (baseCalls.length === 0) {
      throw new Error('No base calls found in SCF file');
    }

    console.log(`Successfully parsed SCF: ${sequence.length} bases, ${samples} trace points`);

    return {
      sequence,
      traces,
      quality,
      baseCalls,
      peakLocations,
      fileName: fileName || 'parsed.scf',
      sequenceLength: baseCalls.length,
      fileFormat: 'SCF'
    };
  };

  // New function to parse real AB1 binary data
  const parseRealAB1Data = (uint8Array, fileName) => {
    console.log('Starting real AB1 parsing...');

    // AB1 files start with "ABIF" signature
    const signature = new TextDecoder().decode(uint8Array.slice(0, 4));
    if (signature !== 'ABIF') {
      throw new Error('Not a valid AB1 file - missing ABIF signature');
    }

    // Create DataView for reading binary data
    const dataView = new DataView(uint8Array.buffer);

    // Read the directory structure (starts at byte 26)
    const directoryOffset = dataView.getUint32(26, false); // big endian
    const numEntries = dataView.getUint32(18, false);

    console.log(`AB1 file has ${numEntries} directory entries at offset ${directoryOffset}`);

    // Parse directory entries to find data we need
    const entries = {};
    for (let i = 0; i < numEntries; i++) {
      const entryOffset = directoryOffset + (i * 28);

      // Read entry header
      const name = new TextDecoder().decode(uint8Array.slice(entryOffset, entryOffset + 4));
      const number = dataView.getUint32(entryOffset + 4, false);
      const elementType = dataView.getUint16(entryOffset + 8, false);
      const elementSize = dataView.getUint16(entryOffset + 10, false);
      const numElements = dataView.getUint32(entryOffset + 12, false);
      const dataSize = dataView.getUint32(entryOffset + 16, false);
      const dataOffset = dataView.getUint32(entryOffset + 20, false);

      const key = `${name}${number}`;
      entries[key] = {
        name,
        number,
        elementType,
        elementSize,
        numElements,
        dataSize,
        dataOffset
      };
    }

    console.log('Found AB1 entries:', Object.keys(entries));

    // Extract trace data (DATA tags 9-12) and map to correct channels
    const traces = { A: [], T: [], G: [], C: [] };

    // Check if there's a channel order tag (FWO_1) to get the correct mapping
    let channelOrder = ['A', 'T', 'G', 'C']; // default order
    if (entries['FWO_1']) {
      const entry = entries['FWO_1'];
      const orderData = uint8Array.slice(entry.dataOffset, entry.dataOffset + entry.dataSize);
      channelOrder = Array.from(orderData).map(byte => String.fromCharCode(byte)).filter(char => /[ATGC]/.test(char));
      console.log('Found channel order:', channelOrder);
    }

    // If no FWO tag or it's incomplete, try common mappings
    if (channelOrder.length !== 4) {
      // ABI 3730/3130 common order is G,A,T,C for DATA9-12
      channelOrder = ['G', 'A', 'T', 'C'];
      console.log('Using default channel order:', channelOrder);
    }

    for (let i = 0; i < 4; i++) {
      const dataKey = `DATA${9 + i}`;
      if (entries[dataKey] && i < channelOrder.length) {
        const entry = entries[dataKey];
        const traceData = [];

        // Read trace values (usually 16-bit integers)
        for (let j = 0; j < entry.numElements; j++) {
          const offset = entry.dataOffset + (j * 2);
          if (offset + 1 < uint8Array.length) {
            const value = dataView.getUint16(offset, false);
            traceData.push(value);
          }
        }

        const channel = channelOrder[i];
        traces[channel] = traceData;
        console.log(`Loaded ${traceData.length} trace points for DATA${9 + i} -> channel ${channel}`);
      }
    }

    // Extract base calls (PBAS tag)
    let baseCalls = [];
    if (entries['PBAS1']) {
      const entry = entries['PBAS1'];
      const baseCallData = uint8Array.slice(entry.dataOffset, entry.dataOffset + entry.dataSize);
      baseCalls = Array.from(baseCallData).map(byte => String.fromCharCode(byte)).filter(char => /[ATGCN]/.test(char));
      console.log(`Loaded ${baseCalls.length} base calls`);
    }

    // Extract quality scores (PCON tag)
    let quality = [];
    if (entries['PCON1']) {
      const entry = entries['PCON1'];
      for (let i = 0; i < entry.numElements && i < baseCalls.length; i++) {
        const offset = entry.dataOffset + i;
        if (offset < uint8Array.length) {
          quality.push(uint8Array[offset]);
        }
      }
      console.log(`Loaded ${quality.length} quality scores`);
    }

    // If we don't have quality data, generate reasonable defaults
    if (quality.length === 0 && baseCalls.length > 0) {
      quality = baseCalls.map(() => Math.floor(Math.random() * 40) + 20);
      console.log('Generated default quality scores');
    }

    const maxTraceLength = Math.max(...Object.values(traces).map(t => t.length));

    // Extract peak locations (PLOC tag)
    let peakLocations = [];
    if (entries['PLOC1']) {
      const entry = entries['PLOC1'];
      for (let i = 0; i < entry.numElements && i < baseCalls.length; i++) {
        const offset = entry.dataOffset + (i * 2);
        if (offset + 1 < uint8Array.length) {
          const peakPos = dataView.getUint16(offset, false);
          peakLocations.push(peakPos);
        }
      }
      console.log(`Loaded ${peakLocations.length} peak locations`);
    }

    // If no peak locations found, calculate estimated positions
    if (peakLocations.length === 0 && baseCalls.length > 0) {
      const estimatedSpacing = maxTraceLength / baseCalls.length;
      peakLocations = baseCalls.map((_, i) => Math.round(i * estimatedSpacing));
      console.log('Generated estimated peak locations');
    }

    // Build sequence string
    const sequence = baseCalls.join('');

    // Validate we have data
    if (Object.values(traces).every(trace => trace.length === 0)) {
      throw new Error('No trace data found in AB1 file');
    }

    if (baseCalls.length === 0) {
      throw new Error('No base calls found in AB1 file');
    }

    console.log(`Successfully parsed AB1: ${sequence.length} bases, ${Math.max(...Object.values(traces).map(t => t.length))} trace points`);

    return {
      sequence,
      traces,
      quality,
      baseCalls,
      peakLocations,
      fileName: fileName || 'parsed.ab1',
      sequenceLength: baseCalls.length,
      fileFormat: 'AB1'
    };
  };

  // Generate mock chromatogram data for demonstration
  const generateMockChromatogramData = (fileName) => {
    console.log('generateMockChromatogramData called with fileName:', fileName); // Debug log

    const sequenceLength = 800;
    const sequence = generateRandomSequence(sequenceLength);
    const traces = {
      A: [],
      T: [],
      G: [],
      C: []
    };
    const quality = [];
    const baseCalls = [];

    for (let i = 0; i < sequenceLength * 4; i++) {
      const x = i;
      const baseIndex = Math.floor(i / 4);
      const base = sequence[baseIndex] || 'N';
      const noise = (Math.random() - 0.5) * 50;

      // Generate realistic-looking peaks
      traces.A[i] = generatePeak(x, baseIndex, base === 'A', 100) + noise;
      traces.T[i] = generatePeak(x, baseIndex, base === 'T', 80) + noise;
      traces.G[i] = generatePeak(x, baseIndex, base === 'G', 120) + noise;
      traces.C[i] = generatePeak(x, baseIndex, base === 'C', 90) + noise;

      if (i % 4 === 0) {
        baseCalls.push(base);
        quality.push(Math.max(10, Math.min(60, 40 + Math.random() * 20 - baseIndex * 0.05)));
      }
    }

    // Apply smoothing to all traces (increased smoothing)
    traces.A = smoothData(traces.A, 9);
    traces.T = smoothData(traces.T, 9);
    traces.G = smoothData(traces.G, 9);
    traces.C = smoothData(traces.C, 9);

    return {
      sequence,
      traces,
      quality,
      baseCalls,
      fileName: fileName || 'unknown.ab1', // Add fallback
      sequenceLength,
      fileFormat: 'MOCK'
    };
  };

  const generateRandomSequence = (length) => {
    const bases = ['A', 'T', 'G', 'C'];
    return Array.from({ length }, () => bases[Math.floor(Math.random() * bases.length)]).join('');
  };

  const generatePeak = (x, baseIndex, isPeak, maxHeight) => {
    const peakCenter = baseIndex * 4 + 2;
    const distance = Math.abs(x - peakCenter);
    const width = 2;

    if (isPeak && distance < width * 2) {
      return maxHeight * Math.exp(-(distance * distance) / (2 * width * width));
    }
    return Math.random() * 15; // Background noise
  };

  // Smoothing function to reduce noise (enhanced)
  const smoothData = (data, windowSize = 7) => {
    const smoothed = [...data];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = halfWindow; i < data.length - halfWindow; i++) {
      let sum = 0;
      let weightSum = 0;

      // Apply Gaussian-like weighting for better smoothing
      for (let j = -halfWindow; j <= halfWindow; j++) {
        const weight = Math.exp(-(j * j) / (2 * (halfWindow / 2) * (halfWindow / 2)));
        sum += data[i + j] * weight;
        weightSum += weight;
      }
      smoothed[i] = sum / weightSum;
    }

    return smoothed;
  };

  // FIX: Helper function for consistent position calculation
  const getBaseXPosition = (baseIndex, startIndex, endIndex, canvasWidth) => {
    return ((baseIndex * 4 - startIndex) / (endIndex - startIndex)) * canvasWidth;
  };

  const drawChromatogram = () => {
    const canvas = canvasRef.current;
    if (!canvas || !parsedData) return;

    const ctx = canvas.getContext('2d');
    const { traces, quality, baseCalls } = parsedData;

    // Validate trace data
    const traceLengths = Object.values(traces).map(trace => trace.length);
    const maxTraceLength = Math.max(...traceLengths);

    if (maxTraceLength === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#FF0000';
      ctx.font = '16px sans-serif';
      ctx.fillText('No trace data available', 50, 50);
      return;
    }

    // Set canvas size
    canvas.width = 1200;
    canvas.height = 200;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate visible range
    const dataLength = maxTraceLength;
    const visiblePoints = Math.floor(canvas.width / zoomLevel);
    const startIndex = Math.floor(scrollPosition * (dataLength - visiblePoints));
    const endIndex = Math.min(startIndex + visiblePoints, dataLength);

    // Find the maximum value in the visible range for normalization
    let maxValue = 0;
    Object.values(traces).forEach(trace => {
      for (let i = startIndex; i < endIndex && i < trace.length; i++) {
        maxValue = Math.max(maxValue, trace[i]);
      }
    });

    // Prevent division by zero
    if (maxValue === 0) maxValue = 1;

    // Draw chromatogram traces with normalization
    const colors = {
      A: '#00AA00', // Green
      T: '#FF0000', // Red  
      G: '#000000', // Black
      C: '#0000FF'  // Blue
    };

    const traceHeight = 120; // Available height for traces
    const baselineY = 170;

    Object.entries(traces).forEach(([base, data]) => {
      if (!showChannels[base] || data.length === 0) return;

      ctx.strokeStyle = colors[base];
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      let pathStarted = false;

      for (let i = startIndex; i < endIndex && i < data.length; i++) {
        const x = ((i - startIndex) / (endIndex - startIndex)) * canvas.width;
        // Normalize the y value to fit in available height
        const normalizedValue = (data[i] / maxValue) * traceHeight;
        const y = baselineY - normalizedValue;

        if (!pathStarted) {
          ctx.moveTo(x, y);
          pathStarted = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    });


    // Draw base calls and quality (SINGLE LOOP ONLY)
    ctx.font = 'bold 16px monospace';

    const { peakLocations } = parsedData;

    for (let i = 0; i < baseCalls.length; i++) {
      // Use actual peak location or fallback to estimated position
      const peakPosition = peakLocations && peakLocations[i]
        ? peakLocations[i]
        : (i * maxTraceLength / baseCalls.length);

      // Check if this peak is in the visible range
      if (peakPosition < startIndex || peakPosition > endIndex) continue;

      const x = ((peakPosition - startIndex) / (endIndex - startIndex)) * canvas.width;
      const base = baseCalls[i];
      const qual = quality[i] || 0;

      // Only draw if position is visible
      if (x >= -20 && x <= canvas.width + 20) {
        // Highlight selected position
        if (selectedPosition === i) {
          ctx.fillStyle = '#FFD700';
          ctx.fillRect(x - 12, 10, 24, 25);
          ctx.strokeStyle = '#FF6600';
          ctx.lineWidth = 2;
          ctx.strokeRect(x - 12, 10, 24, 25);
        }

        // Highlight N bases with transparent red background
        if (base === 'N') {
          ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; // Transparent red
          ctx.fillRect(x - 12, 10, 24, 25);
          ctx.strokeStyle = '#FF0000'; // Red border
          ctx.lineWidth = 1;
          ctx.strokeRect(x - 12, 10, 24, 25);
        }

        // Highlight edited positions with a different color
        if (editedPositions.has(i)) {
          ctx.fillStyle = 'rgba(128, 0, 255, 0.3)'; // Purple tint for edited bases
          ctx.fillRect(x - 12, 10, 24, 25);
          ctx.strokeStyle = '#8000FF';
          ctx.lineWidth = 1;
          ctx.strokeRect(x - 12, 10, 24, 25);
        }

        // Always color base calls by their nucleotide type
        ctx.fillStyle = colors[base] || '#666666';

        // Draw base letter
        ctx.fillText(base, x - 6, 25);

        // Draw quality bar
        ctx.fillStyle = qual >= qualityThreshold ? colors[base] || '#666666' : '#CCCCCC';
        const barHeight = (qual / 60) * 12;
        ctx.fillRect(x - 2, baselineY + 5, 4, barHeight);  // Changed +20 to +5
      }
    }


    // Draw position markers at the bottom
    ctx.fillStyle = '#666666';
    ctx.font = '24px monospace';

    const positionInterval = zoomLevel > 10 ? 10 : zoomLevel > 5 ? 25 : 50;

    for (let pos = 0; pos < baseCalls.length; pos += positionInterval) {
      const peakPosition = peakLocations && peakLocations[pos]
        ? peakLocations[pos]
        : (pos * maxTraceLength / baseCalls.length);

      if (peakPosition < startIndex || peakPosition > endIndex) continue;

      const x = ((peakPosition - startIndex) / (endIndex - startIndex)) * canvas.width;

      if (x >= 0 && x <= canvas.width) {
        // Draw position number
        ctx.fillStyle = '#666666';
        ctx.fillText((pos + 1).toString(), x - 10, canvas.height - 5);  // Now shows 1-based positions

        // Draw tick mark
        ctx.strokeStyle = '#CCCCCC';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, baselineY + 20);  // Start just below quality bars
        ctx.lineTo(x, canvas.height - 15);  // End just above position numbers
        ctx.stroke();
      }
    }


    // Draw selected position highlight line
    if (selectedPosition !== null) {
      const { peakLocations } = parsedData;
      const peakPosition = peakLocations && peakLocations[selectedPosition]
        ? peakLocations[selectedPosition]
        : (selectedPosition * maxTraceLength / baseCalls.length);

      const selectedX = ((peakPosition - startIndex) / (endIndex - startIndex)) * canvas.width;
      if (selectedX >= 0 && selectedX <= canvas.width) {
        ctx.strokeStyle = '#FF6600';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(selectedX, 30);  // Start higher
        ctx.lineTo(selectedX, baselineY + 25);  // End closer to new layout
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw hover highlight
    if (hoveredPosition !== null && hoveredPosition !== selectedPosition) {
      const { peakLocations } = parsedData;
      const peakPosition = peakLocations && peakLocations[hoveredPosition]
        ? peakLocations[hoveredPosition]
        : (hoveredPosition * maxTraceLength / baseCalls.length);

      const hoverX = ((peakPosition - startIndex) / (endIndex - startIndex)) * canvas.width;
      if (hoverX >= 0 && hoverX <= canvas.width) {
        ctx.fillStyle = 'rgba(173, 216, 230, 0.4)';
        ctx.fillRect(hoverX - 12, 10, 24, baselineY + 35);
      }
    }

    // Draw quality threshold line
    ctx.strokeStyle = '#FF6B6B';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    const thresholdY = baselineY + 20 + (qualityThreshold / 60) * 12;
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(canvas.width, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw scale info
    ctx.fillStyle = '#666666';
    ctx.font = '10px sans-serif';

    // Draw sequence highlight
    if (showHighlight && highlightStart && highlightEnd && parsedData) {
      const startPos = parseInt(highlightStart) - 1;
      const endPos = parseInt(highlightEnd) - 1;

      if (!isNaN(startPos) && !isNaN(endPos) && startPos >= 0 && endPos < baseCalls.length && startPos <= endPos) {
        const { peakLocations } = parsedData;

        // Get start and end positions
        const startPeakPosition = peakLocations && peakLocations[startPos]
          ? peakLocations[startPos]
          : (startPos * maxTraceLength / baseCalls.length);
        const endPeakPosition = peakLocations && peakLocations[endPos]
          ? peakLocations[endPos]
          : (endPos * maxTraceLength / baseCalls.length);

        // Check if highlight is in visible range
        if (endPeakPosition >= startIndex && startPeakPosition <= endIndex) {
          const startX = Math.max(0, ((startPeakPosition - startIndex) / (endIndex - startIndex)) * canvas.width);
          const endX = Math.min(canvas.width, ((endPeakPosition - startIndex) / (endIndex - startIndex)) * canvas.width);

          // Draw highlight background
          ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'; // Yellow with transparency
          ctx.fillRect(startX - 12, 10, endX - startX + 24, baselineY + 35);

          // Draw highlight borders
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(startX, 10);
          ctx.lineTo(startX, baselineY + 45);
          ctx.moveTo(endX, 10);
          ctx.lineTo(endX, baselineY + 45);
          ctx.stroke();
        }
      }
    }
  };

  const handleZoom = (delta) => {
    setZoomLevel(prev => Math.max(0.5, Math.min(20, prev + delta)));
  };

  // Handle navigation (moved to double-click)
  const handleNavigation = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scrollRatio = x / rect.width;
    setScrollPosition(Math.max(0, Math.min(1, scrollRatio)));
  };

  // FIX: Improved canvas click handling
  // Updated handleCanvasClick
  const handleCanvasClick = (e) => {
    if (!parsedData) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    console.log('Click at canvas X:', canvasX, 'Y:', canvasY);

    // Calculate visible range
    const traceLengths = Object.values(parsedData.traces).map(trace => trace.length);
    const maxTraceLength = Math.max(...traceLengths);
    const dataLength = maxTraceLength;
    const visiblePoints = Math.floor(canvas.width / zoomLevel);
    const startIndex = Math.floor(scrollPosition * (dataLength - visiblePoints));
    const endIndex = Math.min(startIndex + visiblePoints, dataLength);

    console.log('Visible range:', startIndex, 'to', endIndex);

    // Calculate the actual ratio for real data
    const dataPointsPerBase = maxTraceLength / parsedData.baseCalls.length;

    // Find the closest base call position
    let closestPosition = null;
    let closestDistance = Infinity;

    for (let i = 0; i < parsedData.baseCalls.length; i++) {
      const peakPosition = parsedData.peakLocations && parsedData.peakLocations[i]
        ? parsedData.peakLocations[i]
        : (i * maxTraceLength / parsedData.baseCalls.length);

      if (peakPosition < startIndex || peakPosition > endIndex) continue;

      const baseX = ((peakPosition - startIndex) / (endIndex - startIndex)) * canvas.width;
      const distance = Math.abs(canvasX - baseX);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPosition = i;
      }
    }

    console.log('Closest position:', closestPosition, 'Distance:', closestDistance);

    if (closestPosition !== null && closestDistance < 50 && closestPosition >= 0) {
      const nucleotide = parsedData.baseCalls[closestPosition];
      setSelectedPosition(closestPosition);
      setSelectedNucleotide(nucleotide);
      console.log(`Selected: ${nucleotide}${closestPosition + 1}`);
    } else {
      console.log('Click too far from any base position or invalid position');
      setSelectedPosition(null);
      setSelectedNucleotide(null);
    }
  };

  // Updated handleCanvasMouseMove
  const handleCanvasMouseMove = (e) => {
    if (!parsedData) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const canvasX = (e.clientX - rect.left) * scaleX;

    // Calculate visible range
    const traceLengths = Object.values(parsedData.traces).map(trace => trace.length);
    const maxTraceLength = Math.max(...traceLengths);
    const dataLength = maxTraceLength;
    const visiblePoints = Math.floor(canvas.width / zoomLevel);
    const startIndex = Math.floor(scrollPosition * (dataLength - visiblePoints));
    const endIndex = Math.min(startIndex + visiblePoints, dataLength);

    // Calculate the actual ratio for real data
    const dataPointsPerBase = maxTraceLength / parsedData.baseCalls.length;

    // Find closest position
    let closestPosition = null;
    let closestDistance = Infinity;

    for (let i = 0; i < parsedData.baseCalls.length; i++) {
      const peakPosition = parsedData.peakLocations && parsedData.peakLocations[i]
        ? parsedData.peakLocations[i]
        : (i * maxTraceLength / parsedData.baseCalls.length);

      if (peakPosition < startIndex || peakPosition > endIndex) continue;

      const baseX = ((peakPosition - startIndex) / (endIndex - startIndex)) * canvas.width;
      const distance = Math.abs(canvasX - baseX);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPosition = i;
      }
    }

    if (closestPosition !== null && closestDistance < 50 && closestPosition >= 0) {
      setHoveredPosition(closestPosition);
    } else {
      setHoveredPosition(null);
    }
  };

  // Add mouse leave handler
  const handleCanvasMouseLeave = () => {
    setHoveredPosition(null);
  };

  // Handle Scrolling
  const handleCanvasWheel = (e) => {
    // Stop all default behavior
    e.preventDefault();
    e.stopPropagation();

    // Determine scroll direction and amount
    const scrollDelta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
    const scrollAmount = scrollDelta > 0 ? 0.05 : -0.05;

    // Update scroll position
    const newPosition = Math.max(0, Math.min(1, scrollPosition + scrollAmount));
    setScrollPosition(newPosition);

    return false; // Additional prevention
  };

  const handleScrollbarChange = (e) => {
    const newPosition = parseFloat(e.target.value) / 100;
    setScrollPosition(newPosition);
  };

  const resetView = () => {
    setZoomLevel(2.5);
    setScrollPosition(0);
    // Clear selection when resetting view
    setSelectedPosition(null);
    setSelectedNucleotide(null);
  };

  const toggleChannel = (channel) => {
    setShowChannels(prev => ({
      ...prev,
      [channel]: !prev[channel]
    }));
  };

  const exportSequence = () => {
    if (!parsedData) return;

    const fasta = `>${fileName}\n${parsedData.sequence}`;
    const blob = new Blob([fasta], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace('.ab1', '')}.fasta`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Parsing chromatogram data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading chromatogram:</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      {/* Controls */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-semibold text-gray-900">Chromatogram Viewer</h4>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportSequence}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center space-x-1"
            >
              <Download className="w-4 h-4" />
              <span>Export FASTA</span>
            </button>
            <button
              onClick={resetView}
              className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 flex items-center space-x-1"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset View</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 flex items-center space-x-1"
                title="Close chromatogram viewer"
              >
                <span>×</span>
                <span>Close</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Zoom Controls */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Zoom:</span>
            <button
              onClick={() => handleZoom(-0.5)}
              className="p-1 border border-gray-300 rounded hover:bg-gray-50"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600 min-w-[3rem] text-center">
              {zoomLevel.toFixed(1)}x
            </span>
            <button
              onClick={() => handleZoom(0.5)}
              className="p-1 border border-gray-300 rounded hover:bg-gray-50"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Channel Toggles */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Channels:</span>
            {Object.entries(showChannels).map(([channel, visible]) => (
              <button
                key={channel}
                onClick={() => toggleChannel(channel)}
                className={`px-2 py-1 text-xs rounded font-mono ${visible
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                  : 'bg-gray-100 text-gray-500 border border-gray-300'
                  }`}
              >
                {channel}
              </button>
            ))}
          </div>

          {/* FIX: Add Quality Threshold Control */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Quality:</span>
            <input
              type="range"
              min="0"
              max="60"
              value={qualityThreshold}
              onChange={(e) => setQualityThreshold(parseInt(e.target.value))}
              className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-600 min-w-[2rem]">{qualityThreshold}</span>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center space-x-1">
            <span className="text-sm font-medium text-gray-700">Navigate:</span>
            <div className="flex space-x-1">
              <button
                onClick={() => setScrollPosition(Math.max(0, scrollPosition - 0.1))}
                className="px-1.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                disabled={scrollPosition === 0}
                title="Move backward"
              >
                ←
              </button>
              <button
                onClick={() => setScrollPosition(Math.min(1, scrollPosition + 0.1))}
                className="px-1.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                disabled={scrollPosition === 1}
                title="Move forward"
              >
                →
              </button>
              <button
                onClick={() => setScrollPosition(0)}
                className="px-1.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                title="Go to start"
              >
                Start
              </button>
              <button
                onClick={() => setScrollPosition(1)}
                className="px-1.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                title="Go to end"
              >
                End
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chromatogram Canvas */}
      <div className="p-4">
        {/* Selected position display */}
        {selectedPosition !== null && selectedNucleotide && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
                {selectedNucleotide}
              </div>
              <div className="flex-1">
                <p className="text-orange-900 font-medium text-lg">
                  {selectedNucleotide}{selectedPosition + 1}
                </p>
                {isEditing ? (
                  <div className="flex items-center space-x-2 mt-2">
                    <label className="text-orange-700 text-sm">Change to:</label>
                    <select
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="px-2 py-1 border border-orange-300 rounded text-sm"
                    >
                      <option value="">Select</option>
                      <option value="A">A (Adenine)</option>
                      <option value="T">T (Thymine)</option>
                      <option value="G">G (Guanine)</option>
                      <option value="C">C (Cytosine)</option>
                      <option value="N">N (Unknown)</option>
                    </select>
                    <button
                      onClick={handleSaveEdit}
                      disabled={!editValue}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <p className="text-orange-700 text-sm">
                    Position {selectedPosition + 1} • Click Edit to modify
                  </p>
                )}
              </div>
              <div className="flex space-x-2">
                {!isEditing && (
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setEditValue(selectedNucleotide);
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedPosition(null);
                    setSelectedNucleotide(null);
                    setIsEditing(false);
                    setEditValue('');
                  }}
                  className="text-orange-600 hover:text-orange-800"
                  title="Clear selection"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sequence Highlight Controls */}
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h5 className="text-sm font-medium text-yellow-900 mb-3">Sequence Highlight & Copy</h5>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-yellow-800 mb-1">Start Position</label>
              <input
                type="number"
                value={highlightStart}
                onChange={(e) => setHighlightStart(e.target.value)}
                placeholder="1"
                min="1"
                max={parsedData?.sequenceLength - 1 || 0}
                className="w-full px-2 py-1 text-sm border border-yellow-300 rounded focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-yellow-800 mb-1">End Position</label>
              <input
                type="number"
                value={highlightEnd}
                onChange={(e) => setHighlightEnd(e.target.value)}
                placeholder={parsedData?.sequenceLength || 1}
                min="0"
                max={parsedData?.sequenceLength || 1}
                className="w-full px-2 py-1 text-sm border border-yellow-300 rounded focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowHighlight(!showHighlight)}
                disabled={!highlightStart || !highlightEnd}
                className={`px-3 py-1 text-sm rounded transition duration-200 ${showHighlight
                  ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                  : 'bg-white text-yellow-700 border border-yellow-300 hover:bg-yellow-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {showHighlight ? 'Hide' : 'Show'} Highlight
              </button>
            </div>
            <div>
              <button
                onClick={() => {
                  if (highlightStart && highlightEnd && parsedData) {
                    const startPos = parseInt(highlightStart) - 1;
                    const endPos = parseInt(highlightEnd) - 1;
                    if (!isNaN(startPos) && !isNaN(endPos) && startPos >= 0 && endPos < parsedData.baseCalls.length && startPos <= endPos) {
                      const sequence = parsedData.baseCalls.slice(startPos, endPos + 1).join('');
                      navigator.clipboard.writeText(sequence).then(() => {
                        console.log('Sequence copied to clipboard:', sequence);
                      }).catch(err => {
                        console.error('Failed to copy to clipboard:', err);
                        // Fallback method for older browsers
                        const textArea = document.createElement('textarea');
                        textArea.value = sequence;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                      });
                    }
                  }
                }}
                disabled={!highlightStart || !highlightEnd}
                className="w-full px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Copy Sequence
              </button>
            </div>
          </div>
          {highlightStart && highlightEnd && parsedData && (
            <div className="mt-2 p-2 bg-white rounded border">
              <p className="text-xs text-gray-600 mb-1">
                Selected sequence ({highlightEnd - highlightStart + 1} bases):
              </p>
              <p className="text-xs font-mono text-gray-800 break-all">
                {(() => {
                  const startPos = parseInt(highlightStart) - 1;  // Convert to 0-based
                  const endPos = parseInt(highlightEnd) - 1;      // Convert to 0-based  
                  if (!isNaN(startPos) && !isNaN(endPos) && startPos >= 0 && endPos < parsedData.baseCalls.length && startPos <= endPos) {
                    return parsedData.baseCalls.slice(startPos, endPos + 1).join('');
                  }
                  return 'Invalid range';
                })()}
              </p>
            </div>
          )}
        </div>


        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onDoubleClick={handleNavigation}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          className="w-full border border-gray-200 rounded cursor-pointer"
          style={{ maxHeight: '500px' }}
        />

        {/* Click instruction */}
        <div className="mt-2 text-center">
          <p className="text-xs text-gray-500">
            Single-click to select a position • Double-click to navigate to that region
          </p>
        </div>

        {/* Horizontal Scroll Bar */}
        <div className="mt-2 px-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500 min-w-[3rem]">Start</span>
            <input
              type="range"
              min="0"
              max="100"
              value={scrollPosition * 100}
              onChange={handleScrollbarChange}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #4F46E5 0%, #4F46E5 ${scrollPosition * 100}%, #E5E7EB ${scrollPosition * 100}%, #E5E7EB 100%)`
              }}
            />
            <span className="text-xs text-gray-500 min-w-[3rem]">End</span>
          </div>

          <div className="mt-1 text-center">
            <span className="text-xs text-gray-600">
              Showing positions {(() => {
                if (!canvasRef.current || !parsedData || !parsedData.traces) return '0 - 0';

                try {
                  // Calculate the actual base positions being displayed
                  const traceLengths = Object.values(parsedData.traces).map(trace => trace.length);
                  const maxTraceLength = Math.max(...traceLengths);
                  if (maxTraceLength === 0) return '0 - 0';

                  const dataLength = maxTraceLength;
                  const canvasWidth = canvasRef.current.width || 1200; // fallback to default width
                  const visiblePoints = Math.floor(canvasWidth / zoomLevel);
                  const startIndex = Math.floor(scrollPosition * (dataLength - visiblePoints));
                  const endIndex = Math.min(startIndex + visiblePoints, dataLength);

                  // Convert trace indices to base positions
                  const startBasePos = Math.floor(startIndex * parsedData.baseCalls.length / maxTraceLength);
                  const endBasePos = Math.floor(endIndex * parsedData.baseCalls.length / maxTraceLength);

                  return `${startBasePos + 1} - ${Math.min(endBasePos, parsedData.baseCalls.length)}`;
                } catch (error) {
                  return '0 - 0';
                }
              })()}
            </span>
          </div>
        </div>

        {/* Sequence Info */}
        <div className="mt-4 p-3 bg-gray-50 rounded">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">File:</span>
              <p className="text-gray-900 font-mono">{fileName}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Format:</span>
              <p className="text-gray-900">
                <span className={`px-2 py-1 text-xs rounded font-mono ${parsedData?.fileFormat === 'AB1' ? 'bg-blue-100 text-blue-800' :
                  parsedData?.fileFormat === 'SCF' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                  {parsedData?.fileFormat || 'Unknown'}
                </span>
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Length:</span>
              <p className="text-gray-900">{parsedData?.sequenceLength} bp</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Avg Quality:</span>
              <p className="text-gray-900">
                {parsedData?.quality ?
                  (parsedData.quality.reduce((a, b) => a + b, 0) / parsedData.quality.length).toFixed(1)
                  : 'N/A'}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">
                {selectedPosition !== null ? 'Selected:' : 'High Quality:'}
              </span>
              <p className="text-gray-900">
                {selectedPosition !== null ?
                  `${selectedNucleotide}${selectedPosition + 1}` :
                  parsedData?.quality ?
                    `${parsedData.quality.filter(q => q >= qualityThreshold).length}/${parsedData.quality.length}`
                    : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 p-3 bg-blue-50 rounded">
          <h5 className="text-sm font-medium text-blue-900 mb-2">Legend:</h5>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Adenine (A)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>Thymine (T)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-black rounded"></div>
              <span>Guanine (G)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>Cytosine (C)</span>
            </div>
          </div>
          <p className="text-xs text-blue-700 mt-2">
            Use the scroll bar below the chromatogram to navigate through the sequence.
            Click anywhere on the chromatogram to select and highlight specific nucleotide positions.
            Position markers are shown at the bottom for reference. Use the quality slider to filter low-quality bases.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChromatogramViewer;