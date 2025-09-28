// components/SequenceAlignmentModal.jsx
import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, Copy, BarChart3 } from 'lucide-react';

const SequenceAlignmentModal = ({ isOpen, onClose, studentSequence, questionText, sequenceType }) => {
    const [directorSequence, setDirectorSequence] = useState('');
    const [alignment, setAlignment] = useState(null);
    const [loading, setLoading] = useState(false);

    const performAlignment = () => {
        if (!directorSequence.trim()) {
            alert('Please enter a sequence to compare');
            return;
        }

        setLoading(true);

        // Clean sequences (remove whitespace, convert to uppercase)
        const cleanDirector = directorSequence.replace(/\s/g, '').toUpperCase();
        const cleanStudent = studentSequence.replace(/\s/g, '').toUpperCase();

        // Perform Needleman-Wunsch alignment
        const result = needlemanWunschAlignment(cleanDirector, cleanStudent);
        setAlignment(result);
        setLoading(false);
    };

    const needlemanWunschAlignment = (seq1, seq2, match = 2, mismatch = -1, gap = -1) => {
        const n = seq1.length;
        const m = seq2.length;
        
        // Initialize scoring matrix
        const score = Array(n + 1).fill().map(() => Array(m + 1).fill(0));
        
        // Initialize first row and column with gap penalties
        for (let i = 0; i <= n; i++) score[i][0] = i * gap;
        for (let j = 0; j <= m; j++) score[0][j] = j * gap;
        
        // Fill the scoring matrix
        for (let i = 1; i <= n; i++) {
            for (let j = 1; j <= m; j++) {
                const diagonal = score[i-1][j-1] + (seq1[i-1] === seq2[j-1] ? match : mismatch);
                const up = score[i-1][j] + gap;
                const left = score[i][j-1] + gap;
                score[i][j] = Math.max(diagonal, up, left);
            }
        }
        
        // Traceback to get optimal alignment
        let alignedSeq1 = '';
        let alignedSeq2 = '';
        let i = n, j = m;
        
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && score[i][j] === score[i-1][j-1] + (seq1[i-1] === seq2[j-1] ? match : mismatch)) {
                // Diagonal move (match or mismatch)
                alignedSeq1 = seq1[i-1] + alignedSeq1;
                alignedSeq2 = seq2[j-1] + alignedSeq2;
                i--; j--;
            } else if (i > 0 && score[i][j] === score[i-1][j] + gap) {
                // Up move (gap in seq2)
                alignedSeq1 = seq1[i-1] + alignedSeq1;
                alignedSeq2 = '-' + alignedSeq2;
                i--;
            } else {
                // Left move (gap in seq1)
                alignedSeq1 = '-' + alignedSeq1;
                alignedSeq2 = seq2[j-1] + alignedSeq2;
                j--;
            }
        }
        
        // Calculate alignment statistics
        let matches = 0;
        let mismatches = 0;
        let gaps = 0;
        const matchString = [];
        
        for (let k = 0; k < alignedSeq1.length; k++) {
            const char1 = alignedSeq1[k];
            const char2 = alignedSeq2[k];
            
            if (char1 === '-' || char2 === '-') {
                gaps++;
                matchString.push(' ');
            } else if (char1 === char2) {
                matches++;
                matchString.push('|');
            } else {
                mismatches++;
                matchString.push(' ');
            }
        }
        
        // Calculate identity percentage based on aligned length
        const alignedLength = alignedSeq1.length;
        const identity = alignedLength > 0 ? ((matches / alignedLength) * 100).toFixed(1) : 0;
        
        return {
            aligned1: alignedSeq1,
            aligned2: alignedSeq2,
            matchString: matchString.join(''),
            matches,
            mismatches,
            gaps,
            identity,
            length1: seq1.length,
            length2: seq2.length,
            alignmentScore: score[n][m]
        };
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

    const formatSequence = (sequence, lineLength = 60) => {
        const lines = [];
        for (let i = 0; i < sequence.length; i += lineLength) {
            lines.push(sequence.slice(i, i + lineLength));
        }
        return lines;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold mb-1">Sequence Alignment Tool</h3>
                            <p className="text-blue-100 opacity-90">
                                {sequenceType === 'dna_sequence' ? 'DNA' : 'Protein'} Sequence Comparison (Needleman-Wunsch)
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:text-gray-200 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {/* Question Context */}
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                        <h4 className="font-medium text-gray-900 mb-2">Question:</h4>
                        <p className="text-sm text-gray-700">{questionText}</p>
                    </div>

                    {/* Input Section */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Director's Reference Sequence ({sequenceType === 'dna_sequence' ? 'DNA' : 'Protein'}):
                        </label>
                        <textarea
                            value={directorSequence}
                            onChange={(e) => setDirectorSequence(e.target.value)}
                            placeholder={`Paste your ${sequenceType === 'dna_sequence' ? 'DNA' : 'protein'} sequence here...`}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        />
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-sm text-gray-500">
                                Length: {directorSequence.replace(/\s/g, '').length} characters
                            </span>
                            <button
                                onClick={performAlignment}
                                disabled={loading || !directorSequence.trim()}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
                            >
                                {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                <span>Align Sequences</span>
                            </button>
                        </div>
                    </div>

                    {/* Student Sequence Display */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Student's Sequence:
                            </label>
                            <button
                                onClick={() => copyToClipboard(studentSequence)}
                                className="text-blue-600 hover:text-blue-800 flex items-center space-x-1 text-sm"
                            >
                                <Copy className="w-4 h-4" />
                                <span>Copy</span>
                            </button>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 border">
                            <div className="font-mono text-sm text-gray-800 break-all">
                                {studentSequence || 'No sequence provided'}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                                Length: {studentSequence?.replace(/\s/g, '').length || 0} characters
                            </div>
                        </div>
                    </div>

                    {/* Alignment Results */}
                    {alignment && (
                        <div className="space-y-6">
                            {/* Statistics */}
                            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border">
                                <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                                    <BarChart3 className="w-5 h-5 text-blue-600" />
                                    <span>Alignment Statistics</span>
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-green-600">{alignment.identity}%</div>
                                        <div className="text-gray-600">Identity</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-semibold text-blue-600">{alignment.matches}</div>
                                        <div className="text-gray-600">Matches</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-semibold text-red-600">{alignment.mismatches}</div>
                                        <div className="text-gray-600">Mismatches</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-semibold text-yellow-600">{alignment.gaps}</div>
                                        <div className="text-gray-600">Gaps</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-semibold text-purple-600">{alignment.alignmentScore}</div>
                                        <div className="text-gray-600">Score</div>
                                    </div>
                                </div>
                            </div>

                            {/* Alignment Display */}
                            <div className="bg-gray-50 rounded-lg p-4 border">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-medium text-gray-900">Optimal Global Alignment</h4>
                                    <div className="text-sm text-gray-600">
                                        Director: {alignment.length1} bp | Student: {alignment.length2} bp
                                    </div>
                                </div>

                                <div className="font-mono text-sm overflow-x-auto bg-white rounded p-4 border">
                                    {formatSequence(alignment.aligned1).map((line, index) => {
                                        const start = index * 60;
                                        const directorLine = alignment.aligned1.slice(start, start + 60);
                                        const matchLine = alignment.matchString.slice(start, start + 60);
                                        const studentLine = alignment.aligned2.slice(start, start + 60);

                                        // Calculate actual positions in original sequences (excluding gaps)
                                        const getPositions = (alignedSeq, startPos, lineSeq) => {
                                            let actualPos = 0;

                                            // Count non-gap characters up to startPos
                                            for (let i = 0; i < startPos && i < alignedSeq.length; i++) {
                                                if (alignedSeq[i] !== '-') actualPos++;
                                            }

                                            const startActual = actualPos + 1; // 1-based indexing
                                            let endActual = startActual;

                                            // Count non-gap characters in current line
                                            for (let i = 0; i < lineSeq.length; i++) {
                                                if (lineSeq[i] !== '-') endActual++;
                                            }
                                            endActual = endActual > startActual ? endActual - 1 : startActual; // Adjust for counting

                                            return { start: startActual, end: endActual };
                                        };

                                        const directorPos = getPositions(alignment.aligned1, start, directorLine);
                                        const studentPos = getPositions(alignment.aligned2, start, studentLine);

                                        return (
                                            <div key={index} className="mb-4">
                                                <div className="space-y-1">
                                                    {/* Director sequence */}
                                                    <div className="text-blue-700">
                                                        <span className="inline-block w-20 font-medium">Director:</span>
                                                        <span className="inline-block w-12 text-right font-medium">{directorPos.start}</span>
                                                        <span className="tracking-wider"> {directorLine}</span>
                                                        <span className="font-medium ml-1">{directorPos.end}</span>
                                                    </div>

                                                    {/* Match string */}
                                                    <div className="text-gray-600">
                                                        <span className="inline-block w-20"></span>
                                                        <span className="inline-block w-12"></span>
                                                        <span className="tracking-wider"> {matchLine}</span>
                                                    </div>

                                                    {/* Student sequence */}
                                                    <div className="text-green-700">
                                                        <span className="inline-block w-20 font-medium">Student:</span>
                                                        <span className="inline-block w-12 text-right font-medium">{studentPos.start}</span>
                                                        <span className="tracking-wider"> {studentLine}</span>
                                                        <span className="font-medium ml-1">{studentPos.end}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Legend */}
                                <div className="mt-4 text-sm text-gray-600 bg-white p-3 rounded border">
                                    <strong>Legend:</strong>
                                    <span className="ml-2">| = match</span>
                                    <span className="ml-4">. = mismatch</span>
                                    <span className="ml-4">(space) = gap</span>
                                    <span className="ml-4">- = gap character</span>
                                    <div className="mt-1 text-xs text-gray-500">
                                        Position numbers show actual sequence positions (gaps excluded) • 
                                        Scoring: Match +2, Mismatch -1, Gap -1
                                    </div>
                                </div>
                            </div>

                            {/* Interpretation */}
                            <div className={`rounded-lg p-4 border ${alignment.identity >= 95 ? 'bg-green-50 border-green-200' :
                                alignment.identity >= 80 ? 'bg-yellow-50 border-yellow-200' :
                                    'bg-red-50 border-red-200'
                                }`}>
                                <div className="flex items-center space-x-2 mb-2">
                                    {alignment.identity >= 95 ? (
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5 text-yellow-600" />
                                    )}
                                    <h4 className="font-medium text-gray-900">Alignment Interpretation</h4>
                                </div>
                                <p className="text-sm text-gray-700">
                                    {alignment.identity >= 95 ? 
                                        "Excellent alignment! The sequences are nearly identical with optimal gap placement." :
                                        alignment.identity >= 80 ?
                                        "Good alignment with some differences. The algorithm has optimally placed gaps and identified the best possible alignment." :
                                        "Significant differences detected. This represents the best possible global alignment between these sequences."
                                    }
                                </p>
                                <p className="text-xs text-gray-500 mt-2">
                                    Alignment score: {alignment.alignmentScore} (higher scores indicate better alignments)
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SequenceAlignmentModal;