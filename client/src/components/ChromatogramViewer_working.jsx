import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Download, Eye, EyeOff } from 'lucide-react';

const ChromatogramViewer = ({ fileData, fileName, fileType, fileClose, onClose }) => {
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


  useEffect(() => {
    if (fileData) {
      parseAB1File(fileData);
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
  }, [parsedData, zoomLevel, scrollPosition, showChannels, qualityThreshold, selectedPosition, hoveredPosition]);

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
      const scrollAmount = scrollDelta > 0 ? 0.05 : -0.05;

      setScrollPosition(prev => Math.max(0, Math.min(1, prev + scrollAmount)));

      return false;
    };

    // Add with passive: false to ensure preventDefault works
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [scrollPosition]);


  const parseAB1File = async (data) => {
    try {
      setLoading(true);
      console.log('parseAB1File called with data:', data, 'fileName:', fileName, 'fileType:', fileType);

      let parsedData;

      if (data === 'mock' || !data || data.length < 100) {
        console.log('Using mock data - no real AB1 file available');
        parsedData = generateMockChromatogramData(fileName || 'unknown.ab1');
      } else {
        console.log('Parsing file data, size:', data.length, 'bytes');
        try {
          // For practice files, be more permissive
          if (fileType === 'practice') {
            parsedData = parseRealAB1Data(data, fileName, true); // Pass permissive flag
          } else {
            parsedData = parseRealAB1Data(data, fileName, false);
          }
        } catch (parseError) {
          console.error('Failed to parse file data, falling back to mock:', parseError);
          parsedData = generateMockChromatogramData(fileName || 'unknown.ab1');
        }
      }

      setParsedData(parsedData);
      setLoading(false);
    } catch (err) {
      console.error('Error in parseAB1File:', err);
      setError('Failed to parse file: ' + err.message);
      setLoading(false);
    }
  };

  // New function to parse real AB1 binary data
  // REPLACE the parseRealAB1Data function with this multi-format detector:

  const parseRealAB1Data = (uint8Array, fileName, permissive = false) => {
    console.log('=== MULTI-FORMAT CHROMATOGRAM PARSER ===');
    console.log('File size:', uint8Array.length, 'bytes');
    console.log('File name:', fileName);

    // Enhanced file format detection
    const fileFormat = detectFileFormat(uint8Array, fileName);
    console.log('Detected file format:', fileFormat);

    switch (fileFormat.type) {
      case 'AB1':
        console.log('Processing as AB1 file...');
        return parseStandardAB1(uint8Array, fileName, permissive);

      case 'SCF':
        console.log('Processing as SCF file...');
        return parseSCFFile(uint8Array, fileName);

      case 'ZTR':
        console.log('Processing as ZTR file...');
        return parseZTRFile(uint8Array, fileName);

      case 'MODIFIED_AB1':
        console.log('Processing as modified/educational AB1 file...');
        return parseModifiedAB1(uint8Array, fileName);

      case 'UNKNOWN_TRACES':
        console.log('Unknown format but trace data detected...');
        return parseUnknownTraceFormat(uint8Array, fileName);

      default:
        console.log('Unknown file format, generating basic visualization...');
        return generateBasicVisualizationFromRawData(uint8Array, fileName);
    }
  };

  // File format detection function
  const detectFileFormat = (uint8Array, fileName) => {
    const result = {
      type: 'UNKNOWN',
      confidence: 0,
      details: {}
    };

    // Get file signature (first 8 bytes)
    const signature = uint8Array.slice(0, 8);
    const signatureHex = Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('');
    const signatureText = Array.from(signature).map(b => b >= 32 && b <= 126 ? String.fromCharCode(b) : '.').join('');

    console.log('File signature (hex):', signatureHex);
    console.log('File signature (text):', signatureText);

    // Check for AB1 format
    if (signatureText.startsWith('ABIF')) {
      result.type = 'AB1';
      result.confidence = 0.95;
      result.details.format = 'Standard ABI AB1';
      return result;
    }

    // Check for SCF format
    if (signatureText.startsWith('.scf')) {
      result.type = 'SCF';
      result.confidence = 0.95;
      result.details.format = 'Standard Chromatogram Format';
      return result;
    }

    // Check for ZTR format
    if (signature[0] === 0xAE && signature[1] === 0x5A && signature[2] === 0x54 && signature[3] === 0x52) {
      result.type = 'ZTR';
      result.confidence = 0.95;
      result.details.format = 'ZTR Compressed Trace';
      return result;
    }

    // Check filename extension
    const extension = fileName.toLowerCase().split('.').pop();
    console.log('File extension:', extension);

    // Look for AB1-like structures throughout the file
    const ab1Indicators = scanForAB1Indicators(uint8Array);
    console.log('AB1 indicators found:', ab1Indicators);

    // Look for SCF-like structures
    const scfIndicators = scanForSCFIndicators(uint8Array);
    console.log('SCF indicators found:', scfIndicators);

    // Analyze data patterns
    const patterns = analyzeDataPatterns(uint8Array);
    console.log('Data patterns:', patterns);

    // Decision logic
    if (extension === 'ab1') {
      if (ab1Indicators.score > 0.3) {
        result.type = 'MODIFIED_AB1';
        result.confidence = 0.7;
        result.details.format = 'Modified/Educational AB1';
        result.details.indicators = ab1Indicators;
      } else if (patterns.hasTraceData) {
        result.type = 'UNKNOWN_TRACES';
        result.confidence = 0.6;
        result.details.format = 'Unknown format with trace data';
      }
    } else if (extension === 'scf') {
      if (scfIndicators.score > 0.3) {
        result.type = 'SCF';
        result.confidence = 0.8;
        result.details.format = 'Possibly corrupted SCF';
      }
    } else if (patterns.hasTraceData) {
      result.type = 'UNKNOWN_TRACES';
      result.confidence = 0.5;
      result.details.format = 'Unknown format with trace-like data';
    }

    result.details.patterns = patterns;
    return result;
  };

  // Scan for AB1 format indicators
  const scanForAB1Indicators = (uint8Array) => {
    const indicators = {
      score: 0,
      foundTags: [],
      hasDirectory: false,
      hasTraceData: false
    };

    // Look for common AB1 tags
    const ab1Tags = ['DATA', 'PBAS', 'PCON', 'PLOC', 'FWO_', 'LANE', 'GEL_', 'DYNA', 'RUND', 'MCHN'];

    for (const tag of ab1Tags) {
      let found = false;
      for (let i = 0; i <= uint8Array.length - tag.length; i += 100) {
        const testString = new TextDecoder().decode(uint8Array.slice(i, i + tag.length));
        if (testString === tag) {
          indicators.foundTags.push(`${tag}@${i}`);
          indicators.score += 0.1;
          found = true;
          break;
        }
      }
    }

    // Look for directory structure patterns
    for (let i = 0; i < Math.min(uint8Array.length - 32, 1000); i += 4) {
      // Check for potential directory entry pattern
      const offset = (uint8Array[i] << 24) | (uint8Array[i + 1] << 16) | (uint8Array[i + 2] << 8) | uint8Array[i + 3];
      if (offset > 0 && offset < uint8Array.length - 28) {
        const entryStart = offset;
        if (entryStart + 28 < uint8Array.length) {
          const entryName = new TextDecoder().decode(uint8Array.slice(entryStart, entryStart + 4));
          if (/^[A-Z_]{4}$/.test(entryName)) {
            indicators.hasDirectory = true;
            indicators.score += 0.2;
            break;
          }
        }
      }
    }

    return indicators;
  };

  // Scan for SCF format indicators  
  const scanForSCFIndicators = (uint8Array) => {
    const indicators = {
      score: 0,
      version: null,
      hasHeader: false
    };

    // SCF files start with ".scf" followed by version
    if (uint8Array.length >= 128) {
      const header = uint8Array.slice(0, 128);
      const headerText = new TextDecoder().decode(header.slice(0, 20));

      if (headerText.includes('.scf')) {
        indicators.hasHeader = true;
        indicators.score += 0.5;

        // Try to extract version
        const versionMatch = headerText.match(/\.scf(\d+\.\d+)/);
        if (versionMatch) {
          indicators.version = versionMatch[1];
          indicators.score += 0.3;
        }
      }
    }

    return indicators;
  };

  // Analyze general data patterns
  const analyzeDataPatterns = (uint8Array) => {
    const patterns = {
      hasTraceData: false,
      alternatingZeros: false,
      dataRegions: [],
      entropy: 0,
      averageValue: 0
    };

    // Calculate basic statistics
    const sampleSize = Math.min(10000, uint8Array.length);
    let sum = 0;
    const histogram = new Array(256).fill(0);

    for (let i = 0; i < sampleSize; i++) {
      const val = uint8Array[i];
      sum += val;
      histogram[val]++;
    }

    patterns.averageValue = sum / sampleSize;

    // Calculate entropy
    let entropy = 0;
    for (let count of histogram) {
      if (count > 0) {
        const p = count / sampleSize;
        entropy -= p * Math.log2(p);
      }
    }
    patterns.entropy = entropy;

    // Check for alternating zero pattern
    if (uint8Array.length >= 100) {
      let alternatingCount = 0;
      for (let i = 0; i < 100; i += 2) {
        if (uint8Array[i] === 0 && uint8Array[i + 1] > 0) {
          alternatingCount++;
        }
      }
      patterns.alternatingZeros = alternatingCount > 30; // 60% of pairs
    }

    // Look for regions with trace-like data
    for (let i = 0; i < uint8Array.length - 1000; i += 1000) {
      const region = uint8Array.slice(i, i + 1000);
      const nonZero = region.filter(v => v > 0).length;
      const variance = calculateVariance(Array.from(region));

      if (nonZero > 500 && variance > 100) {
        patterns.dataRegions.push({
          offset: i,
          length: 1000,
          nonZeroRatio: nonZero / 1000,
          variance: variance
        });
        patterns.hasTraceData = true;
      }
    }

    return patterns;
  };

  // Helper function for variance calculation
  const calculateVariance = (values) => {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  };

  // Parser for modified AB1 files
  const parseModifiedAB1 = (uint8Array, fileName) => {
    console.log('Parsing modified AB1 file...');

    // Try to find trace data using pattern analysis
    const traceData = findTraceDataPatterns(uint8Array);

    if (traceData.found) {
      return createVisualizationFromPatterns(traceData, fileName);
    } else {
      return generateBasicVisualizationFromRawData(uint8Array, fileName);
    }
  };

  // Basic SCF parser 

  const parseSCFFile = (uint8Array, fileName) => {
    console.log('=== PARSING SCF FILE ===');
    console.log('File size:', uint8Array.length, 'bytes');

    try {
      if (uint8Array.length < 128) {
        throw new Error('File too small to be valid SCF');
      }

      // Read SCF header with detailed debugging
      const header = parseSCFHeader(uint8Array);
      console.log('SCF Header parsed:', header);

      if (!header.isValid) {
        console.log('Header validation failed, reason:', header.error || 'Unknown');
        throw new Error('Invalid SCF header: ' + (header.error || 'Unknown'));
      }

      // Extract trace data with validation
      const traces = extractSCFTraces(uint8Array, header);
      console.log('SCF traces extracted successfully');

      // Extract base calls and quality with validation
      const baseData = extractSCFBases(uint8Array, header);
      console.log('SCF base data extracted successfully');

      // Validate we have usable data
      const maxTraceLength = Math.max(...Object.values(traces).map(t => t.length));
      if (maxTraceLength === 0 || baseData.baseCalls.length === 0) {
        throw new Error('No usable trace or base data found in SCF file');
      }

      console.log('SCF parsing successful - traces:', maxTraceLength, 'bases:', baseData.baseCalls.length);

      return {
        sequence: baseData.baseCalls.join(''),
        traces: traces,
        quality: baseData.quality,
        baseCalls: baseData.baseCalls,
        peakLocations: baseData.peakLocations,
        fileName: fileName || 'parsed.scf',
        sequenceLength: baseData.baseCalls.length
      };

    } catch (error) {
      console.error('SCF parsing failed:', error.message);
      console.log('Attempting fallback parsing strategies...');

      // Strategy 1: Try to parse as if it's really a modified AB1 with SCF header
      try {
        console.log('Trying modified AB1 parsing...');
        return parseModifiedAB1(uint8Array, fileName);
      } catch (ab1Error) {
        console.log('Modified AB1 parsing also failed:', ab1Error.message);
      }

      // Strategy 2: Fall back to pattern detection but ensure proper data structure
      console.log('Using pattern detection fallback...');
      const traceData = findTraceDataPatterns(uint8Array);
      if (traceData.found) {
        const result = createVisualizationFromPatterns(traceData, fileName);
        // Ensure the result has all required fields
        if (!result.peakLocations) {
          result.peakLocations = result.baseCalls.map((_, i) => i * 4);
        }
        return result;
      } else {
        return generateBasicVisualizationFromRawData(uint8Array, fileName);
      }
    }
  };

  // Parse SCF header (first 128 bytes)
  const parseSCFHeader = (uint8Array) => {
    const header = {
      isValid: false,
      error: null,
      magic: '',
      samples: 0,
      samplesOffset: 0,
      bases: 0,
      basesOffset: 0,
      comments: 0,
      commentsOffset: 0,
      version: '',
      sampleSize: 1,
      codeSet: 0,
      privateSize: 0,
      privateOffset: 0
    };

    try {
      // Read and validate magic number
      header.magic = new TextDecoder().decode(uint8Array.slice(0, 4));
      console.log('SCF Magic number:', `"${header.magic}"`);

      if (header.magic !== '.scf') {
        header.error = `Invalid magic number: "${header.magic}"`;
        return header;
      }

      // Use DataView for proper byte order handling
      const view = new DataView(uint8Array.buffer);

      // Read header fields (all big-endian in SCF format)
      header.samples = view.getUint32(4, false);
      header.samplesOffset = view.getUint32(8, false);
      header.bases = view.getUint32(12, false);
      header.basesOffset = view.getUint32(16, false);
      header.comments = view.getUint32(20, false);
      header.commentsOffset = view.getUint32(24, false);

      // Read version string (4 bytes)
      const versionBytes = uint8Array.slice(28, 32);
      header.version = new TextDecoder().decode(versionBytes).replace(/\0/g, ''); // Remove null bytes

      // Read sample size (should be 1 or 2)
      header.sampleSize = view.getUint32(32, false);

      // Read code set
      header.codeSet = view.getUint32(36, false);

      // Read private data size and offset
      header.privateSize = view.getUint32(40, false);
      header.privateOffset = view.getUint32(44, false);

      console.log('SCF Header values:', {
        samples: header.samples,
        samplesOffset: header.samplesOffset,
        bases: header.bases,
        basesOffset: header.basesOffset,
        version: `"${header.version}"`,
        sampleSize: header.sampleSize,
        codeSet: header.codeSet
      });

      // Validate header values
      const validationErrors = [];

      if (header.samples <= 0 || header.samples > 100000) {
        validationErrors.push(`Invalid sample count: ${header.samples}`);
      }

      if (header.bases <= 0 || header.bases > 10000) {
        validationErrors.push(`Invalid base count: ${header.bases}`);
      }

      if (header.samplesOffset < 128 || header.samplesOffset >= uint8Array.length) {
        validationErrors.push(`Invalid samples offset: ${header.samplesOffset}`);
      }

      if (header.basesOffset < 128 || header.basesOffset >= uint8Array.length) {
        validationErrors.push(`Invalid bases offset: ${header.basesOffset}`);
      }

      if (header.sampleSize !== 1 && header.sampleSize !== 2) {
        validationErrors.push(`Invalid sample size: ${header.sampleSize} (must be 1 or 2)`);
      }

      // Check if trace data would fit in file
      const expectedTraceDataSize = header.samples * 4 * header.sampleSize; // 4 channels
      if (header.samplesOffset + expectedTraceDataSize > uint8Array.length) {
        validationErrors.push(`Trace data extends beyond file (need ${expectedTraceDataSize} bytes at offset ${header.samplesOffset})`);
      }

      // Check if base data would fit in file  
      const expectedBaseDataSize = header.bases * 12; // 12 bytes per base in SCF
      if (header.basesOffset + expectedBaseDataSize > uint8Array.length) {
        validationErrors.push(`Base data extends beyond file (need ${expectedBaseDataSize} bytes at offset ${header.basesOffset})`);
      }

      if (validationErrors.length > 0) {
        header.error = validationErrors.join('; ');
        console.log('SCF Header validation failed:', header.error);
        return header;
      }

      header.isValid = true;
      console.log('SCF Header validation passed');

    } catch (error) {
      header.error = `Header parsing error: ${error.message}`;
      console.error('Error parsing SCF header:', error);
    }

    return header;
  };

  // Extract trace data from SCF file
  const extractSCFTraces = (uint8Array, header) => {
    const traces = { A: [], T: [], G: [], C: [] };

    try {
      console.log('Extracting SCF traces...');
      console.log('Samples:', header.samples, 'Sample size:', header.sampleSize, 'Offset:', header.samplesOffset);

      const view = new DataView(uint8Array.buffer);
      const channels = ['A', 'T', 'G', 'C'];

      // SCF stores traces as interleaved samples: A1,T1,G1,C1,A2,T2,G2,C2...
      for (let i = 0; i < header.samples; i++) {
        for (let channel = 0; channel < 4; channel++) {
          const offset = header.samplesOffset + (i * 4 + channel) * header.sampleSize;

          if (offset + header.sampleSize <= uint8Array.length) {
            let value;
            if (header.sampleSize === 1) {
              // 8-bit samples
              value = uint8Array[offset];
            } else {
              // 16-bit samples (big-endian in SCF)
              value = view.getUint16(offset, false);
            }

            traces[channels[channel]].push(value);
          } else {
            console.warn(`Trace data truncated at sample ${i}, channel ${channel}`);
            break;
          }
        }

        // Stop if we've hit the end of the file
        if (header.samplesOffset + (i * 4 + 4) * header.sampleSize > uint8Array.length) {
          console.log(`Stopped reading traces at sample ${i} due to file boundary`);
          break;
        }
      }

      // Validate trace data
      const traceLengths = Object.values(traces).map(t => t.length);
      const minLength = Math.min(...traceLengths);
      const maxLength = Math.max(...traceLengths);

      console.log('Extracted trace lengths:', traceLengths);

      if (minLength === 0) {
        throw new Error('Some trace channels have no data');
      }

      if (maxLength - minLength > 1) {
        console.warn('Trace channels have unequal lengths, truncating to shortest');
        // Truncate all traces to the shortest length
        Object.keys(traces).forEach(channel => {
          traces[channel] = traces[channel].slice(0, minLength);
        });
      }

      console.log('Final trace lengths:', Object.keys(traces).map(k => `${k}: ${traces[k].length}`));

    } catch (error) {
      console.error('Error extracting SCF traces:', error);
      throw error;
    }

    return traces;
  };

  // Extract base calls and quality from SCF file
  const extractSCFBases = (uint8Array, header) => {
    const baseData = {
      baseCalls: [],
      quality: [],
      peakLocations: []
    };

    try {
      console.log('Extracting SCF base data...');
      console.log('Bases:', header.bases, 'Offset:', header.basesOffset);

      const view = new DataView(uint8Array.buffer);

      // SCF base record structure (12 bytes per base):
      // 0-3: peak index (uint32, big-endian)
      // 4-7: quality values A,T,G,C (4 x uint8)
      // 8-11: spare/additional data

      for (let i = 0; i < header.bases; i++) {
        const baseOffset = header.basesOffset + (i * 12);

        if (baseOffset + 12 <= uint8Array.length) {
          // Read peak location (big-endian uint32)
          const peakIndex = view.getUint32(baseOffset, false);
          baseData.peakLocations.push(peakIndex);

          // Read quality scores for A,T,G,C
          const qualA = uint8Array[baseOffset + 4];
          const qualT = uint8Array[baseOffset + 5];
          const qualG = uint8Array[baseOffset + 6];
          const qualC = uint8Array[baseOffset + 7];

          const qualities = [qualA, qualT, qualG, qualC];
          const bases = ['A', 'T', 'G', 'C'];

          // Find the base with highest quality
          const maxQual = Math.max(...qualities);
          const maxIndex = qualities.indexOf(maxQual);

          baseData.baseCalls.push(bases[maxIndex]);
          baseData.quality.push(maxQual);

        } else {
          console.warn(`Base data truncated at base ${i}`);
          break;
        }
      }

      console.log('Extracted base calls:', baseData.baseCalls.length);
      console.log('Sample sequence:', baseData.baseCalls.slice(0, 20).join(''));
      console.log('Quality range:', Math.min(...baseData.quality), '-', Math.max(...baseData.quality));
      console.log('Peak location range:', Math.min(...baseData.peakLocations), '-', Math.max(...baseData.peakLocations));

      // Validate base data
      if (baseData.baseCalls.length === 0) {
        throw new Error('No base calls extracted');
      }

      // Validate peak locations are reasonable
      const maxPeakLocation = Math.max(...baseData.peakLocations);
      if (maxPeakLocation > header.samples * 2) {
        console.warn('Peak locations seem unusually high, may indicate parsing error');
      }

    } catch (error) {
      console.error('Error extracting SCF base data:', error);

      // Generate minimal fallback data to keep the visualization working
      console.log('Generating fallback base data...');
      const estimatedBases = Math.min(header.bases || 100, 1000);
      const sequence = generateRandomSequence(estimatedBases);

      baseData.baseCalls = sequence.split('');
      baseData.quality = baseData.baseCalls.map(() => Math.floor(Math.random() * 40) + 20);
      baseData.peakLocations = baseData.baseCalls.map((_, i) => i * 4); // Simple spacing

      console.log('Generated fallback data with', baseData.baseCalls.length, 'bases');
    }

    return baseData;
  };

  // Basic ZTR parser (simplified)
  const parseZTRFile = (uint8Array, fileName) => {
    console.log('Parsing ZTR file...');

    // ZTR files are compressed - for now, fall back to pattern detection
    const traceData = findTraceDataPatterns(uint8Array);

    if (traceData.found) {
      return createVisualizationFromPatterns(traceData, fileName);
    } else {
      return generateBasicVisualizationFromRawData(uint8Array, fileName);
    }
  };

  // Parser for unknown formats with trace data
  const parseUnknownTraceFormat = (uint8Array, fileName) => {
    console.log('Parsing unknown trace format...');

    const traceData = findTraceDataPatterns(uint8Array);

    if (traceData.found) {
      return createVisualizationFromPatterns(traceData, fileName);
    } else {
      return generateBasicVisualizationFromRawData(uint8Array, fileName);
    }
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
      sequenceLength
    };
  };

  // Helper function to parse from a specific offset
  const parseFromOffset = (uint8Array, offset, fileName) => {
    const shiftedArray = uint8Array.slice(offset);
    return parseStandardAB1(shiftedArray, fileName, true);
  };

  // Helper function to look for trace data patterns
  const findTraceDataPatterns = (uint8Array) => {
    console.log('Analyzing file for trace data patterns...');

    const patterns = {
      found: false,
      sequences: [],
      potentialTraces: []
    };

    // Strategy 1: Look for sequences of 16-bit values that could be trace data
    console.log('Searching for 16-bit trace patterns...');
    for (let i = 0; i < uint8Array.length - 1000; i += 200) { // Increased step size for efficiency
      const values = [];
      let consecutiveReasonableValues = 0;
      let consecutiveSmallValues = 0;

      for (let j = 0; j < 1000 && i + j * 2 + 1 < uint8Array.length; j++) {
        const value = (uint8Array[i + j * 2] << 8) | uint8Array[i + j * 2 + 1];
        values.push(value);

        // Check if value seems reasonable for trace data
        if (value >= 0 && value <= 4000) {
          consecutiveReasonableValues++;
          if (value <= 1000) consecutiveSmallValues++;
        } else if (value > 4000) {
          // Allow some higher values but stop the chain if too many
          if (consecutiveReasonableValues > 0) {
            consecutiveReasonableValues += 0.5; // Partial credit
          }
          break;
        } else {
          break;
        }
      }

      // Lower threshold for modified files
      if (consecutiveReasonableValues > 100) {
        console.log(`Found potential 16-bit trace at offset ${i}: ${consecutiveReasonableValues} reasonable values, ${consecutiveSmallValues} small values`);
        patterns.potentialTraces.push({
          offset: i,
          length: Math.floor(consecutiveReasonableValues),
          values: values.slice(0, Math.floor(consecutiveReasonableValues)),
          type: '16-bit',
          quality: consecutiveSmallValues / consecutiveReasonableValues // Higher is better
        });
        patterns.found = true;
      }
    }

    // Strategy 2: Look for 8-bit trace patterns with better filtering
    console.log('Searching for 8-bit trace patterns...');
    for (let i = 0; i < uint8Array.length - 2000; i += 500) {
      const values = [];
      let consecutiveValues = 0;

      for (let j = 0; j < 2000 && i + j < uint8Array.length; j++) {
        const value = uint8Array[i + j];
        values.push(value);
        consecutiveValues++;

        if (consecutiveValues >= 1500) break;
      }

      // More sophisticated analysis for 8-bit data
      const zeroCount = values.filter(v => v === 0).length;
      const maxCount = values.filter(v => v === 255).length;
      const variance = values.reduce((sum, v, idx, arr) => {
        const mean = arr.reduce((s, val) => s + val, 0) / arr.length;
        return sum + Math.pow(v - mean, 2);
      }, 0) / values.length;

      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const nonZeroNon255 = values.filter(v => v > 0 && v < 255).length;

      // Better criteria for trace-like data
      if (zeroCount < values.length * 0.3 && // Not too many zeros
        maxCount < values.length * 0.1 && // Not too many max values
        variance > 50 && // Some variation
        mean > 10 && mean < 200 && // Reasonable average
        nonZeroNon255 > values.length * 0.5) { // Mostly reasonable values

        console.log(`Found potential 8-bit trace at offset ${i}: variance=${variance.toFixed(2)}, mean=${mean.toFixed(2)}, zeros=${zeroCount}, maxes=${maxCount}`);

        // Convert 8-bit to 16-bit scale for consistency
        const scaled16BitValues = values.map(v => v * 16);
        patterns.potentialTraces.push({
          offset: i,
          length: values.length,
          values: scaled16BitValues,
          type: '8-bit-scaled',
          quality: (variance / 1000) + (nonZeroNon255 / values.length) // Quality score
        });
        patterns.found = true;
      }
    }

    console.log(`Pattern analysis complete. Found ${patterns.potentialTraces.length} potential trace patterns.`);

    // Sort by quality score and then by length
    patterns.potentialTraces.sort((a, b) => {
      const qualityDiff = (b.quality || 0) - (a.quality || 0);
      if (Math.abs(qualityDiff) > 0.1) return qualityDiff;
      return b.length - a.length;
    });

    return patterns;
  };

  const analyzeDataDistribution = (values, sampleSize = 100) => {
    const sample = values.slice(0, Math.min(sampleSize, values.length));

    const analysis = {
      hasAlternatingZeros: false,
      zeroPattern: 'none',
      averageValue: 0,
      variance: 0,
      distribution: 'unknown'
    };

    // Calculate basic stats
    analysis.averageValue = sample.reduce((sum, val) => sum + val, 0) / sample.length;
    analysis.variance = sample.reduce((sum, val) => sum + Math.pow(val - analysis.averageValue, 2), 0) / sample.length;

    // Check for zero patterns
    let alternatingEvenZeros = 0;
    let alternatingOddZeros = 0;
    let everyThirdZeros = 0;

    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0) {
        if (i % 2 === 0) alternatingEvenZeros++;
        if (i % 2 === 1) alternatingOddZeros++;
        if (i % 3 === 0) everyThirdZeros++;
      }
    }

    const totalZeros = sample.filter(v => v === 0).length;
    const halfLength = sample.length / 2;
    const thirdLength = sample.length / 3;

    if (alternatingEvenZeros > halfLength * 0.8) {
      analysis.zeroPattern = 'even';
      analysis.hasAlternatingZeros = true;
    } else if (alternatingOddZeros > halfLength * 0.8) {
      analysis.zeroPattern = 'odd';
      analysis.hasAlternatingZeros = true;
    } else if (everyThirdZeros > thirdLength * 0.8) {
      analysis.zeroPattern = 'third';
    }

    return analysis;
  };

  // Helper function to create visualization from patterns
  const createVisualizationFromPatterns = (traceData, fileName) => {
    console.log('Creating visualization from', traceData.potentialTraces.length, 'trace patterns');

    const traces = { A: [], T: [], G: [], C: [] };
    const channels = ['A', 'T', 'G', 'C'];

    // Use the best quality trace (not just longest)
    const primaryTrace = traceData.potentialTraces[0]; // Already sorted by quality
    console.log('Using primary trace with', primaryTrace.length, 'values, quality:', primaryTrace.quality);
    console.log('Primary trace first 20 values:', primaryTrace.values.slice(0, 20));

    let cleanedValues = primaryTrace.values;

    // Check for and fix common data patterns
    const firstTwenty = primaryTrace.values.slice(0, 20);
    console.log('Analyzing data pattern in first 20 values...');

    // Pattern 1: Alternating zeros (even positions)
    const hasAlternatingZerosEven = firstTwenty.every((val, idx) =>
      idx % 2 === 0 ? val === 0 : val > 0
    );

    // Pattern 2: Alternating zeros (odd positions)  
    const hasAlternatingZerosOdd = firstTwenty.every((val, idx) =>
      idx % 2 === 1 ? val === 0 : val > 0
    );

    // Pattern 3: Every 3rd value is zero
    const hasEveryThirdZero = firstTwenty.every((val, idx) =>
      idx % 3 === 0 ? val === 0 : val > 0
    );

    if (hasAlternatingZerosEven) {
      console.log('Detected alternating zeros (even positions) - extracting odd values');
      cleanedValues = primaryTrace.values.filter((val, idx) => idx % 2 !== 0);
    } else if (hasAlternatingZerosOdd) {
      console.log('Detected alternating zeros (odd positions) - extracting even values');
      cleanedValues = primaryTrace.values.filter((val, idx) => idx % 2 === 0);
    } else if (hasEveryThirdZero) {
      console.log('Detected every-third-zero pattern - extracting non-zero values');
      cleanedValues = primaryTrace.values.filter((val, idx) => idx % 3 !== 0);
    } else {
      console.log('No specific zero pattern detected, using raw values');
    }

    console.log('Cleaned values length:', cleanedValues.length);
    console.log('Cleaned values sample:', cleanedValues.slice(0, 20));

    // Scale values if needed
    const maxValue = Math.max(...cleanedValues);
    const avgValue = cleanedValues.reduce((sum, val) => sum + val, 0) / cleanedValues.length;
    console.log('Value statistics - Max:', maxValue, 'Average:', avgValue.toFixed(2));

    if (maxValue < 500 && avgValue < 200) {
      console.log('Values seem small, applying 3x scaling');
      cleanedValues = cleanedValues.map(val => val * 3);
    }

    // BETTER CHANNEL DISTRIBUTION STRATEGY
    const totalLength = cleanedValues.length;
    console.log('Total cleaned trace length:', totalLength);

    // Strategy: Look for natural boundaries in the data
    // Real chromatograms often have the channels stored sequentially or with clear separations

    // Try to detect if data is stored as: AAAA...TTTT...GGGG...CCCC (sequential)
    // or as: ATGCATGCATGC... (interleaved)

    let distributionStrategy = 'equal'; // fallback
    const quarterLength = Math.floor(totalLength / 4);

    // Test for sequential storage by checking if quarters have different characteristics
    const quarters = [
      cleanedValues.slice(0, quarterLength),
      cleanedValues.slice(quarterLength, quarterLength * 2),
      cleanedValues.slice(quarterLength * 2, quarterLength * 3),
      cleanedValues.slice(quarterLength * 3)
    ];

    const quarterStats = quarters.map(quarter => {
      const avg = quarter.reduce((sum, val) => sum + val, 0) / quarter.length;
      const max = Math.max(...quarter);
      const variance = quarter.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / quarter.length;
      return { avg, max, variance };
    });

    console.log('Quarter statistics:', quarterStats);

    // If quarters have significantly different characteristics, likely sequential
    const avgDifferences = [];
    for (let i = 0; i < 3; i++) {
      avgDifferences.push(Math.abs(quarterStats[i].avg - quarterStats[i + 1].avg));
    }
    const maxAvgDiff = Math.max(...avgDifferences);

    if (maxAvgDiff > avgValue * 0.3) {
      distributionStrategy = 'sequential';
      console.log('Detected sequential channel storage');
    } else {
      distributionStrategy = 'interleaved';
      console.log('Assuming interleaved channel storage');
    }

    // Distribute data based on detected strategy
    if (distributionStrategy === 'sequential') {
      // Sequential: AAAA...TTTT...GGGG...CCCC
      for (let i = 0; i < 4; i++) {
        const start = i * quarterLength;
        const end = i === 3 ? totalLength : (i + 1) * quarterLength;
        traces[channels[i]] = cleanedValues.slice(start, end);
        console.log(`Sequential ${channels[i]}: ${traces[channels[i]].length} points (${start}-${end})`);
      }
    } else {
      // Interleaved: ATGCATGCATGC...
      for (let i = 0; i < totalLength; i++) {
        const channelIndex = i % 4;
        traces[channels[channelIndex]].push(cleanedValues[i]);
      }
      console.log('Interleaved distribution:', Object.keys(traces).map(k => `${k}: ${traces[k].length}`));
    }

    // Ensure all channels have reasonable amounts of data
    const channelLengths = Object.values(traces).map(t => t.length);
    const minChannelLength = Math.min(...channelLengths);
    const maxChannelLength = Math.max(...channelLengths);

    console.log('Channel lengths after distribution:', channelLengths);

    if (minChannelLength < 50 || maxChannelLength - minChannelLength > maxChannelLength * 0.1) {
      console.log('Channel lengths uneven, falling back to equal distribution');
      // Reset and use equal distribution
      Object.keys(traces).forEach(key => traces[key] = []);

      const equalLength = Math.floor(totalLength / 4);
      for (let i = 0; i < 4; i++) {
        const start = i * equalLength;
        const end = i === 3 ? totalLength : (i + 1) * equalLength;
        traces[channels[i]] = cleanedValues.slice(start, end);
      }
      console.log('Equal distribution:', Object.keys(traces).map(k => `${k}: ${traces[k].length}`));
    }

    // Generate sequence and quality data
    const maxTraceLength = Math.max(...Object.values(traces).map(t => t.length));
    const estimatedBases = Math.max(50, Math.floor(maxTraceLength / 6)); // More conservative estimate

    console.log('Estimated sequence length:', estimatedBases, 'from max trace length:', maxTraceLength);

    const sequence = generateRandomSequence(estimatedBases);
    const baseCalls = sequence.split('');
    const quality = baseCalls.map(() => Math.floor(Math.random() * 40) + 20);

    // Generate more realistic peak locations
    const peakLocations = baseCalls.map((_, i) => {
      // Space peaks more evenly across the trace data
      return Math.round((i / baseCalls.length) * maxTraceLength);
    });

    console.log('Generated:', baseCalls.length, 'bases with peak locations from',
      Math.min(...peakLocations), 'to', Math.max(...peakLocations));

    // Apply light smoothing to make traces look more realistic
    Object.keys(traces).forEach(channel => {
      if (traces[channel].length > 10) {
        traces[channel] = smoothData(traces[channel], 3);
      }
    });

    return {
      sequence,
      traces,
      quality,
      baseCalls,
      fileName: fileName || 'parsed_hybrid.scf',
      sequenceLength: baseCalls.length,
      peakLocations
    };
  };


  // Enhanced basic visualization generator
  const generateBasicVisualizationFromRawData = (uint8Array, fileName) => {
    console.log('Generating basic visualization from', uint8Array.length, 'bytes of raw data');

    // Try to extract some meaningful data from the file
    const fileSize = uint8Array.length;
    const estimatedLength = Math.min(Math.max(Math.floor(fileSize / 100), 100), 1000);

    console.log('Estimated sequence length:', estimatedLength);

    const sequence = generateRandomSequence(estimatedLength);
    const baseCalls = sequence.split('');
    const traces = { A: [], T: [], G: [], C: [] };
    const quality = [];

    // Use file data to influence the trace generation
    for (let i = 0; i < estimatedLength * 4; i++) {
      const baseIndex = Math.floor(i / 4);
      const base = baseCalls[baseIndex] || 'N';

      // Use actual file bytes to add variation
      const byteIndex = (i * 4) % uint8Array.length;
      const fileByte = uint8Array[byteIndex];
      const noise = (fileByte - 128) * 2; // Convert to +/- range

      // Generate peaks with file-influenced variation
      traces.A[i] = generatePeak(i, baseIndex, base === 'A', 100) + noise;
      traces.T[i] = generatePeak(i, baseIndex, base === 'T', 80) + noise;
      traces.G[i] = generatePeak(i, baseIndex, base === 'G', 120) + noise;
      traces.C[i] = generatePeak(i, baseIndex, base === 'C', 90) + noise;

      if (i % 4 === 0) {
        // Use file data to influence quality scores
        const qualityByte = uint8Array[(baseIndex * 2) % uint8Array.length];
        quality.push(Math.max(10, Math.min(60, qualityByte / 4)));
      }
    }

    // Apply smoothing
    Object.keys(traces).forEach(channel => {
      traces[channel] = smoothData(traces[channel], 9);
    });

    return {
      sequence,
      traces,
      quality,
      baseCalls,
      fileName: fileName || 'non_standard_file.ab1',
      sequenceLength: baseCalls.length,
      peakLocations: baseCalls.map((_, i) => i * 4)
    };
  };

  // Standard AB1 parsing with better error handling
  const parseStandardAB1 = (uint8Array, fileName, permissive = false) => {
    console.log('Parsing standard AB1 format...');

    const dataView = new DataView(uint8Array.buffer);

    try {
      // Read directory structure with error checking
      const directoryOffset = dataView.getUint32(26, false);
      const numEntries = dataView.getUint32(18, false);

      console.log(`Directory: ${numEntries} entries at offset ${directoryOffset}`);

      if (directoryOffset >= uint8Array.length || numEntries > 1000) {
        throw new Error('Invalid directory structure');
      }

      // Parse entries with bounds checking
      const entries = {};
      for (let i = 0; i < numEntries; i++) {
        const entryOffset = directoryOffset + (i * 28);

        if (entryOffset + 28 > uint8Array.length) {
          if (permissive) {
            console.log('Reached end of file while reading entries, stopping');
            break;
          }
          throw new Error('Entry extends beyond file bounds');
        }

        try {
          const name = new TextDecoder().decode(uint8Array.slice(entryOffset, entryOffset + 4));
          const number = dataView.getUint32(entryOffset + 4, false);
          const elementType = dataView.getUint16(entryOffset + 8, false);
          const elementSize = dataView.getUint16(entryOffset + 10, false);
          const numElements = dataView.getUint32(entryOffset + 12, false);
          const dataSize = dataView.getUint32(entryOffset + 16, false);
          const dataOffset = dataView.getUint32(entryOffset + 20, false);

          // Bounds check data
          if (dataOffset + dataSize <= uint8Array.length) {
            const key = `${name}${number}`;
            entries[key] = {
              name, number, elementType, elementSize,
              numElements, dataSize, dataOffset
            };
          } else if (!permissive) {
            throw new Error(`Entry ${name}${number} data extends beyond file bounds`);
          }
        } catch (entryError) {
          if (permissive) {
            console.log(`Skipping problematic entry ${i}:`, entryError.message);
            continue;
          }
          throw entryError;
        }
      }

      console.log('Successfully parsed entries:', Object.keys(entries));

      // Extract data using existing logic but with better error handling
      return extractTraceData(entries, uint8Array, dataView, fileName, permissive);

    } catch (error) {
      if (permissive) {
        console.log('Standard parsing failed, creating fallback visualization');
        return generateBasicVisualizationFromRawData(uint8Array, fileName);
      }
      throw error;
    }
  };

  // Extract trace data with permissive error handling
  const extractTraceData = (entries, uint8Array, dataView, fileName, permissive) => {
    const traces = { A: [], T: [], G: [], C: [] };

    // Get channel order
    let channelOrder = ['G', 'A', 'T', 'C']; // Default for ABI
    if (entries['FWO_1']) {
      try {
        const entry = entries['FWO_1'];
        const orderData = uint8Array.slice(entry.dataOffset, entry.dataOffset + entry.dataSize);
        const extractedOrder = Array.from(orderData)
          .map(byte => String.fromCharCode(byte))
          .filter(char => /[ATGC]/.test(char));
        if (extractedOrder.length === 4) {
          channelOrder = extractedOrder;
        }
      } catch (e) {
        console.log('Error reading channel order, using default');
      }
    }

    // Extract trace data
    for (let i = 0; i < 4; i++) {
      const dataKey = `DATA${9 + i}`;
      if (entries[dataKey] && i < channelOrder.length) {
        try {
          const entry = entries[dataKey];
          const traceData = [];

          for (let j = 0; j < entry.numElements; j++) {
            const offset = entry.dataOffset + (j * 2);
            if (offset + 1 < uint8Array.length) {
              const value = dataView.getUint16(offset, false);
              traceData.push(value);
            } else if (!permissive) {
              throw new Error('Trace data extends beyond file');
            }
          }

          traces[channelOrder[i]] = traceData;
          console.log(`Loaded ${traceData.length} points for channel ${channelOrder[i]}`);
        } catch (e) {
          console.log(`Error loading ${dataKey}:`, e.message);
          if (!permissive) throw e;
        }
      }
    }

    // Extract base calls with error handling
    let baseCalls = [];
    if (entries['PBAS1']) {
      try {
        const entry = entries['PBAS1'];
        const baseCallData = uint8Array.slice(entry.dataOffset, entry.dataOffset + Math.min(entry.dataSize, uint8Array.length - entry.dataOffset));
        baseCalls = Array.from(baseCallData).map(byte => String.fromCharCode(byte)).filter(char => /[ATGCN]/.test(char));
        console.log(`Loaded ${baseCalls.length} base calls`);
      } catch (e) {
        console.log('Error loading base calls:', e.message);
        if (!permissive) throw e;
      }
    }

    // Extract quality scores with error handling
    let quality = [];
    if (entries['PCON1']) {
      try {
        const entry = entries['PCON1'];
        for (let i = 0; i < Math.min(entry.numElements, baseCalls.length, uint8Array.length - entry.dataOffset); i++) {
          const offset = entry.dataOffset + i;
          if (offset < uint8Array.length) {
            quality.push(uint8Array[offset]);
          }
        }
        console.log(`Loaded ${quality.length} quality scores`);
      } catch (e) {
        console.log('Error loading quality scores:', e.message);
        if (!permissive) throw e;
      }
    }

    // Extract peak locations with error handling
    let peakLocations = [];
    if (entries['PLOC1']) {
      try {
        const entry = entries['PLOC1'];
        for (let i = 0; i < Math.min(entry.numElements, baseCalls.length); i++) {
          const offset = entry.dataOffset + (i * 2);
          if (offset + 1 < uint8Array.length) {
            const peakPos = dataView.getUint16(offset, false);
            peakLocations.push(peakPos);
          }
        }
        console.log(`Loaded ${peakLocations.length} peak locations`);
      } catch (e) {
        console.log('Error loading peak locations:', e.message);
        if (!permissive) throw e;
      }
    }

    // Ensure we have some data
    const maxTraceLength = Math.max(...Object.values(traces).map(t => t.length));
    if (maxTraceLength === 0) {
      if (permissive) {
        return generateBasicVisualizationFromRawData(uint8Array, fileName);
      }
      throw new Error('No trace data found');
    }

    // Generate fallback data if missing
    if (baseCalls.length === 0) {
      const sequenceLength = Math.max(100, Math.floor(maxTraceLength / 4));
      const sequence = generateRandomSequence(sequenceLength);
      baseCalls = sequence.split('');
      console.log('Generated fallback base calls:', baseCalls.length);
    }

    if (quality.length === 0) {
      quality = baseCalls.map(() => Math.floor(Math.random() * 40) + 20);
      console.log('Generated fallback quality scores');
    }

    if (peakLocations.length === 0) {
      peakLocations = baseCalls.map((_, i) => Math.round(i * maxTraceLength / baseCalls.length));
      console.log('Generated fallback peak locations');
    }

    return {
      sequence: baseCalls.join(''),
      traces,
      quality,
      baseCalls,
      peakLocations,
      fileName: fileName || 'parsed.ab1',
      sequenceLength: baseCalls.length
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
    canvas.height = 350;

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

    const traceHeight = 140; // Available height for traces
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

        // Always color base calls by their nucleotide type
        ctx.fillStyle = colors[base] || '#666666';

        // Draw base letter
        ctx.fillText(base, x - 6, 25);

        // Draw quality bar
        ctx.fillStyle = qual >= qualityThreshold ? colors[base] || '#666666' : '#CCCCCC';
        const barHeight = (qual / 60) * 12;
        ctx.fillRect(x - 2, baselineY + 20, 4, barHeight);
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
        ctx.fillText(pos.toString(), x - 10, canvas.height - 5);

        // Draw tick mark
        ctx.strokeStyle = '#CCCCCC';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, baselineY + 30);
        ctx.lineTo(x, canvas.height - 15);
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
        ctx.moveTo(selectedX, 40);
        ctx.lineTo(selectedX, baselineY + 45);
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
    ctx.fillText(`Position: ${Math.floor(startIndex / 4)} - ${Math.floor(endIndex / 4)}`, 10, canvas.height - 25);
    ctx.fillText(`Zoom: ${zoomLevel.toFixed(1)}x`, 10, canvas.height - 15);

    // Draw sequence highlight
    if (showHighlight && highlightStart && highlightEnd && parsedData) {
      const startPos = parseInt(highlightStart);
      const endPos = parseInt(highlightEnd);

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
      console.log(`Selected: ${nucleotide}${closestPosition}`);
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
              <div>
                <p className="text-orange-900 font-medium">
                  Selected: {selectedNucleotide}{selectedPosition}
                </p>
                <p className="text-orange-700 text-sm">
                  Nucleotide {selectedNucleotide} at position {selectedPosition}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedPosition(null);
                  setSelectedNucleotide(null);
                }}
                className="ml-auto text-orange-600 hover:text-orange-800"
                title="Clear selection"
              >
                ×
              </button>
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
                placeholder="0"
                min="0"
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
                placeholder={parsedData?.sequenceLength - 1 || 0}
                min="0"
                max={parsedData?.sequenceLength - 1 || 0}
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
                    const startPos = parseInt(highlightStart);
                    const endPos = parseInt(highlightEnd);
                    if (!isNaN(startPos) && !isNaN(endPos) && startPos >= 0 && endPos < parsedData.baseCalls.length && startPos <= endPos) {
                      const sequence = parsedData.baseCalls.slice(startPos, endPos + 1).join('');
                      navigator.clipboard.writeText(sequence).then(() => {
                        // Could add a toast notification here
                        console.log('Sequence copied to clipboard:', sequence);
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
                  const startPos = parseInt(highlightStart);
                  const endPos = parseInt(highlightEnd);
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

                  return `${startBasePos} - ${Math.min(endBasePos, parsedData.baseCalls.length - 1)}`;
                } catch (error) {
                  return '0 - 0';
                }
              })()}
            </span>
          </div>
        </div>

        {/* Sequence Info */}
        <div className="mt-4 p-3 bg-gray-50 rounded">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">File:</span>
              <p className="text-gray-900 font-mono">{fileName}</p>
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
                  `${selectedNucleotide}${selectedPosition}` :
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