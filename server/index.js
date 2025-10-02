const {
  CLONE_STATUSES,
  isValidStatus,
  isValidStatusTransition,
  validateAndWarnStatus,
  getReviewStatus,
  REVIEW_ACTION_MAP,
  STATUS_GROUPS,
  isReviewReady
} = require('./statusConstraints.js');

const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'; // Use a secure secret in production
const IPINFO_TOKEN = process.env.IPINFO_TOKEN;

const crypto = require('crypto');
const nodemailer = require('nodemailer');

const {
  findMatchingQuestion,
  validateQuestionHelpTopicRelationship,
  validateMasterChildStructure
} = require('./utils/importExportValidation');

app.set('trust proxy', true);

console.log('=== ENVIRONMENT VARIABLES CHECK ===');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('SENDGRID_API_KEY exists:', !!process.env.SENDGRID_API_KEY);
console.log('SENDGRID_API_KEY length:', process.env.SENDGRID_API_KEY?.length);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('=====================================');

/**
// Email configuration (SENDGRID)
const emailTransporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'apikey', // This is literally the string 'apikey'
    pass: process.env.SENDGRID_API_KEY // Your actual API key
  },
  connectionTimeout: 10000,
  greetingTimeout: 5000,
  socketTimeout: 10000
});
**/

const sgMail = require('@sendgrid/mail');

// Remove the old emailTransporter configuration
// Replace with:
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Test SendGrid API connection
const testSendGridConnection = async () => {
  try {
    // SendGrid doesn't have a "verify" method like nodemailer, but we can test with the API key
    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_API_KEY.startsWith('SG.')) {
      throw new Error('Invalid SendGrid API key format');
    }
    console.log('SendGrid API key configured successfully');
  } catch (error) {
    console.error('SendGrid configuration error:', error.message);
  }
};

testSendGridConnection();

/**
// Test connection on startup
emailTransporter.verify((error, success) => {
  if (error) {
    console.error('SendGrid connection error:', error);
  } else {
    console.log('SendGrid is ready to send emails');
  }
});
*/

// Configure multer for local storage
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;

// Create uploads directory if it doesn't exist
const directories = [
  path.join(__dirname, 'uploads'),
  path.join(__dirname, 'submissions'),
  path.join(__dirname, 'temp')
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  }
});

const uploadsDir = path.join(__dirname, 'uploads');

// Configure multer for local storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `${uniqueSuffix}-${file.originalname}`;
    cb(null, filename);
  }
});

const upload = multer({ storage: storage });

async function deleteLocalFiles(filenames) {
  const deletePromises = filenames.map(async (filename) => {
    try {
      const filePath = path.join(__dirname, 'uploads', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Successfully deleted local file:', filename);
        return { filename, success: true };
      }
      return { filename, success: false, error: 'File not found' };
    } catch (error) {
      console.error('Error deleting local file:', filename, error);
      return { filename, success: false, error: error.message };
    }
  });

  const results = await Promise.allSettled(deletePromises);
  return results.map(result => result.status === 'fulfilled' ? result.value : result.reason);
}

// Add this right after your require statements at the top
console.log('=== ENVIRONMENT VARIABLES CHECK ===');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASSWORD exists:', !!process.env.EMAIL_PASSWORD);
console.log('EMAIL_PASSWORD length:', process.env.EMAIL_PASSWORD?.length);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('=====================================');



// Add this middleware function after imports
const validateStatusMiddleware = (req, res, next) => {
  if (req.body.status && !isValidStatus(req.body.status)) {
    return res.status(400).json({
      error: 'Invalid status provided',
      receivedStatus: req.body.status,
      validStatuses: Object.values(CLONE_STATUSES)
    });
  }
  next();
};

// Handle preflight requests
app.options('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'https://e39465be44d5.ngrok.app', 'https://d3e1112ebefd.ngrok.app'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
  credentials: true
}));

// Middleware (add this right after the app.options section)
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
    process.env.FRONTEND_URL,  // Set this in Railway environment variables
    'https://your-railway-app.railway.app'  // Your actual Railway domain
  ]
  : [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://ab2abec5ead1.ngrok.app'  // Keep for local development
  ];

app.use(cors({
  origin: (origin, callback) => {
    // Accept all origins
    callback(null, true);
  },
  credentials: true
}));


app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const fileFilter = (req, file, cb) => {
  // Only allow .ab1 files
  if (file.originalname.toLowerCase().endsWith('.ab1')) {
    cb(null, true);
  } else {
    cb(new Error('Only .ab1 files are allowed'), false);
  }
};


// Rate limiting for NCBI API (max 3 requests per second)
let lastRequestTime = 0;
const minRequestInterval = 334; // ~3 requests per second

const enforceRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < minRequestInterval) {
    const waitTime = minRequestInterval - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
};

// Parse text format BLAST results as fallback
const parseTextBlastResults = (text) => {
  try {
    const results = [];
    const lines = text.split('\n');
    let inAlignmentSection = false;
    let rank = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for alignment section
      if (line.includes('Sequences producing significant alignments:')) {
        inAlignmentSection = true;
        i += 2; // Skip header lines
        continue;
      }

      // Parse alignment entries
      if (inAlignmentSection && line.trim() && !line.startsWith('>') && results.length < 3) {
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
          results.push({
            rank: rank++,
            accession: parts[0] || '',
            definition: line.substring(line.indexOf(parts[1]) || 0, line.lastIndexOf(parts[parts.length - 2]) || line.length).trim(),
            organism: '',
            start: '',
            end: '',
            evalue: parts[parts.length - 1] || '',
            score: parts[parts.length - 2] || '',
            identity: ''
          });
        }
      }

      // Stop after getting 3 results or end of section
      if (inAlignmentSection && (results.length >= 3 || line.trim() === '')) {
        break;
      }
    }

    return results;
  } catch (error) {
    console.error('Error parsing text BLAST results:', error);
    return [];
  }
};

const parseXMLBlastResults = (xmlText) => {
  try {
    // Extract XML content
    const xmlStart = xmlText.indexOf('<BlastOutput>');
    const xmlEnd = xmlText.indexOf('</BlastOutput>') + '</BlastOutput>'.length;

    if (xmlStart === -1 || xmlEnd === -1) {
      console.log('No valid XML found in response');
      return [];
    }

    const xmlContent = xmlText.substring(xmlStart, xmlEnd);
    console.log('Extracted XML length:', xmlContent.length);

    // Parse hits using regex (simple XML parsing for this specific case)
    const results = [];
    const hitPattern = /<Hit>([\s\S]*?)<\/Hit>/g;
    let hitMatch;
    let rank = 1;

    while ((hitMatch = hitPattern.exec(xmlContent)) !== null && rank <= 3) {
      const hitXml = hitMatch[1];

      // Extract fields using regex
      const accession = (hitXml.match(/<Hit_accession>(.*?)<\/Hit_accession>/) || [])[1] || '';
      const definition = (hitXml.match(/<Hit_def>(.*?)<\/Hit_def>/) || [])[1] || '';
      const length = (hitXml.match(/<Hit_len>(.*?)<\/Hit_len>/) || [])[1] || '';

      // Get first HSP (High-scoring Segment Pair)
      const hspMatch = hitXml.match(/<Hsp>([\s\S]*?)<\/Hsp>/);
      if (hspMatch) {
        const hspXml = hspMatch[1];
        const score = (hspXml.match(/<Hsp_score>(.*?)<\/Hsp_score>/) || [])[1] || '';
        const evalue = (hspXml.match(/<Hsp_evalue>(.*?)<\/Hsp_evalue>/) || [])[1] || '';
        const identity = (hspXml.match(/<Hsp_identity>(.*?)<\/Hsp_identity>/) || [])[1] || '';
        const hitFrom = (hspXml.match(/<Hsp_hit-from>(.*?)<\/Hsp_hit-from>/) || [])[1] || '';
        const hitTo = (hspXml.match(/<Hsp_hit-to>(.*?)<\/Hsp_hit-to>/) || [])[1] || '';

        results.push({
          rank: rank,
          accession: accession,
          definition: definition,
          organism: '', // Extract from definition if needed
          start: hitFrom,
          end: hitTo,
          evalue: evalue ? parseFloat(evalue).toExponential(2) : '',
          score: score,
          identity: identity
        });
      }

      rank++;
    }

    console.log('Parsed', results.length, 'hits from XML');
    return results;

  } catch (error) {
    console.error('Error parsing XML BLAST results:', error);
    return [];
  }
};

const getAppropriateDatabase = (program, requestedDatabase) => {
  // If user specifically requests a database, use it
  if (requestedDatabase && requestedDatabase !== 'auto') {
    return requestedDatabase;
  }

  // Use appropriate default for the program
  switch (program.toLowerCase()) {
    case 'blastn':
      return 'nt';           // Nucleotide database for DNA searches
    case 'blastx':
    case 'blastp':
    case 'tblastn':
      return 'nr';           // ClusteredNR does not work with API?
    case 'tblastx':
      return 'nt';           // Translated nucleotide vs translated nucleotide
    default:
      return 'nt';           // Default fallback
  }
};

const getWordSize = (program) => {
  switch (program.toLowerCase()) {
    case 'blastn':
      return '11';
    case 'blastx':
    case 'blastp':
    case 'tblastn':
    case 'tblastx':
      return '3';
    default:
      return '11';
  }
};

// Submit BLAST search to NCBI and get Request ID
const submitBlastToNCBI = async (sequence, database = 'auto', program = 'blastn') => {
  const fetch = (await import('node-fetch')).default;




  // Get the appropriate database
  const actualDatabase = getAppropriateDatabase(program, database);
  console.log(`Using database "${actualDatabase}" for program "${program}"`);

  console.log('=== SUBMITTING TO NCBI ===');
  console.log('Program:', program);
  console.log('Requested database:', database);
  console.log('Actual database:', actualDatabase);
  console.log('Sequence length:', sequence.length);
  console.log('Word size:', getWordSize(program));


  const params = new URLSearchParams({
    CMD: 'Put',
    PROGRAM: program,
    DATABASE: actualDatabase,  // Use the corrected database
    QUERY: sequence,
    FORMAT_TYPE: 'XML',
    HITLIST_SIZE: '3',
    EXPECT: '10',
    WORD_SIZE: getWordSize(program)
  });

  console.log('=== NCBI PARAMETERS ===');
  console.log('Full parameter string:', params.toString());

  const response = await fetch('https://blast.ncbi.nlm.nih.gov/Blast.cgi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  });

  console.log('=== NCBI SUBMIT RESPONSE ===');
  console.log('Status:', response.status, response.statusText);
  console.log('Headers:', Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    console.log('❌ NCBI submit failed');
    throw new Error(`NCBI BLAST submit failed: ${response.status} ${response.statusText}`);
  }


  const text = await response.text();
  //console.log('NCBI submit response:', text);

  console.log('Response length:', text.length);
  console.log('Response preview (first 500 chars):', text.substring(0, 500));


  // Extract RID from response
  const ridMatch = text.match(/RID = (.+)/);
  if (!ridMatch) {
    console.log('❌ No RID found in response');
    console.log('Full response text:', text);
    throw new Error('Failed to get Request ID from NCBI');
  }
  const rid = ridMatch[1].trim();
  console.log('✅ RID extracted:', rid);
  return rid;
};

// Poll NCBI for results
const pollNCBIForResults = async (rid, maxAttempts = 60) => {
  const fetch = (await import('node-fetch')).default;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`=== POLLING ATTEMPT ${attempts}/${maxAttempts} ===`);
    console.log('RID:', rid);
    console.log('Timestamp:', new Date().toISOString());

    await enforceRateLimit();

    const pollUrl = `https://blast.ncbi.nlm.nih.gov/Blast.cgi?CMD=Get&FORMAT_TYPE=XML&RID=${rid}`;
    console.log('Polling URL:', pollUrl);

    const response = await fetch(pollUrl);

    console.log('Poll response status:', response.status, response.statusText);

    if (!response.ok) {
      console.log('❌ Poll request failed');
      throw new Error(`NCBI BLAST poll failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    console.log('Poll response length:', text.length);
    console.log('Response contains "WAITING":', text.includes('WAITING'));
    console.log('Response contains "READY":', text.includes('READY'));
    console.log('Response contains "FAILED":', text.includes('FAILED'));
    console.log('Response contains "BlastOutput":', text.includes('BlastOutput'));

    // Check specific status indicators
    if (text.includes('Status=WAITING') || text.includes('WAITING')) {
      console.log('⏳ Search still running, waiting 20 seconds...');
      await new Promise(resolve => setTimeout(resolve, 20000));
      continue;
    }

    if (text.includes('Status=FAILED') || text.includes('FAILED')) {
      console.log('❌ BLAST search failed on NCBI');
      throw new Error('BLAST search failed on NCBI servers');
    }

    if (text.includes('Status=UNKNOWN') || text.includes('UNKNOWN')) {
      console.log('❌ BLAST search expired or RID not found');
      throw new Error('BLAST search expired or RID not found');
    }

    // Check for results
    if ((text.includes('Status=READY') || text.includes('READY')) || text.includes('BlastOutput')) {
      console.log('✅ BLAST search completed!');
      console.log('Result preview (first 1000 chars):', text.substring(0, 1000));

      try {
        const results = parseXMLBlastResults(text);
        console.log('✅ Parsed results:', results.length, 'hits');
        return results;
      } catch (parseError) {
        console.error('❌ Error parsing results:', parseError);
        return [];
      }
    }

    console.log('⏳ No clear status found, waiting 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log('❌ BLAST polling timed out after', maxAttempts, 'attempts');
  throw new Error('BLAST search timeout - results not ready after maximum attempts');
};


// Enhanced BLAST search function
const performNCBIBlastSearch = async (sequence, database = 'nt', program = 'blastn') => {
  console.log(`Starting BLAST search: ${sequence.length}bp sequence against ${database}`);

  // Validate sequence
  if (!sequence || sequence.length < 10) {
    throw new Error('Sequence too short for BLAST analysis (minimum 10 bp)');
  }

  // Clean sequence
  const cleanSequence = sequence.replace(/[^ATGCNRYSWKMBDHV-]/gi, '').toUpperCase();
  if (cleanSequence.length < 10) {
    throw new Error('Invalid DNA sequence characters');
  }

  await enforceRateLimit();

  // Submit search to NCBI
  const rid = await submitBlastToNCBI(cleanSequence, database, program);
  console.log(`BLAST search submitted, RID: ${rid}`);

  // Poll for results
  const results = await pollNCBIForResults(rid);

  return results;
};

// Helper function to correctly resolve clone information for messages
async function resolveCloneInfo(messages) {
  for (let message of messages) {
    if (message.cloneId && message.clone) {
      // Check if the clone name from the foreign key relationship is wrong
      // (This happens when practice clone IDs collide with assigned clone IDs)

      // Try to find the correct clone in practice clones table
      try {
        const practiceClone = await prisma.practiceClone.findUnique({
          where: { id: message.cloneId }
        });

        if (practiceClone) {
          // This is actually a practice clone, override the relationship data
          message.clone = {
            id: practiceClone.id,
            cloneName: practiceClone.cloneName,
            originalName: practiceClone.originalName
          };
        }
        // If not found in practice clones, the original relationship data is correct
      } catch (error) {
        console.log('Error resolving practice clone for message', message.id, error.message);
        // Keep original clone data if lookup fails
      }
    }
  }
  return messages;
}


// Add these middleware functions after line 45 (after app.use(express.json());)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId }
      });

      if (!user || !roles.includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    } catch (error) {
      return res.status(500).json({ error: 'Authentication error' });
    }
  };
};

// Test S3 connection endpoint
// Enhanced S3 test endpoint with deletion test



// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

app.get('/api/progress-test', (req, res) => {
  res.json({ message: 'Progress endpoint working!' });
});

// Schools API endpoints
app.get('/api/schools', authenticateToken, async (req, res) => {
  try {

    const schools = await prisma.school.findMany();

    res.json(schools);
  } catch (error) {
    console.log('=== SCHOOLS ERROR ===', error);
    console.log('Error details:', error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Update the schools POST endpoint:
app.post('/api/schools', async (req, res) => {
  try {
    const { name, schoolId, instructor, instructorId } = req.body;

    console.log('Creating school with instructor:', instructor, 'instructorId:', instructorId);

    // Create the school first (only store name, schoolId, instructor name)
    const school = await prisma.school.create({
      data: {
        name,
        schoolId,
        instructor: instructor || 'Unassigned'
        // Note: Do NOT include instructorId here
      }
    });

    // If an instructor ID was provided, assign them to this school
    if (instructorId && instructorId !== '') {
      try {
        await prisma.user.update({
          where: {
            id: parseInt(instructorId),
            role: 'instructor'
          },
          data: { schoolId: school.id }
        });
        console.log('Assigned instructor ID', instructorId, 'to new school', school.id);
      } catch (error) {
        console.error('Error assigning instructor to new school:', error);
        // School was created successfully, just log the instructor assignment error
      }
    }

    res.json(school);
  } catch (error) {
    console.error('Error creating school:', error);
    res.status(500).json({ error: error.message });
  }
});

// In index.js, replace the schools PUT endpoint:
app.put('/api/schools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, schoolId, instructor, instructorId } = req.body; // Extract instructorId separately

    console.log('Updating school:', id, 'with instructor:', instructor, 'instructorId:', instructorId);

    // Handle instructor assignment logic
    if (instructor !== undefined) {
      const school = await prisma.school.findUnique({
        where: { id: parseInt(id) }
      });

      if (!school) {
        return res.status(404).json({ error: 'School not found' });
      }

      // Remove previous instructor's school assignment (if any)
      if (school.instructor && school.instructor !== 'Unassigned') {
        await prisma.user.updateMany({
          where: {
            name: school.instructor,
            role: 'instructor'
          },
          data: { schoolId: null }
        });
        console.log('Removed previous instructor assignment for:', school.instructor);
      }

      // Assign new instructor using ID (if provided)
      if (instructorId && instructorId !== '') {
        try {
          await prisma.user.update({
            where: {
              id: parseInt(instructorId),
              role: 'instructor'
            },
            data: { schoolId: parseInt(id) }
          });
          console.log('Assigned instructor ID', instructorId, 'to school', id);
        } catch (error) {
          console.error('Error updating instructor assignment:', error);
          // Continue with school update even if instructor assignment fails
        }
      }
    }

    // Update the school record (only store name, schoolId, instructor name)
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (schoolId !== undefined) updateData.schoolId = schoolId;
    if (instructor !== undefined) updateData.instructor = instructor;
    // Note: Do NOT include instructorId in updateData

    const school = await prisma.school.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    console.log('School updated successfully:', school);
    res.json(school);
  } catch (error) {
    console.error('Error updating school:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/schools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.school.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'School deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analysis Questions API endpoints
app.get('/api/analysis-questions', async (req, res) => {
  try {
    const questions = await prisma.analysisQuestion.findMany({
      orderBy: [
        { step: 'asc' },
        { groupOrder: 'asc' }, // NEW: Order by group first
        { order: 'asc' }       // Then by question order within group
      ]
    });

    const parsedQuestions = questions.map(q => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : undefined,
      conditionalLogic: q.conditionalLogic ? JSON.parse(q.conditionalLogic) : null
    }));

    res.json(parsedQuestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analysis-questions', async (req, res) => {
  try {
    const {
      step, text, type, options, required, order, conditionalLogic,
      questionGroup, groupOrder // NEW FIELDS
    } = req.body;

    const question = await prisma.analysisQuestion.create({
      data: {
        step,
        text,
        type,
        options: options ? JSON.stringify(options) : null,
        required,
        order,
        conditionalLogic: conditionalLogic ? JSON.stringify(conditionalLogic) : null,
        questionGroup, // NEW
        groupOrder     // NEW
      }
    });

    const parsedQuestion = {
      ...question,
      options: question.options ? JSON.parse(question.options) : undefined,
      conditionalLogic: question.conditionalLogic ? JSON.parse(question.conditionalLogic) : null
    };

    res.json(parsedQuestion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/analysis-questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      step, text, type, options, required, order, conditionalLogic,
      questionGroup, groupOrder // NEW FIELDS
    } = req.body;

    const question = await prisma.analysisQuestion.update({
      where: { id },
      data: {
        step,
        text,
        type,
        options: options ? JSON.stringify(options) : null,
        required,
        order,
        conditionalLogic: conditionalLogic ? JSON.stringify(conditionalLogic) : null,
        questionGroup, // NEW
        groupOrder     // NEW
      }
    });

    const parsedQuestion = {
      ...question,
      options: question.options ? JSON.parse(question.options) : undefined,
      conditionalLogic: question.conditionalLogic ? JSON.parse(question.conditionalLogic) : null
    };

    res.json(parsedQuestion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/analysis-questions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First, delete all common feedback entries for this question
    const deletedFeedback = await prisma.commonFeedback.deleteMany({
      where: { questionId: id }
    });

    // Then delete the question itself
    const deletedQuestion = await prisma.analysisQuestion.delete({
      where: { id }
    });

    console.log('Successfully deleted question and associated feedback');

    res.json({
      message: 'Question and associated feedback deleted successfully',
      deletedFeedbackCount: deletedFeedback.count
    });
  } catch (error) {
    console.error('Error deleting analysis question:', error);
    res.status(500).json({ error: error.message });
  }
});

// User authentication API endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role, schoolId } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        schoolId: schoolId ? parseInt(schoolId) : null
      },
      include: {
        school: true
      }
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login endpoint - UPDATED with login tracking
// Login endpoint - UPDATED with login tracking AND school relationship
app.post('/api/auth/login', async (req, res) => {
  // Move helper functions to the top so they're always available
  const cleanIPAddress = (ip) => {
    if (!ip) return null;
    const trimmedIP = ip.trim();
    if (trimmedIP.startsWith('::ffff:')) {
      return trimmedIP.substring(7);
    }
    return trimmedIP;
  };

  const getClientIP = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.ip;
  };

  const getLocationFromIP = async (ip) => {
    try {
      if (!ip || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
        return null;
      }
      const response = await fetch(`https://ipinfo.io/${ip}/json?token=${IPINFO_TOKEN}`);
      const data = await response.json();
      if (data.city && data.region && data.country) {
        return `${data.city}, ${data.region}, ${data.country}`;
      }
      return data.country || null;
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  };

  // Get IP info upfront so it's always available
  const ipAddress = cleanIPAddress(getClientIP(req));
  const userAgent = req.get('User-Agent') || null;

  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { school: true }
    });

    if (!user) {
      // Log failed attempt - user not found
      try {
        await prisma.loginLog.create({
          data: {
            userId: null, // No user found
            success: false,
            loginTime: new Date(),
            ipAddress: ipAddress,
            userAgent: userAgent,
            location: null // Don't waste API calls for failed logins
          }
        });
      } catch (logError) {
        console.error('Failed to log failed login attempt:', logError);
      }
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check user status
    if (user.role !== 'director') {
      if (user.status === 'pending') {
        // Log failed attempt - pending user
        try {
          await prisma.loginLog.create({
            data: {
              userId: user.id,
              success: false,
              loginTime: new Date(),
              ipAddress: ipAddress,
              userAgent: userAgent,
              location: null
            }
          });
        } catch (logError) {
          console.error('Failed to log failed login attempt:', logError);
        }
        return res.status(403).json({ error: 'Account pending approval. Please contact your administrator.' });
      } else if (user.status === 'rejected') {
        // Log failed attempt - rejected user
        try {
          await prisma.loginLog.create({
            data: {
              userId: user.id,
              success: false,
              loginTime: new Date(),
              ipAddress: ipAddress,
              userAgent: userAgent,
              location: null
            }
          });
        } catch (logError) {
          console.error('Failed to log failed login attempt:', logError);
        }
        return res.status(403).json({ error: 'Account access denied. Please contact your administrator.' });
      }
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      // Log failed attempt - wrong password
      try {
        await prisma.loginLog.create({
          data: {
            userId: user.id,
            success: false,
            loginTime: new Date(),
            ipAddress: ipAddress,
            userAgent: userAgent,
            location: null
          }
        });
      } catch (logError) {
        console.error('Failed to log failed login attempt:', logError);
      }
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // SUCCESS - Get location and log successful login
    const location = await getLocationFromIP(ipAddress);

    try {
      await prisma.loginLog.create({
        data: {
          userId: user.id,
          success: true,
          loginTime: new Date(),
          ipAddress: ipAddress,
          userAgent: userAgent,
          location: location
        }
      });
    } catch (logError) {
      console.error('Failed to log successful login:', logError);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', error);

    // Log unexpected error (this is your original catch block approach)
    try {
      await prisma.loginLog.create({
        data: {
          userId: null, // We don't know which user since there was an unexpected error
          success: false,
          loginTime: new Date(),
          ipAddress: ipAddress,
          userAgent: userAgent,
          location: null
        }
      });
    } catch (logError) {
      console.error('Failed to log error login attempt:', logError);
    }

    res.status(500).json({ error: 'Login failed' });
  }
});

// Get login logs - Directors can see all, others see only their own
app.get('/api/login-logs', authenticateToken, async (req, res) => {
  try {
    const { userId, limit = 50, page = 1, startDate, endDate } = req.query;
    const userFromToken = await prisma.user.findUnique({ where: { id: req.user.userId } });

    if (!userFromToken) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build where clause
    let whereClause = {};

    // Access control: Directors can see all logs, others only their own
    if (userFromToken.role === 'director') {
      // Directors can filter by specific userId if provided
      if (userId) {
        whereClause.userId = parseInt(userId);
      }
    } else {
      // Non-directors can only see their own logs
      whereClause.userId = req.user.userId;
    }

    // Date filtering
    if (startDate || endDate) {
      whereClause.loginTime = {};
      if (startDate) {
        whereClause.loginTime.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.loginTime.lte = new Date(endDate);
      }
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get logs with user information
    const logs = await prisma.loginLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            school: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { loginTime: 'desc' },
      take: parseInt(limit),
      skip: offset
    });

    // Get total count for pagination
    const totalCount = await prisma.loginLog.count({ where: whereClause });

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching login logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get login logs for a specific user (Directors only)
app.get('/api/login-logs/user/:userId', authenticateToken, requireRole(['director']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;

    const logs = await prisma.loginLog.findMany({
      where: { userId: parseInt(userId) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            school: { select: { name: true } }
          }
        }
      },
      orderBy: { loginTime: 'desc' },
      take: parseInt(limit)
    });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching user login logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get login statistics (Directors only)
app.get('/api/login-stats', authenticateToken, requireRole(['director']), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Recent logins count
    const recentLogins = await prisma.loginLog.count({
      where: {
        loginTime: { gte: startDate }
      }
    });

    // Active users (users who logged in recently)
    const activeUsers = await prisma.loginLog.groupBy({
      by: ['userId'],
      where: {
        loginTime: { gte: startDate }
      },
      _count: true
    });

    // Login activity by role
    const loginsByRole = await prisma.loginLog.groupBy({
      by: ['userId'],
      include: {
        user: {
          select: { role: true }
        }
      },
      where: {
        loginTime: { gte: startDate }
      }
    });

    // Get user roles for aggregation
    const userRoles = await prisma.user.findMany({
      where: {
        id: { in: loginsByRole.map(log => log.userId) }
      },
      select: { id: true, role: true }
    });

    const roleStats = userRoles.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    // Daily login counts for the chart data
    const dailyLogins = await prisma.$queryRaw`
      SELECT 
        DATE(loginTime) as date,
        COUNT(*) as count
      FROM LoginLog 
      WHERE loginTime >= ${startDate.toISOString()}
      GROUP BY DATE(loginTime)
      ORDER BY date
    `;

    res.json({
      period: `${days} days`,
      totalLogins: recentLogins,
      uniqueActiveUsers: activeUsers.length,
      loginsByRole: roleStats,
      dailyActivity: dailyLogins
    });
  } catch (error) {
    console.error('Error fetching login stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get last login for users (useful for user management)
app.get('/api/users/last-login', authenticateToken, requireRole(['director']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: { in: ['instructor', 'student'] }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        school: { select: { name: true } },
        loginLogs: {
          orderBy: { loginTime: 'desc' },
          take: 1,
          select: { loginTime: true }
        }
      }
    });

    const usersWithLastLogin = users.map(user => ({
      ...user,
      lastLogin: user.loginLogs[0]?.loginTime || null,
      loginLogs: undefined // Remove the nested array
    }));

    res.json(usersWithLastLogin);
  } catch (error) {
    console.error('Error fetching users with last login:', error);
    res.status(500).json({ error: error.message });
  }
});

// =========================
// Login screen stats
// =========================
// Get platform statistics for login screen
app.get('/api/platform-stats', async (req, res) => {
  try {
    // Count total schools
    const schoolCount = await prisma.school.count();

    // Count approved students
    const studentCount = await prisma.user.count({
      where: {
        role: 'student',
        status: 'approved'
      }
    });

    // Count research clones that have been submitted to NCBI
    const ncbiSubmissionCount = await prisma.uploadedFile.count({
      where: {
        status: CLONE_STATUSES.SUBMITTED_TO_NCBI  // Using your imported constant
      }
    });

    res.json({
      schools: schoolCount,
      students: studentCount,
      ncbiSubmissions: ncbiSubmissionCount
    });
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// =========================
// Profile Picture endpoints
// =========================

// Debug
app.use('/api/users/:userId/profile-picture', (req, res, next) => {
  console.log('=== PROFILE PICTURE REQUEST ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Params:', req.params);
  console.log('Headers:', req.headers);
  next();
});

// Profile picture upload configuration
const profilePictureUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const profilePicsDir = path.join(__dirname, 'uploads', 'profile-pics');
      if (!fs.existsSync(profilePicsDir)) {
        fs.mkdirSync(profilePicsDir, { recursive: true });
      }
      cb(null, profilePicsDir);
    },
    filename: function (req, file, cb) {
      const userId = req.params.userId;
      const extension = file.originalname.split('.').pop();
      const filename = `user-${userId}.${extension}`;
      cb(null, filename);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Upload profile picture endpoint
app.post('/api/users/:userId/profile-picture', profilePictureUpload.single('profilePicture'), async (req, res) => {
  try {
    const { userId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    // Create URL for the uploaded file
    const profilePictureUrl = `/uploads/profile-pics/${req.file.filename}`;

    // Update user with new profile picture URL
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { profilePicture: profilePictureUrl },
      include: {
        school: { select: { name: true, id: true } }
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete profile picture endpoint
app.delete('/api/users/:userId/profile-picture', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) }
    });

    if (user?.profilePicture) {
      // Delete local file
      const filename = path.basename(user.profilePicture);
      const filePath = path.join(__dirname, 'uploads', 'profile-pics', filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Deleted profile picture file:', filePath);
      }
    }

    // Update user to remove profile picture
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { profilePicture: null },
      include: {
        school: { select: { name: true } }
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error deleting profile picture:', error);
    res.status(500).json({ error: error.message });
  }
});

// =========================
// CLONE ACTIVITY LOGGING
// =========================

// Log clone activity (start/stop)
app.post('/api/clone-activity-log', authenticateToken, async (req, res) => {
  try {
    const { cloneName, cloneType, cloneId, action, currentStep, progress } = req.body;
    const userId = req.user.userId;

    // Validate action
    if (!['start', 'stop'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "start" or "stop"' });
    }

    // Validate cloneType
    if (!['practice', 'research'].includes(cloneType)) {
      return res.status(400).json({ error: 'Clone type must be "practice" or "research"' });
    }

    const activityLog = await prisma.cloneActivityLog.create({
      data: {
        userId,
        cloneName,
        cloneType,
        cloneId: cloneId ? parseInt(cloneId) : null,
        action,
        currentStep,
        progress
      }
    });

    res.json(activityLog);
  } catch (error) {
    console.error('Error logging clone activity:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get clone activity logs for a user (Directors can see all, users see only their own)
app.get('/api/clone-activity-logs', authenticateToken, async (req, res) => {
  try {
    const { userId, limit = 50, cloneType } = req.query;
    const userFromToken = await prisma.user.findUnique({ where: { id: req.user.userId } });

    if (!userFromToken) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build where clause
    let whereClause = {};

    // Access control: Directors can see all logs, others only their own
    if (userFromToken.role === 'director' && userId) {
      whereClause.userId = parseInt(userId);
    } else {
      whereClause.userId = req.user.userId;
    }

    // Filter by clone type if specified
    if (cloneType) {
      whereClause.cloneType = cloneType;
    }

    const logs = await prisma.cloneActivityLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            school: { select: { name: true } }
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit)
    });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching clone activity logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get clone activity statistics (Directors only)
app.get('/api/clone-activity-stats', authenticateToken, requireRole(['director']), async (req, res) => {
  try {
    const { days = 30, userId } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    let whereClause = {
      timestamp: { gte: startDate }
    };

    if (userId) {
      whereClause.userId = parseInt(userId);
    }

    // Total sessions (count of 'start' actions)
    const totalSessions = await prisma.cloneActivityLog.count({
      where: { ...whereClause, action: 'start' }
    });

    // Activity by clone type
    const activityByType = await prisma.cloneActivityLog.groupBy({
      by: ['cloneType'],
      where: whereClause,
      _count: true
    });

    // Most active clones
    const popularClones = await prisma.cloneActivityLog.groupBy({
      by: ['cloneName', 'cloneType'],
      where: whereClause,
      _count: true,
      orderBy: { _count: { _all: 'desc' } },
      take: 10
    });

    res.json({
      totalSessions,
      activityByType,
      popularClones
    });

  } catch (error) {
    console.error('Error fetching clone activity stats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/clone-activity-logs/user/:userId', authenticateToken, requireRole(['director']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 30 } = req.query;

    const logs = await prisma.cloneActivityLog.findMany({
      where: { userId: parseInt(userId) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            school: { select: { name: true } }
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit)
    });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching clone activity logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// In index.js, update the GET /api/users endpoint:
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const { role, status, schoolId } = req.query; // ✅ Add schoolId parameter

    const whereClause = {};

    // Filter by role if specified
    if (role) {
      whereClause.role = role;
    }

    // Filter by status if specified
    if (status) {
      whereClause.status = status;
    } else if (role) {
      // If filtering by role but no status specified, only show approved users
      // This is useful when fetching instructors for school assignment
      whereClause.status = 'approved';
    }

    if (schoolId) {
      whereClause.schoolId = parseInt(schoolId);
    }

    //console.log('Users endpoint - whereClause:', whereClause); // Debug logging

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        school: true
      },
      orderBy: [
        { role: 'asc' },
        { name: 'asc' }
      ]
    });

    // Remove passwords from response
    const usersWithoutPasswords = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    //console.log(`Found ${usersWithoutPasswords.length} users matching criteria`); // Debug logging

    res.json(usersWithoutPasswords);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User Management endpoints (for Directors)
app.post('/api/users', async (req, res) => {
  try {
    const { email, password, name, role, schoolId } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        schoolId: schoolId ? parseInt(schoolId) : null
      },
      include: {
        school: true
      }
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, name, role, schoolId, password, status } = req.body;

    const updateData = {};

    // Only update fields that are provided
    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    if (schoolId !== undefined) updateData.schoolId = schoolId ? parseInt(schoolId) : null;

    // Only update password if provided and not empty
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        school: true
      }
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.user.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// =========================
// Clone Library API endpoints
// =========================

// Simple function to use filename as clone name
function generateCloneName(filename) {
  return filename.replace(/\.ab1$/i, '');
}

// Get all uploaded files
app.get('/api/uploaded-files', authenticateToken, async (req, res) => {
  try {
    const { reviewReady, schoolId, schoolName, includeTeacherReviewed } = req.query;

    /**
    console.log('=== UPLOADED FILES QUERY DEBUG ===');
    console.log('reviewReady:', reviewReady);
    console.log('includeTeacherReviewed:', includeTeacherReviewed);
    console.log('schoolName:', schoolName);
    */


    let whereClause = {};

    // Build school filtering first
    let assignedToClause = {};
    if (schoolId) {
      assignedToClause.school = { id: parseInt(schoolId) };
    } else if (schoolName) {
      assignedToClause.school = { name: schoolName };
    }

    // Build complete where clause
    if (reviewReady === 'true') {
      const reviewStatuses = [
        CLONE_STATUSES.COMPLETED_WAITING_REVIEW,
        CLONE_STATUSES.CORRECTED_WAITING_REVIEW
      ];

      // Only include teacher-reviewed items for directors
      if (includeTeacherReviewed === 'true') {
        reviewStatuses.push(CLONE_STATUSES.REVIEWED_BY_TEACHER);
        //console.log('✅ Including REVIEWED_BY_TEACHER status for directors');
      } else {
        console.log('❌ NOT including REVIEWED_BY_TEACHER status (instructor view)');
      }

      //console.log('Review statuses being searched:', reviewStatuses);

      whereClause = {
        AND: [
          { assignedToId: { not: null } },
          { analysisData: { not: null } },
          {
            status: {
              in: reviewStatuses
            }
          },
          ...(Object.keys(assignedToClause).length > 0 ?
            [{ assignedTo: assignedToClause }] : [])
        ]
      };
    } else {
      // For non-reviewReady requests, just apply school filtering if present
      if (Object.keys(assignedToClause).length > 0) {
        whereClause.assignedTo = assignedToClause;
      }
    }

    //console.log('Final whereClause:', JSON.stringify(whereClause, null, 2));

    const files = await prisma.uploadedFile.findMany({
      where: whereClause,
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            school: { select: { id: true, name: true } }
          }
        },
        uploadedBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    //console.log('Found files:', files.length);
    //console.log('Files with status REVIEWED_BY_TEACHER:', files.filter(f => f.status === CLONE_STATUSES.REVIEWED_BY_TEACHER).length);

    res.json(files);
  } catch (error) {
    console.error('Error in uploaded-files endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload new files
app.post('/api/uploaded-files', upload.array('files'), async (req, res) => {
  try {
    const { uploadedById } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];

      // Use filename as clone name
      const cloneName = generateCloneName(file.originalname);

      const uploadedFile = await prisma.uploadedFile.create({
        data: {
          filename: file.filename, // LOCAL filename (not file.key)
          originalName: file.originalname,
          cloneName: cloneName,
          size: (file.size / 1024).toFixed(1) + ' KB',
          uploadDate: new Date().toISOString().split('T')[0],
          uploadedById: parseInt(uploadedById)
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              school: { select: { name: true } }
            }
          },
          uploadedBy: {
            select: { id: true, name: true }
          }
        }
      });

      uploadedFiles.push(uploadedFile);
    }

    res.json(uploadedFiles);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Assign file to student
// OLD CODE - Find and replace this entire section
app.put('/api/uploaded-files/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedToId } = req.body;

    const updatedFile = await prisma.uploadedFile.update({
      where: { id: parseInt(id) },
      data: {
        assignedToId: assignedToId ? parseInt(assignedToId) : null,
        status: assignedToId ? CLONE_STATUSES.BEING_WORKED_ON : CLONE_STATUSES.UNASSIGNED,
        progress: assignedToId ? 0 : 0
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            school: { select: { name: true } }
          }
        },
        uploadedBy: {
          select: { id: true, name: true }
        }
      }
    });

    res.json(updatedFile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update file status
app.put('/api/uploaded-files/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!isValidStatus(status)) {
      console.warn('Invalid status provided:', status);
      return res.status(400).json({
        error: 'Invalid status provided',
        validStatuses: Object.values(CLONE_STATUSES)
      });
    }

    // Get current file to check status transition
    const currentFile = await prisma.uploadedFile.findUnique({
      where: { id: parseInt(id) }
    });

    if (!currentFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get the user making the request
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    // Directors can override any status - skip validation for them
    const isDirector = user && user.role === 'director';

    // Validate status transition (skip for directors)
    if (!isDirector && !isValidStatusTransition(currentFile.status, status)) {
      console.warn(`Invalid status transition from "${currentFile.status}" to "${status}"`);
      return res.status(400).json({
        error: `Cannot change status from "${currentFile.status}" to "${status}"`,
        currentStatus: currentFile.status,
        requestedStatus: status
      });
    }

    const updatedFile = await prisma.uploadedFile.update({
      where: { id: parseInt(id) },
      data: { status },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            school: { select: { name: true } }
          }
        },
        uploadedBy: {
          select: { id: true, name: true }
        }
      }
    });

    res.json(updatedFile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NCBI Submission endpoint
const { processNCBISubmission, cleanupWorkDir } = require('./ncbiSubmission.js');
app.post('/api/ncbi/submit', authenticateToken, requireRole(['director']), async (req, res) => {
  try {
    const { fileIds, submitterInfo } = req.body;

    if (!fileIds || fileIds.length === 0) {
      return res.status(400).json({ error: 'No files selected for submission' });
    }

    // Fetch analysis questions
    const analysisQuestions = await prisma.analysisQuestion.findMany({
      orderBy: { order: 'asc' }
    });

    // Fetch the files with their analysis data
    const files = await prisma.uploadedFile.findMany({
      where: {
        id: { in: fileIds },
        status: CLONE_STATUSES.TO_BE_SUBMITTED_NCBI
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            school: { select: { name: true } }
          }
        }
      }
    });

    if (files.length === 0) {
      return res.status(400).json({ error: 'No valid files found for submission' });
    }

    // Helper function to extract clean sequence
    const getCleanSequence = (answers, questions) => {
      const editingQuestions = questions.filter(q =>
        q.step === 'clone-editing' && q.type === 'dna_sequence'
      );

      for (const question of editingQuestions) {
        const answer = answers[question.id];
        if (answer && typeof answer === 'string') {
          const cleanSequence = answer.replace(/\s/g, '').toUpperCase();
          // Only accept pure ATGC sequences
          if (/^[ATGC]+$/.test(cleanSequence) && cleanSequence.length > 50) {
            return cleanSequence;
          }
        }
      }
      return null;
    };

    // Prepare sequences for submission
    const sequences = [];
    const failed = [];

    for (const file of files) {
      let analysisData = {};
      try {
        analysisData = JSON.parse(file.analysisData || '{}');
      } catch (e) {
        console.error(`Failed to parse analysis data for file ${file.id}`);
      }

      const sequence = getCleanSequence(
        analysisData.answers || {},
        analysisQuestions
      );

      if (!sequence) {
        failed.push({
          fileId: file.id,
          filename: file.filename,
          error: 'No clean NCBI-ready sequence found (must contain only A, T, G, C)'
        });
        continue;
      }

      sequences.push({
        id: file.cloneName,
        cloneName: file.cloneName,
        sequence: sequence,
        organism: submitterInfo.organism,
        isolationSource: submitterInfo.isolationSource,
        collectionDate: submitterInfo.collectionDate,
        country: submitterInfo.country,
        cloneLibrary: submitterInfo.libraryName,
        clone: file.cloneName,
        fileId: file.id,
        filename: file.filename,
        student: file.assignedTo
      });
    }

    if (sequences.length === 0) {
      return res.status(400).json({
        error: 'No valid sequences to submit',
        failed
      });
    }

    // Parse submitter name into parts
    const nameParts = submitterInfo.submitterName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];
    const initials = nameParts.map(n => n[0]).join('.');

    const submitter = {
      firstName,
      lastName,
      initials,
      email: submitterInfo.submitterEmail,
      institution: submitterInfo.submitterInstitution,
      city: submitterInfo.city || '',
      state: submitterInfo.state || '',
      country: submitterInfo.country || 'USA',
      postalCode: submitterInfo.postalCode || ''
    };

    // Process submission with tbl2asn
    const result = await processNCBISubmission(sequences, submitter);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        details: result.details,
        validation: result.validation
      });
    }

    // If there are validation errors, return them
    if (result.validation.errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        validation: result.validation,
        message: 'Sequences failed NCBI validation. Please review errors and correct issues.'
      });
    }

    // Update database records
    const successful = [];
    for (const seq of sequences) {
      try {
        const file = files.find(f => f.id === seq.fileId);
        const analysisData = JSON.parse(file.analysisData || '{}');

        await prisma.uploadedFile.update({
          where: { id: seq.fileId },
          data: {
            status: CLONE_STATUSES.SUBMITTED_TO_NCBI,
            analysisData: JSON.stringify({
              ...analysisData,
              ncbiSubmission: {
                submittedAt: new Date().toISOString(),
                submitter: submitterInfo.submitterName,
                organism: submitterInfo.organism,
                sequenceLength: seq.sequence.length,
                sqnGenerated: true,
                validationWarnings: result.validation.warnings
              }
            })
          }
        });

        successful.push(seq.fileId);
      } catch (error) {
        console.error(`Error updating file ${seq.fileId}:`, error);
        failed.push({
          fileId: seq.fileId,
          filename: seq.filename,
          error: 'Database update failed'
        });
      }
    }

    // Store the .sqn file for later submission
    const sqnFilename = `ncbi_${Date.now()}.sqn`;
    const sqnPath = path.join(__dirname, 'submissions', sqnFilename);
    await fsPromises.mkdir(path.dirname(sqnPath), { recursive: true });
    await fsPromises.writeFile(sqnPath, result.sqnFile);

    // Clean up temporary files
    if (result.workDir) {
      setTimeout(() => cleanupWorkDir(result.workDir), 60000); // Cleanup after 1 minute
    }

    res.json({
      success: true,
      successful,
      failed,
      sqnFilename,
      validation: result.validation,
      message: `Successfully generated submission file for ${successful.length} sequences. ${result.validation.warnings.length > 0 ? `${result.validation.warnings.length} warnings present.` : 'No validation issues.'}`
    });

  } catch (error) {
    console.error('NCBI submission error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download generated .sqn file
app.get('/api/ncbi/download/:filename', authenticateToken, requireRole(['director']), async (req, res) => {
  console.log('=== NCBI DOWNLOAD ENDPOINT HIT ===');
  console.log('Filename requested:', req.params.filename);
  
  try {
    const { filename } = req.params;
    const sqnPath = path.join(__dirname, 'submissions', filename);
    
    console.log('Full path:', sqnPath);
    
    // Check if file exists
    const exists = await fsPromises.access(sqnPath).then(() => true).catch(() => false);
    console.log('File exists?', exists);
    
    if (!exists) {
      console.log('File not found, returning 404');
      return res.status(404).json({ error: 'File not found' });
    }

    console.log('Attempting download...');
    res.download(sqnPath);
  } catch (error) {
    console.error('DOWNLOAD ENDPOINT ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/uploaded-files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, analysisData, progress, ...otherUpdates } = req.body;


    const updateData = {
      ...otherUpdates,
      updatedAt: new Date()
    };

    if (status !== undefined) updateData.status = status;
    if (analysisData !== undefined) updateData.analysisData = analysisData;
    if (progress !== undefined) updateData.progress = parseInt(progress) || 0;

    const updatedFile = await prisma.uploadedFile.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            school: { select: { name: true } }
          }
        },
        uploadedBy: {
          select: { id: true, name: true }
        }
      }
    });

    console.log('File updated successfully');
    res.json(updatedFile);
  } catch (error) {
    console.error('Error updating file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download file
// UPDATE the download endpoint to use local file download:
app.get('/api/uploaded-files/:id/download', async (req, res) => {
  try {
    const { id } = req.params;

    const file = await prisma.uploadedFile.findUnique({
      where: { id: parseInt(id) }
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(__dirname, 'uploads', file.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete file

// UPDATE the delete endpoint to use local file deletion:
app.delete('/api/uploaded-files/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const fileToDelete = await prisma.uploadedFile.findUnique({
      where: { id: parseInt(id) },
      include: {
        assignedTo: {
          select: { id: true, name: true }
        }
      }
    });

    if (!fileToDelete) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (fileToDelete.assignedTo) {
      return res.status(400).json({
        error: 'Cannot delete file assigned to a student',
        assignedTo: fileToDelete.assignedTo.name
      });
    }

    console.log('=== DELETING FILE FROM LOCAL STORAGE AND DATABASE ===');
    console.log('File ID:', id);
    console.log('Filename:', fileToDelete.filename);
    console.log('Clone Name:', fileToDelete.cloneName);

    // Delete from local storage first
    try {
      const filePath = path.join(__dirname, 'uploads', fileToDelete.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Successfully deleted file from local storage:', fileToDelete.filename);
      }
    } catch (localError) {
      console.error('Error deleting from local storage (continuing with database deletion):', localError);
    }

    // Continue with database deletion...
    await prisma.uploadedFile.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      message: 'File deleted successfully',
      deletedFile: fileToDelete.cloneName
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message });
  }
});

// =========================
// Student Progress API endpoints
// =========================

// Save student progress and answers - WITH DETAILED DEBUGGING
app.put('/api/uploaded-files/:id/progress', validateStatusMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { progress, answers, currentStep, status, reviewComments, reviewScore, lastReviewed, submittedAt } = req.body;


    // Validate status if provided
    if (status && !isValidStatus(status)) {
      console.warn('Invalid status provided:', status);
      return res.status(400).json({
        error: 'Invalid status provided',
        validStatuses: Object.values(CLONE_STATUSES)
      });
    }

    // Get current file to check status transition
    const currentFile = await prisma.uploadedFile.findUnique({
      where: { id: parseInt(id) }
    });

    if (!currentFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Validate status transition if status is being changed
    if (status && status !== currentFile.status && !isValidStatusTransition(currentFile.status, status)) {
      console.warn(`Invalid status transition from "${currentFile.status}" to "${status}"`);
      return res.status(400).json({
        error: `Cannot change status from "${currentFile.status}" to "${status}"`,
        currentStatus: currentFile.status,
        requestedStatus: status
      });
    }


    // Check if file exists first
    const existingFile = await prisma.uploadedFile.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingFile) {
      console.log('File not found with ID:', id);
      return res.status(404).json({ error: 'File not found' });
    }

    // Parse existing analysis data to preserve any data not being updated
    let existingAnalysisData = {};
    if (existingFile.analysisData) {
      try {
        existingAnalysisData = JSON.parse(existingFile.analysisData);
      } catch (error) {
        console.error('Error parsing existing analysis data:', error);
      }
    }

    // Determine status
    // Determine status
    let newStatus = CLONE_STATUSES.BEING_WORKED_ON;
    if (progress >= 100) {
      newStatus = CLONE_STATUSES.COMPLETED_WAITING_REVIEW;
    } else if (progress > 0) {
      newStatus = CLONE_STATUSES.BEING_WORKED_ON;
    }

    if (status) {
      newStatus = status;
    }

    console.log('New status will be:', newStatus);

    // CRITICAL: Merge existing data with new data, preserving review information
    const updatedAnalysisData = {
      ...existingAnalysisData, // Keep all existing data as base
      answers: answers || existingAnalysisData.answers || {},
      currentStep: currentStep || existingAnalysisData.currentStep || 'clone-editing',
      lastSaved: new Date().toISOString(),
      // Preserve review data - use what's sent, or keep existing
      reviewComments: reviewComments !== undefined ? reviewComments : existingAnalysisData.reviewComments || [],
      reviewScore: reviewScore !== undefined ? reviewScore : existingAnalysisData.reviewScore,
      lastReviewed: lastReviewed !== undefined ? lastReviewed : existingAnalysisData.lastReviewed,
      reviewedBy: existingAnalysisData.reviewedBy, // Always preserve this
      submittedAt: submittedAt || existingAnalysisData.submittedAt
    };

    const analysisDataString = JSON.stringify(updatedAnalysisData);

    //console.log('Final analysis data being saved:', updatedAnalysisData);
    //console.log('Review comments being preserved:', updatedAnalysisData.reviewComments?.length || 0);

    // Update the file
    const updatedFile = await prisma.uploadedFile.update({
      where: { id: parseInt(id) },
      data: {
        progress: parseInt(progress) || 0,
        status: newStatus,
        analysisData: analysisDataString
      }
    });

    console.log('Database update successful! Review comments preserved.');

    res.json(updatedFile);
  } catch (error) {
    console.error('=== ERROR SAVING PROGRESS ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get student progress and answers
app.get('/api/uploaded-files/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;

    const file = await prisma.uploadedFile.findUnique({
      where: { id: parseInt(id) }
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    let analysisData = {
      answers: {},
      currentStep: 'clone-editing',
      lastSaved: null,
      reviewComments: [], // Include empty array by default
      reviewScore: null,
      lastReviewed: null
    };

    if (file.analysisData) {
      try {
        const parsedData = JSON.parse(file.analysisData);
        analysisData = { ...analysisData, ...parsedData };
      } catch (error) {
        console.error('Error parsing analysis data:', error);
      }
    }

    res.json({
      id: file.id,
      progress: file.progress,
      status: file.status,
      analysisData: file.analysisData, // Keep raw data for frontend parsing
      ...analysisData // Spread parsed data for backward compatibility
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all student progress (for instructors/directors)
app.get('/api/student-progress', async (req, res) => {
  try {
    const files = await prisma.uploadedFile.findMany({
      where: {
        assignedToId: { not: null }
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            school: { select: { name: true } }
          }
        }
      },
      orderBy: [
        { progress: 'desc' },
        { updatedAt: 'desc' }
      ]
    });

    // Parse analysis data for each file
    const filesWithProgress = files.map(file => {
      let analysisData = {
        answers: {},
        currentStep: 'clone-editing',
        lastSaved: null
      };

      if (file.analysisData) {
        try {
          analysisData = JSON.parse(file.analysisData);
        } catch (error) {
          console.error('Error parsing analysis data for file', file.id, error);
        }
      }

      return {
        ...file,
        ...analysisData
      };
    });

    res.json(filesWithProgress);
  } catch (error) {
    console.error('Error fetching student progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// =========================
// Message API endpoints - CONSOLIDATED VERSION (no duplicates)
// =========================


// Check if a discussion already exists for a specific clone and student
app.get('/api/messages/check-discussion/:studentId/:cloneId', async (req, res) => {
  try {
    const { studentId, cloneId } = req.params;

    /*
    console.log('=== CHECK EXISTING DISCUSSION ENDPOINT HIT ===');
    console.log('Student ID:', studentId);
    console.log('Clone ID:', cloneId);
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    console.log('Request headers:', req.headers);
    */

    // Validate input parameters
    if (!studentId || isNaN(parseInt(studentId))) {
      console.log('Invalid studentId:', studentId);
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    if (!cloneId || isNaN(parseInt(cloneId))) {
      console.log('Invalid cloneId:', cloneId);
      return res.status(400).json({ error: 'Invalid clone ID' });
    }

    // Build where clause to find messages between student and directors for this clone
    const whereClause = {
      cloneId: parseInt(cloneId),
      OR: [
        { senderId: parseInt(studentId) }, // Messages sent by student
        { recipientId: parseInt(studentId) } // Messages sent to student
      ]
    };

    //console.log('Database query where clause:', whereClause);

    // Check if any messages exist for this clone-student combination
    const existingMessages = await prisma.message.findMany({
      where: whereClause,
      include: {
        sender: {
          select: { id: true, name: true, role: true }
        },
        recipient: {
          select: { id: true, name: true, role: true }
        },
        clone: {
          select: { id: true, cloneName: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    //console.log('Raw database query returned:', existingMessages.length, 'messages');

    // FIXED: Resolve correct clone names but handle empty arrays properly
    let resolvedMessages = [];
    if (existingMessages.length > 0) {
      try {
        resolvedMessages = await resolveCloneInfo(existingMessages);
        console.log('Resolved messages successfully');
      } catch (resolveError) {
        console.error('Error in resolveCloneInfo:', resolveError);
        // Use original messages if resolve fails
        resolvedMessages = existingMessages;
      }
    }

    const discussionExists = resolvedMessages.length > 0;
    //console.log('Discussion exists:', discussionExists);

    if (discussionExists) {
      const firstMessage = resolvedMessages[0];
      const lastMessage = resolvedMessages[resolvedMessages.length - 1];

      // Count unread messages for this student
      const unreadCount = resolvedMessages.filter(msg =>
        !msg.isRead && msg.recipientId === parseInt(studentId)
      ).length;

      // FIXED: Handle clone name properly
      let cloneName = 'Unknown Clone';
      if (firstMessage.clone && firstMessage.clone.cloneName) {
        cloneName = firstMessage.clone.cloneName;
      } else if (lastMessage.clone && lastMessage.clone.cloneName) {
        cloneName = lastMessage.clone.cloneName;
      }

      // FIXED: Handle content length check properly
      let lastMessagePreview = '';
      if (lastMessage && lastMessage.content) {
        lastMessagePreview = lastMessage.content.length > 100
          ? lastMessage.content.substring(0, 100) + '...'
          : lastMessage.content;
      }

      const response = {
        exists: true,
        messageCount: resolvedMessages.length,
        unreadCount: unreadCount,
        firstMessageDate: firstMessage.createdAt,
        lastMessageDate: lastMessage.createdAt,
        cloneName: cloneName,
        lastMessagePreview: lastMessagePreview
      };

      console.log('Sending positive response:', response);
      res.json(response);
    } else {
      const response = { exists: false };
      console.log('Sending negative response:', response);
      res.json(response);
    }

  } catch (error) {
    console.error('=== ERROR IN CHECK DISCUSSION ENDPOINT ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', error);

    // CRITICAL: Always return JSON, never let the error bubble up as HTML
    res.status(500).json({
      error: 'Internal server error while checking discussion',
      details: error.message,
      exists: false // Fallback value
    });
  }
});



// Send message to directors (for students asking for help) - UPDATED FOR GROUP MESSAGING
app.post('/api/messages/support', async (req, res) => {
  try {
    const { senderId, cloneId, cloneType, cloneProgress, currentStep, subject, content } = req.body;

    /*
    console.log('=== MESSAGE SUPPORT DEBUG ===');
    console.log('Request body:', req.body);
    console.log('Sender ID:', senderId, 'Type:', typeof senderId);
    console.log('Subject:', subject, 'Type:', typeof subject);
    console.log('Content:', content, 'Type:', typeof content);
    console.log('Clone ID:', cloneId, 'Type:', typeof cloneId);
    console.log('Clone Progress:', cloneProgress, 'Type:', typeof cloneProgress);
    console.log('Current Step:', currentStep, 'Type:', typeof currentStep);
    */


    // Validate required fields
    if (!senderId || senderId === undefined || senderId === null) {
      console.log('ERROR: senderId is invalid:', senderId);
      return res.status(400).json({ error: 'Sender ID is required and must be valid' });
    }

    if (!subject || subject.trim() === '') {
      console.log('ERROR: subject is invalid:', subject);
      return res.status(400).json({ error: 'Subject is required and cannot be empty' });
    }

    if (!content || content.trim() === '') {
      console.log('ERROR: content is invalid:', content);
      return res.status(400).json({ error: 'Message content is required and cannot be empty' });
    }

    // Get all directors
    const directors = await prisma.user.findMany({
      where: {
        role: 'director',
        status: 'approved'
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    //console.log(`Found ${directors.length} directors:`, directors.map(d => d.name));

    if (directors.length === 0) {
      console.log('ERROR: No directors found');
      return res.status(500).json({ error: 'No directors available to receive messages' });
    }

    // Get clone information if cloneId provided
    let clone = null;
    if (cloneId && !isNaN(parseInt(cloneId))) {
      //console.log('Fetching clone information for ID:', cloneId);

      try {
        if (cloneType === 'practice') {
          // Look in practice clones table
          const practiceClone = await prisma.practiceClone.findUnique({
            where: { id: parseInt(cloneId) }
          });

          if (practiceClone) {
            clone = {
              id: practiceClone.id,
              cloneName: practiceClone.cloneName,
              originalName: practiceClone.originalName,
              filename: practiceClone.filename,
              type: 'practice'
            };
            //console.log('Found practice clone:', clone.cloneName);
          }
        } else {
          // Look in uploaded files table (assigned clones)
          clone = await prisma.uploadedFile.findUnique({
            where: { id: parseInt(cloneId) },
            include: {
              assignedTo: {
                select: { name: true, email: true, school: { select: { name: true } } }
              }
            }
          });

          if (clone) {
            //console.log('Found assigned clone:', clone.cloneName);
          }
        }

        if (!clone) {
          console.log('Clone not found with ID:', cloneId, 'Type:', cloneType);
        }
      } catch (cloneError) {
        console.log('Error fetching clone:', cloneError.message);
      }
    }

    // FIXED: Create separate message records for each director
    const directorIds = directors.map(d => d.id);
    //console.log('Creating group messages for all directors:', directorIds);

    const groupMessages = [];
    for (const directorId of directorIds) {
      const groupMessage = await prisma.message.create({
        data: {
          subject: subject.trim(),
          content: content.trim(),
          messageType: 'group_support',
          senderId: parseInt(senderId),
          recipientId: directorId, // Each director gets their own message record
          isGroupMessage: true,
          groupParticipants: JSON.stringify([parseInt(senderId), ...directorIds]),
          ...(cloneId && !isNaN(parseInt(cloneId)) ? { cloneId: parseInt(cloneId) } : {}),
          ...(cloneProgress !== undefined && cloneProgress !== null ? { cloneProgress: parseInt(cloneProgress) } : {}),
          ...(currentStep && currentStep.trim() !== '' ? { currentStep: currentStep.trim() } : {})
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              school: { select: { name: true } }
            }
          },
          recipient: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      groupMessages.push(groupMessage);
      console.log('Created group message:', groupMessage.id, 'for director:', directorId);
    }

    // Manually attach clone info to the first message if found
    if (clone && groupMessages.length > 0) {
      groupMessages[0].clone = {
        id: clone.id,
        cloneName: clone.cloneName,
        originalName: clone.originalName
      };
    }

    //console.log('Created', groupMessages.length, 'group messages for all directors');

    res.json({
      success: true,
      message: `Message sent to ${directors.length} director(s)`,
      messages: groupMessages // FIXED: Return groupMessages instead of undefined groupMessage
    });

  } catch (error) {
    console.error('=== ERROR SENDING SUPPORT MESSAGE ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    if (error.meta) {
      console.error('Error meta:', error.meta);
    }
    if (error.code) {
      console.error('Error code:', error.code);
    }
    console.error('Full error:', error);
    res.status(500).json({
      error: error.message,
      details: error.meta || 'No additional details available'
    });
  }
});



// Mark message as read
app.put('/api/messages/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    const message = await prisma.message.update({
      where: { id: parseInt(id) },
      data: { isRead: true },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            school: { select: { name: true } }
          }
        },
        clone: {
          select: {
            id: true,
            cloneName: true,
            originalName: true
          }
        }
      }
    });

    res.json(message);
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get message counts for user (for notification badges)
app.get('/api/messages/user/:userId/counts', async (req, res) => {
  try {
    const { userId } = req.params;

    // Simplified unread count in both endpoints
    const unreadCount = await prisma.discussionMessage.count({
      where: {
        discussionId: discussion.id,
        senderId: { not: parseInt(studentId) }, // Don't count own messages
        AND: [
          {
            OR: [
              { readBy: null },
              { readBy: "" },
              { readBy: "[]" }
            ]
          },
          {
            readBy: {
              not: {
                contains: `"${studentId}"`
              }
            }
          }
        ]
      }
    });

    const totalCount = await prisma.message.count({
      where: {
        recipientId: parseInt(userId)
      }
    });

    res.json({
      unread: unreadCount,
      total: totalCount
    });
  } catch (error) {
    console.error('Error fetching message counts:', error);
    res.status(500).json({ error: error.message });
  }
});

// FIXED: Reply endpoint with proper group messaging logic
app.post('/api/messages/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { senderId, content } = req.body;

    /*
    console.log('=== REPLY ENDPOINT DEBUG ===');
    console.log('Replying to message ID:', id);
    console.log('Sender ID:', senderId);
    console.log('Content:', content.substring(0, 50) + '...');
    */

    // Get the original message
    const originalMessage = await prisma.message.findUnique({
      where: { id: parseInt(id) },
      include: {
        sender: true,
        recipient: true,
        clone: true
      }
    });

    if (!originalMessage) {
      return res.status(404).json({ error: 'Original message not found' });
    }

    /*
    console.log('Original message found:');
    console.log('- Original sender:', originalMessage.sender.name, originalMessage.senderId);
    console.log('- Original recipient:', originalMessage.recipient.name, originalMessage.recipientId);
    console.log('- Current replier:', senderId);
    console.log('- Is group message:', originalMessage.isGroupMessage);
    console.log('- Message type:', originalMessage.messageType);
    */

    // NEW: Group messaging logic - replies go to all participants
    if (originalMessage.isGroupMessage || originalMessage.messageType === 'group_support') {
      console.log('Processing group message reply');

      // Parse participants from JSON
      let participants = [];
      try {
        participants = originalMessage.groupParticipants
          ? JSON.parse(originalMessage.groupParticipants)
          : [];
      } catch (parseError) {
        console.error('Error parsing group participants:', parseError);
        participants = [];
      }

      // Add original sender and recipient to participants if not already included
      if (!participants.includes(originalMessage.senderId)) {
        participants.push(originalMessage.senderId);
      }
      if (!participants.includes(originalMessage.recipientId)) {
        participants.push(originalMessage.recipientId);
      }

      // Remove current sender from recipients  
      // FIXED: Always include student in group replies
      let originalStudentId = null;
      if (originalMessage.sender.role === 'student') {
        originalStudentId = originalMessage.senderId;
      } else if (originalMessage.recipient.role === 'student') {
        originalStudentId = originalMessage.recipientId;
      }

      // Get all recipients (excluding current sender)
      const recipients = participants.filter(id => id !== parseInt(senderId));


      // CRITICAL: Always ensure student gets the reply
      if (originalStudentId && !recipients.includes(originalStudentId)) {
        recipients.unshift(originalStudentId); // Add student as first recipient
        //console.log('Added student to recipients:', originalStudentId);
      }

      //console.log('Final recipients list:', recipients);

      //console.log('Original student ID:', originalStudentId);
      //console.log('Final recipients list:', recipients);

      //console.log('Group participants:', participants);
      //console.log('Reply recipients (excluding sender):', recipients);

      // Create reply messages for all recipients
      const replyMessages = [];
      for (const recipientId of recipients) {
        //console.log('Creating reply for recipient:', recipientId);

        const replyMessage = await prisma.message.create({
          data: {
            subject: `Re: ${originalMessage.subject}`,
            content: content.trim(),
            messageType: originalMessage.messageType,
            senderId: parseInt(senderId),
            recipientId: recipientId,
            isGroupMessage: true,
            groupParticipants: JSON.stringify(participants),
            cloneId: originalMessage.cloneId,
            cloneProgress: originalMessage.cloneProgress,
            currentStep: originalMessage.currentStep
          },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
                school: { select: { name: true } }
              }
            },
            recipient: {
              select: {
                id: true,
                name: true,
                email: true,
                school: { select: { name: true } }
              }
            },
            clone: {
              select: {
                id: true,
                cloneName: true,
                originalName: true
              }
            }
          }
        });

        replyMessages.push(replyMessage);
        //console.log('Created reply message:', replyMessage.id, 'to', replyMessage.recipient.name);
      }

      //console.log('Created', replyMessages.length, 'group reply messages');

      // Return the first reply message (they're all essentially the same content)
      return res.json(replyMessages[0]);
    }

    // EXISTING: Logic for regular (non-group) messages
    console.log('Processing regular message reply');

    let recipientId;
    if (parseInt(senderId) === originalMessage.senderId) {
      recipientId = originalMessage.recipientId;
      console.log('Current sender was original sender, replying to original recipient:', recipientId);
    } else if (parseInt(senderId) === originalMessage.recipientId) {
      recipientId = originalMessage.senderId;
      console.log('Current sender was original recipient, replying to original sender:', recipientId);
    } else {
      // Fallback: if sender is neither original sender nor recipient, 
      // this might be a director joining a conversation
      console.log('Current sender was neither original sender nor recipient');

      // Check if current sender is a director
      const currentSender = await prisma.user.findUnique({
        where: { id: parseInt(senderId) }
      });

      if (currentSender && currentSender.role === 'director') {
        // Director joining conversation - send to the student (non-director)
        if (originalMessage.sender.role !== 'director') {
          recipientId = originalMessage.senderId;
        } else {
          recipientId = originalMessage.recipientId;
        }
        console.log('Director joining conversation, sending to student:', recipientId);
      } else {
        // Default fallback
        recipientId = originalMessage.senderId;
        console.log('Using fallback recipient:', recipientId);
      }
    }

    // Create regular reply message
    const replyMessage = await prisma.message.create({
      data: {
        subject: `Re: ${originalMessage.subject}`,
        content: content.trim(),
        messageType: originalMessage.messageType,
        senderId: parseInt(senderId),
        recipientId: recipientId,
        cloneId: originalMessage.cloneId,
        cloneProgress: originalMessage.cloneProgress,
        currentStep: originalMessage.currentStep
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            school: { select: { name: true } }
          }
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
            school: { select: { name: true } }
          }
        },
        clone: {
          select: {
            id: true,
            cloneName: true,
            originalName: true
          }
        }
      }
    });

    console.log('Regular reply message created successfully:');
    console.log('- Message ID:', replyMessage.id);
    console.log('- From:', replyMessage.sender.name);
    console.log('- To:', replyMessage.recipient.name);
    console.log('- Content:', replyMessage.content.substring(0, 50) + '...');

    res.json(replyMessage);

  } catch (error) {
    console.error('=== REPLY ENDPOINT ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    res.status(500).json({
      error: error.message,
      details: 'Check server console for full error details'
    });
  }
});

// ADDITIONAL: Enhanced logging for message fetching to debug the issue
app.get('/api/messages/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { type = 'received', unreadOnly = false } = req.query;

    //console.log('=== FETCH MESSAGES DEBUG ===');
    //console.log('User ID:', userId);
    //console.log('Type:', type);
    //console.log('Unread only:', unreadOnly);

    const whereClause = {
      [type === 'sent' ? 'senderId' : 'recipientId']: parseInt(userId)
    };

    if (unreadOnly === 'true') {
      whereClause.isRead = false;
    }

    //console.log('Where clause:', whereClause);

    // REVERT: Back to include (which should work) but add debugging
    const messages = await prisma.message.findMany({
      where: whereClause,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            school: { select: { name: true } }
          }
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            school: { select: { name: true } }
          }
        },
        clone: {
          select: {
            id: true,
            cloneName: true,
            originalName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    //console.log('Found', messages.length, 'messages for user', userId);
    //console.log('Message IDs:', messages.map(m => m.id));



    // Resolve correct clone names for both practice and assigned clones
    const messagesWithCorrectClones = await resolveCloneInfo(messages);

    res.json(messagesWithCorrectClones);

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a message
app.delete('/api/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.message.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/messages/direct', async (req, res) => {
  try {
    const { senderId, recipientId, subject, content } = req.body;

    // Validation
    if (!senderId || !recipientId || !subject || !content) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Create direct message (no cloneId)
    const message = await prisma.message.create({
      data: {
        senderId: parseInt(senderId),
        recipientId: parseInt(recipientId),
        subject: subject.trim(),
        content: content.trim(),
        messageType: 'direct',
        isRead: false
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            school: { select: { name: true } }
          }
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
            school: { select: { name: true } }
          }
        }
      }
    });

    res.json({ success: true, message });
  } catch (error) {
    console.error('Error sending direct message:', error);
    res.status(500).json({ error: error.message });
  }
});



app.post('/api/messages/review-feedback', async (req, res) => {
  try {
    const { reviewerId, studentId, cloneId, subject, content, reviewStatus } = req.body;

    console.log('=== REVIEW FEEDBACK DEBUG ===');
    console.log('Reviewer ID:', reviewerId);
    console.log('Student ID:', studentId);
    console.log('Clone ID:', cloneId);
    console.log('Subject:', subject);
    console.log('Review Status:', reviewStatus);

    // Validate required fields
    if (!reviewerId || !studentId || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify users exist
    const reviewer = await prisma.user.findUnique({
      where: { id: parseInt(reviewerId) }
    });

    const student = await prisma.user.findUnique({
      where: { id: parseInt(studentId) },
      include: { school: true }
    });

    if (!reviewer || !student) {
      return res.status(400).json({ error: 'Invalid user IDs' });
    }

    // Get clone info if provided
    let clone = null;
    if (cloneId) {
      clone = await prisma.uploadedFile.findUnique({
        where: { id: parseInt(cloneId) }
      });
    }

    // Create the feedback message
    const message = await prisma.message.create({
      data: {
        senderId: parseInt(reviewerId),
        recipientId: parseInt(studentId),
        subject: subject || `Analysis Review: ${reviewStatus}`,
        content: content.trim(),
        messageType: 'review_feedback',
        cloneId: cloneId ? parseInt(cloneId) : null,
        isRead: false
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
            school: { select: { name: true } }
          }
        },
        clone: {
          select: {
            id: true,
            cloneName: true,
            originalName: true
          }
        }
      }
    });

    console.log('Review feedback message created:', message.id);
    res.json({ success: true, message });
  } catch (error) {
    console.error('Error sending review feedback:', error);
    res.status(500).json({ error: error.message });
  }
});

// ADD: Review statistics endpoint (optional but helpful)
app.get('/api/review-stats', async (req, res) => {
  try {
    // Get counts for each review status
    const pendingCount = await prisma.uploadedFile.count({
      where: {
        status: CLONE_STATUSES.COMPLETED_WAITING_REVIEW,
        assignedToId: { not: null }
      }
    });

    const resubmittedCount = await prisma.uploadedFile.count({
      where: {
        status: CLONE_STATUSES.CORRECTED_WAITING_REVIEW,
        assignedToId: { not: null }
      }
    });

    const approvedCount = await prisma.uploadedFile.count({
      where: {
        status: CLONE_STATUSES.REVIEWED_CORRECT,
        assignedToId: { not: null }
      }
    });

    const rejectedCount = await prisma.uploadedFile.count({
      where: {
        status: CLONE_STATUSES.NEEDS_REANALYSIS,
        assignedToId: { not: null }
      }
    });

    const totalReviewable = await prisma.uploadedFile.count({
      where: {
        assignedToId: { not: null },
        analysisData: { not: null }
      }
    });

    const stats = {
      pending: pendingCount,
      resubmitted: resubmittedCount,
      approved: approvedCount,
      rejected: rejectedCount,
      total: totalReviewable
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching review stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ADD: Get specific file with full analysis data (optional helper)
app.get('/api/uploaded-files/:id/full', async (req, res) => {
  try {
    const { id } = req.params;

    const file = await prisma.uploadedFile.findUnique({
      where: { id: parseInt(id) },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            school: { select: { name: true } }
          }
        },
        uploadedBy: {
          select: { id: true, name: true }
        }
      }
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Parse analysis data
    let analysisData = {
      answers: {},
      currentStep: 'clone-editing',
      lastSaved: null,
      reviewComments: [],
      reviewScore: null,
      lastReviewed: null
    };

    if (file.analysisData) {
      try {
        analysisData = { ...analysisData, ...JSON.parse(file.analysisData) };
      } catch (error) {
        console.error('Error parsing analysis data:', error);
      }
    }

    res.json({
      ...file,
      ...analysisData
    });
  } catch (error) {
    console.error('Error fetching file details:', error);
    res.status(500).json({ error: error.message });
  }
});

//Chat Delete Conversation Thread Endpoint
// Delete all messages for a specific student-clone conversation
app.delete('/api/messages/conversation/:studentId/:cloneId', async (req, res) => {
  try {
    const { studentId, cloneId } = req.params;
    const { requesterId } = req.query; // FIXED: Read from query params instead of body

    console.log('=== DELETE CONVERSATION THREAD ===');
    console.log('Student ID:', studentId);
    console.log('Clone ID:', cloneId);
    console.log('Requester ID:', requesterId);

    // FIXED: Add validation for requesterId
    if (!requesterId || isNaN(parseInt(requesterId))) {
      console.log('ERROR: Invalid or missing requesterId:', requesterId);
      return res.status(400).json({ error: 'Valid requesterId is required' });
    }

    // Verify requester is a director
    const requester = await prisma.user.findUnique({
      where: { id: parseInt(requesterId) }
    });

    if (!requester || requester.role !== 'director') {
      return res.status(403).json({ error: 'Only directors can delete conversation threads' });
    }

    // Build where clause for messages to delete
    const whereClause = {
      AND: [
        {
          OR: [
            { senderId: parseInt(studentId) },
            { recipientId: parseInt(studentId) }
          ]
        }
      ]
    };

    // Handle different clone ID scenarios
    if (cloneId === 'general' || cloneId === 'null') {
      whereClause.AND.push({ cloneId: null });
    } else {
      whereClause.AND.push({ cloneId: parseInt(cloneId) });
    }

    // Get count of messages to be deleted for logging
    const messageCount = await prisma.message.count({
      where: whereClause
    });

    console.log('Messages to delete:', messageCount);

    if (messageCount === 0) {
      return res.status(404).json({ error: 'No messages found for this conversation' });
    }

    // Delete all messages in this conversation thread
    const deleteResult = await prisma.message.deleteMany({
      where: whereClause
    });

    console.log('Successfully deleted', deleteResult.count, 'messages');

    res.json({
      success: true,
      message: `Deleted ${deleteResult.count} messages from conversation thread`,
      deletedCount: deleteResult.count
    });

  } catch (error) {
    console.error('=== ERROR DELETING CONVERSATION THREAD ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    res.status(500).json({
      error: error.message,
      details: 'Check server console for full error details'
    });
  }
});

// Alternative endpoint: Delete individual message (optional)
app.delete('/api/messages/:messageId/delete', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { requesterId } = req.body;

    // Verify requester is a director
    const requester = await prisma.user.findUnique({
      where: { id: parseInt(requesterId) }
    });

    if (!requester || requester.role !== 'director') {
      return res.status(403).json({ error: 'Only directors can delete messages' });
    }

    // Check if message exists
    const message = await prisma.message.findUnique({
      where: { id: parseInt(messageId) }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Delete the message
    await prisma.message.delete({
      where: { id: parseInt(messageId) }
    });

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting individual message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get conversation thread info (for confirmation dialogs)
app.get('/api/messages/conversation/:studentId/:cloneId/info', async (req, res) => {
  try {
    const { studentId, cloneId } = req.params;

    // Build where clause
    const whereClause = {
      AND: [
        {
          OR: [
            { senderId: parseInt(studentId) },
            { recipientId: parseInt(studentId) }
          ]
        }
      ]
    };

    if (cloneId === 'general' || cloneId === 'null') {
      whereClause.AND.push({ cloneId: null });
    } else {
      whereClause.AND.push({ cloneId: parseInt(cloneId) });
    }

    // Get message count and date range
    const messageCount = await prisma.message.count({
      where: whereClause
    });

    const messages = await prisma.message.findMany({
      where: whereClause,
      select: {
        createdAt: true,
        sender: {
          select: { name: true }
        },
        clone: {
          select: { cloneName: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    res.json({
      messageCount,
      firstMessageDate: firstMessage?.createdAt,
      lastMessageDate: lastMessage?.createdAt,
      cloneName: firstMessage?.clone?.cloneName || 'General Discussion',
      studentName: firstMessage?.sender?.name
    });

  } catch (error) {
    console.error('Error getting conversation info:', error);
    res.status(500).json({ error: error.message });
  }
});

// Program Settings API endpoints - Add these to your index.js
// Program Settings API endpoints - Add these to your index.js

// Program Settings API endpoints - Add these to your index.js

// Get program settings
app.get('/api/program-settings', async (req, res) => {
  try {
    // Get the first (and should be only) settings record
    let settings = await prisma.programSettings.findFirst();

    // If no settings exist, create default settings
    if (!settings) {
      settings = await prisma.programSettings.create({
        data: {
          projectHeader: 'DNA Analysis Program'
        }
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching program settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update program settings
app.post('/api/program-settings', async (req, res) => {
  try {
    const {
      projectHeader,
      principalInvestigator,
      projectName,
      staffEmail,
      organismName,
      orfContactInformation,
      cloningVector,
      sequencePrimer,
      libraryName,
      restrictionEnzyme,
      description,
      welcomeText,
      overview,
      collectDemographics  // NEW FIELD
    } = req.body;

    // Validate input
    if (!projectHeader || projectHeader.trim() === '') {
      return res.status(400).json({ error: 'Project header is required' });
    }

    const sanitizeString = (str) => {
      return str && str.trim() !== '' ? str.trim() : null;
    };

    let settings = await prisma.programSettings.findFirst();

    const updateData = {
      projectHeader: projectHeader.trim(),
      principalInvestigator: sanitizeString(principalInvestigator),
      projectName: sanitizeString(projectName),
      staffEmail: sanitizeString(staffEmail),
      organismName: sanitizeString(organismName),
      orfContactInformation: sanitizeString(orfContactInformation),
      cloningVector: sanitizeString(cloningVector),
      sequencePrimer: sanitizeString(sequencePrimer),
      libraryName: sanitizeString(libraryName),
      restrictionEnzyme: sanitizeString(restrictionEnzyme),
      description: sanitizeString(description),
      welcomeText: sanitizeString(welcomeText),
      overview: sanitizeString(overview),
      collectDemographics: Boolean(collectDemographics)  // NEW FIELD
    };

    if (settings) {
      settings = await prisma.programSettings.update({
        where: { id: settings.id },
        data: updateData
      });
    } else {
      settings = await prisma.programSettings.create({
        data: updateData
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('Error saving program settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// New endpoint to check if demographics should be collected
app.get('/api/settings/collect-demographics', async (req, res) => {
  try {
    const settings = await prisma.programSettings.findFirst();
    res.json({
      collectDemographics: settings?.collectDemographics || false
    });
  } catch (error) {
    console.error('Error fetching demographics setting:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get demographics summary (for directors only)
app.get('/api/demographics/summary', authenticateToken, requireRole(['director']), async (req, res) => {
  try {
    const demographics = await prisma.demographics.findMany({
      include: {
        user: {
          include: {
            school: true
          }
        }
      }
    });

    // Aggregate the data for summary stats
    const summary = {
      totalResponses: demographics.length,
      ageGroups: {},
      genderDistribution: {},
      ethnicityDistribution: {},
      educationLevels: {},
      labExperience: {}
    };

    demographics.forEach(demo => {
      // Age groups
      if (demo.age) {
        const ageGroup = demo.age < 18 ? 'Under 18' :
          demo.age < 25 ? '18-24' :
            demo.age < 35 ? '25-34' :
              demo.age < 45 ? '35-44' : '45+';
        summary.ageGroups[ageGroup] = (summary.ageGroups[ageGroup] || 0) + 1;
      }

      // Gender distribution
      if (demo.gender) {
        summary.genderDistribution[demo.gender] = (summary.genderDistribution[demo.gender] || 0) + 1;
      }

      // And so on for other fields...
    });

    res.json(summary);
  } catch (error) {
    console.error('Error fetching demographics summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Updated registration endpoint with Demographics
app.post('/api/auth/register-student', async (req, res) => {
  try {
    const {
      email,
      password,
      name,
      schoolId,
      demographics  // NEW FIELD - optional demographics object
    } = req.body;


    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with pending status
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'student',
        status: 'pending',
        schoolId: schoolId ? parseInt(schoolId) : null
      },
      include: {
        school: true
      }
    });


    // If demographics data was provided, create demographics record
    if (demographics && Object.keys(demographics).length > 0) {
      try {
        const savedDemographics = await prisma.demographics.create({
          data: {
            userId: user.id,
            // Your specific questions
            academicYear: demographics.academicYear || null,
            yearsInProgram: demographics.yearsInProgram || null,
            classesTaken: demographics.classesTaken && demographics.classesTaken.length > 0
              ? JSON.stringify(demographics.classesTaken)
              : null,
            otherScienceCourses: demographics.otherScienceCourses || null,

            // Optional general demographics
            age: demographics.age ? parseInt(demographics.age) : null,
            gender: demographics.gender || null,
            ethnicity: demographics.ethnicity || null,
            city: demographics.city || null,
            state: demographics.state || null,
            country: demographics.country || null
          }
        });
      } catch (demographicsError) {
        console.error('❌ ERROR SAVING DEMOGRAPHICS:', demographicsError);
        console.error('Demographics error details:', demographicsError.message);
        // Don't fail the whole registration, just log the error
      }
    } else {
      console.log('❌ NO DEMOGRAPHICS: No demographics data provided or empty object');
      console.log('Demographics falsy?', !demographics);
      console.log('Demographics empty?', demographics && Object.keys(demographics).length === 0);
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Registration successful! Your account is pending approval.',
      user: userWithoutPassword
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all directors for the dropdown
app.get('/api/directors', async (req, res) => {
  try {
    const directors = await prisma.user.findMany({
      where: {
        role: 'director',
        status: 'approved'
      },
      select: {
        id: true,
        name: true,
        email: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json(directors);
  } catch (error) {
    console.error('Error fetching directors:', error);
    res.status(500).json({ error: error.message });
  }
});// Program Settings API endpoints - Add these to your index.js

// Get program settings

// REPLACE your existing self-update endpoint with this improved version:

app.put('/api/users/:id/self-update', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, currentPassword, password } = req.body;

    console.log('=== SELF-UPDATE DEBUG ===');
    console.log('User ID:', id);
    console.log('Name update:', name);
    console.log('Password change requested:', !!password);
    console.log('Current password provided:', !!currentPassword);

    // Get the current user to verify password
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      include: { school: true }
    });

    if (!user) {
      console.log('ERROR: User not found with ID:', id);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Found user:', user.name, user.email);

    // If changing password, verify current password
    if (password && currentPassword) {
      console.log('Verifying current password...');
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        console.log('ERROR: Current password is incorrect');
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      console.log('Current password verified successfully');
    }

    const updateData = {};

    // Update name if provided
    if (name !== undefined && name.trim() !== '') {
      updateData.name = name.trim();
      console.log('Will update name to:', updateData.name);
    }

    // Update password if provided and current password is verified
    if (password && currentPassword) {
      updateData.password = await bcrypt.hash(password, 10);
      console.log('Will update password (hashed)');
    }

    console.log('Updating user with data:', { ...updateData, password: updateData.password ? '[HIDDEN]' : undefined });

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        school: true
      }
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;

    console.log('Self-update successful for user:', updatedUser.name);
    console.log('Returning user data:', { ...userWithoutPassword, password: undefined });

    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error('=== ERROR IN SELF-UPDATE ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all practice clones (with query parameter for filtering)
app.get('/api/practice-clones', async (req, res) => {
  try {
    const { activeOnly } = req.query;

    const whereClause = activeOnly === 'true' ? { isActive: true } : {};

    const practiceClones = await prisma.practiceClone.findMany({
      where: whereClause,
      orderBy: { cloneName: 'asc' }
    });
    res.json(practiceClones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get practice clone progress for a user
app.get('/api/practice-clones/:cloneId/progress/:userId', validateStatusMiddleware, async (req, res) => {
  try {
    const { cloneId, userId } = req.params;

    let progress = await prisma.userPracticeProgress.findUnique({
      where: {
        userId_practiceCloneId: {
          userId: parseInt(userId),
          practiceCloneId: parseInt(cloneId)
        }
      }
    });

    if (!progress) {
      // Create initial progress record
      progress = await prisma.userPracticeProgress.create({
        data: {
          userId: parseInt(userId),
          practiceCloneId: parseInt(cloneId),
          progress: 0,
          currentStep: 'clone-editing'
        }
      });
    }

    // Parse the JSON fields
    const analysisData = {
      answers: progress.answers ? JSON.parse(progress.answers) : {},
      currentStep: progress.currentStep,
      lastSaved: progress.lastSaved,
      reviewComments: progress.reviewComments ? JSON.parse(progress.reviewComments) : [],
      status: progress.status,
      progress: progress.progress
    };

    res.json(analysisData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save practice clone progress
app.put('/api/practice-clones/:cloneId/progress/:userId', async (req, res) => {
  try {
    const { cloneId, userId } = req.params;
    const { progress, answers, currentStep, status, submittedAt, reviewComments, reviewScore, lastReviewed } = req.body;

    console.log('Saving practice progress:', { cloneId, userId, progress, status });

    const updatedProgress = await prisma.userPracticeProgress.upsert({
      where: {
        userId_practiceCloneId: {
          userId: parseInt(userId),
          practiceCloneId: parseInt(cloneId)
        }
      },
      update: {
        progress: progress || 0,
        answers: answers ? JSON.stringify(answers) : null,
        currentStep: currentStep || 'clone-editing',
        status: status || CLONE_STATUSES.AVAILABLE,
        lastSaved: new Date(),
        submittedAt: submittedAt ? new Date(submittedAt) : undefined,
        reviewComments: reviewComments ? JSON.stringify(reviewComments) : null,
        reviewScore: reviewScore,
        lastReviewed: lastReviewed ? new Date(lastReviewed) : null
      },
      create: {
        userId: parseInt(userId),
        practiceCloneId: parseInt(cloneId),
        progress: progress || 0,
        answers: answers ? JSON.stringify(answers) : null,
        currentStep: currentStep || 'clone-editing',
        status: status || CLONE_STATUSES.AVAILABLE,
        lastSaved: new Date(),
        submittedAt: submittedAt ? new Date(submittedAt) : undefined,
        reviewComments: reviewComments ? JSON.stringify(reviewComments) : null,
        reviewScore: reviewScore,
        lastReviewed: lastReviewed ? new Date(lastReviewed) : null
      }
    });

    res.json(updatedProgress);
  } catch (error) {
    console.error('Error saving practice progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// Auto-grading function
async function generatePracticeFeedback(practiceCloneId, userAnswers) {
  try {
    const correctAnswers = await prisma.practiceAnswer.findMany({
      where: { practiceCloneId }
    });

    const comments = [];
    let correctCount = 0;

    correctAnswers.forEach(correct => {
      const userAnswer = userAnswers[correct.questionId];

      if (userAnswer === correct.correctAnswer) {
        correctCount++;
        comments.push({
          questionId: correct.questionId,
          comment: 'Correct!',
          type: 'success',
          timestamp: new Date().toISOString()
        });
      } else {
        comments.push({
          questionId: correct.questionId,
          comment: correct.explanation || `Incorrect. The correct answer is: ${correct.correctAnswer}`,
          type: 'correction',
          timestamp: new Date().toISOString()
        });
      }
    });

    const score = correctAnswers.length > 0 ? Math.round((correctCount / correctAnswers.length) * 100) : 0;

    return {
      comments,
      score,
      totalQuestions: correctAnswers.length,
      correctAnswers: correctCount
    };
  } catch (error) {
    console.error('Error generating practice feedback:', error);
    return {
      comments: [],
      score: 0,
      totalQuestions: 0,
      correctAnswers: 0
    };
  }
}


// Upload endpoint for practice clones (no validation for educational modified files)
app.post('/api/practice-clones/upload', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedPracticeClones = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const cloneName = file.originalname.replace(/\.ab1$/i, '');

      console.log(`Uploading practice clone ${i + 1}/${req.files.length}: ${file.originalname}`);

      const practiceClone = await prisma.practiceClone.create({
        data: {
          cloneName: cloneName,
          filename: file.filename, // Use local filename, not S3 key
          originalName: file.originalname,
          description: `Practice clone: ${cloneName}`,
          isActive: true
        }
      });

      uploadedPracticeClones.push(practiceClone);
    }

    res.json(uploadedPracticeClones);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle practice clone status
app.put('/api/practice-clones/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const updatedClone = await prisma.practiceClone.update({
      where: { id: parseInt(id) },
      data: { isActive }
    });

    res.json(updatedClone);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete practice clone
app.delete('/api/practice-clones/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const practiceCloneToDelete = await prisma.practiceClone.findUnique({
      where: { id: parseInt(id) }
    });

    if (!practiceCloneToDelete) {
      return res.status(404).json({ error: 'Practice clone not found' });
    }

    console.log('=== DELETING PRACTICE CLONE FROM LOCAL STORAGE AND DATABASE ===');
    console.log('Practice Clone ID:', id);
    console.log('Local filename:', practiceCloneToDelete.filename);
    console.log('Clone Name:', practiceCloneToDelete.cloneName);

    // Delete from local storage first
    try {
      const filePath = path.join(__dirname, 'uploads', practiceCloneToDelete.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Successfully deleted practice clone from local storage:', practiceCloneToDelete.filename);
      }
    } catch (localError) {
      console.error('Error deleting from local storage (continuing with database deletion):', localError);
    }

    // Delete associated database records
    await prisma.practiceAnswer.deleteMany({
      where: { practiceCloneId: parseInt(id) }
    });

    await prisma.userPracticeProgress.deleteMany({
      where: { practiceCloneId: parseInt(id) }
    });

    await prisma.cloneDiscussion.deleteMany({
      where: { practiceCloneId: parseInt(id) }
    });

    // Finally delete the practice clone itself
    await prisma.practiceClone.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      message: 'Practice clone deleted successfully',
      deletedClone: practiceCloneToDelete.cloneName
    });

  } catch (error) {
    console.error('Error deleting practice clone:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get practice submissions ready for review
app.get('/api/practice-submissions', async (req, res) => {
  try {
    const { reviewReady, schoolId, schoolName, includeTeacherReviewed } = req.query;


    let whereClause = {};

    // School filtering
    let userWhereClause = {};
    if (schoolId) {
      userWhereClause.school = { id: parseInt(schoolId) };
    } else if (schoolName) {
      userWhereClause.school = { name: schoolName };
    }

    // Build complete where clause
    if (reviewReady === 'true') {
      const reviewStatuses = [
        CLONE_STATUSES.COMPLETED_WAITING_REVIEW,
        CLONE_STATUSES.CORRECTED_WAITING_REVIEW
      ];

      // Only include teacher-reviewed items for directors
      if (includeTeacherReviewed === 'true') {
        reviewStatuses.push(CLONE_STATUSES.REVIEWED_BY_TEACHER);
        // console.log('✅ Including REVIEWED_BY_TEACHER status for directors (practice)');
      } else {
        console.log('❌ NOT including REVIEWED_BY_TEACHER status (instructor view - practice)');
      }

      //console.log('Practice review statuses being searched:', reviewStatuses);

      whereClause = {
        AND: [
          {
            status: {
              in: reviewStatuses
            }
          },
          ...(Object.keys(userWhereClause).length > 0 ?
            [{ user: userWhereClause }] : [])
        ]
      };
    } else {
      // For non-reviewReady requests, just apply school filtering if present
      if (Object.keys(userWhereClause).length > 0) {
        whereClause.user = userWhereClause;
      }
    }

    //console.log('Final practice whereClause:', JSON.stringify(whereClause, null, 2));

    const submissions = await prisma.userPracticeProgress.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            school: { select: { id: true, name: true } }
          }
        },
        practiceClone: {
          select: {
            id: true,
            cloneName: true,
            filename: true,
            originalName: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    //console.log('Found practice submissions:', submissions.length);
    //console.log('Practice submissions with REVIEWED_BY_TEACHER:', submissions.filter(s => s.status === CLONE_STATUSES.REVIEWED_BY_TEACHER).length);

    // Format the submissions to match expected structure
    const formattedSubmissions = submissions.map(submission => ({
      id: submission.id,
      practiceCloneId: submission.practiceCloneId,
      cloneName: submission.practiceClone.cloneName,
      filename: submission.practiceClone.filename,
      originalName: submission.practiceClone.originalName,
      assignedTo: submission.user,
      answers: submission.answers ? JSON.parse(submission.answers) : {},
      currentStep: submission.currentStep,
      progress: submission.progress,
      status: submission.status,
      submittedAt: submission.submittedAt,
      reviewComments: submission.reviewComments ? JSON.parse(submission.reviewComments) : [],
      reviewScore: submission.reviewScore,
      lastReviewed: submission.lastReviewed
    }));

    //console.log('Formatted practice submissions:', formattedSubmissions.length);
    res.json(formattedSubmissions);
  } catch (error) {
    console.error('Error in practice-submissions endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});


// Review practice clone submission
app.put('/api/practice-submissions/:id/review', validateStatusMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewScore, reviewComments, lastReviewed, reviewedBy } = req.body;

    console.log('=== PRACTICE REVIEW SUBMISSION DEBUG ===');
    console.log('Practice submission ID:', id);
    console.log('New status:', status);
    console.log('Review score:', reviewScore);
    console.log('Number of comments:', reviewComments?.length || 0);

    // Validate required fields
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Check if the practice progress record exists
    const existingProgress = await prisma.userPracticeProgress.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        practiceClone: {
          select: {
            cloneName: true
          }
        }
      }
    });

    if (!existingProgress) {
      console.log('Practice progress record not found with ID:', id);
      return res.status(404).json({ error: 'Practice submission not found' });
    }

    console.log('Found practice submission for user:', existingProgress.user.name);
    console.log('Practice clone:', existingProgress.practiceClone.cloneName);

    // Update the practice progress record
    const updatedProgress = await prisma.userPracticeProgress.update({
      where: { id: parseInt(id) },
      data: {
        status: status,
        reviewScore: reviewScore ? parseInt(reviewScore) : null,
        reviewComments: reviewComments ? JSON.stringify(reviewComments) : null,
        lastReviewed: lastReviewed ? new Date(lastReviewed) : new Date(),
        // Don't update other fields like answers, progress, etc.
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            school: { select: { name: true } }
          }
        },
        practiceClone: {
          select: {
            id: true,
            cloneName: true,
            filename: true,
            originalName: true
          }
        }
      }
    });

    console.log('Practice review submitted successfully');
    console.log('Updated status:', updatedProgress.status);
    console.log('Review score:', updatedProgress.reviewScore);

    res.json({
      success: true,
      message: 'Practice review submitted successfully',
      submission: updatedProgress
    });

  } catch (error) {
    console.error('=== ERROR SUBMITTING PRACTICE REVIEW ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    res.status(500).json({
      error: error.message,
      details: 'Check server console for full error details'
    });
  }
});

//Practice clone download endpoint
//Practice clone download endpoint with enhanced debugging
//Stream from S3
// REPLACE the practice clone download endpoint:
app.get('/api/practice-clones/:id/download', async (req, res) => {
  try {
    const { id } = req.params;

    const practiceClone = await prisma.practiceClone.findUnique({
      where: { id: parseInt(id) }
    });

    if (!practiceClone) {
      return res.status(404).json({ error: 'Practice clone not found' });
    }

    const filePath = path.join(__dirname, 'uploads', practiceClone.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${practiceClone.originalName}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Practice clone download error:', error);
    res.status(500).json({ error: error.message });
  }
});


// ==================== COMMON FEEDBACK ROUTES ====================

// Get all common feedback (optionally filter by questionId)
app.get('/api/common-feedback', async (req, res) => {
  try {
    const { questionId } = req.query;

    const whereClause = questionId ? { questionId, isActive: true } : { isActive: true };

    const commonFeedback = await prisma.commonFeedback.findMany({
      where: whereClause,
      orderBy: [
        { questionId: 'asc' },
        { title: 'asc' }
      ]
    });

    res.json(commonFeedback);
  } catch (error) {
    console.error('Error fetching common feedback:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new common feedback
app.post('/api/common-feedback', async (req, res) => {
  try {
    const { questionId, title, text } = req.body;

    // Validation
    if (!questionId || !title || !text) {
      return res.status(400).json({ error: 'questionId, title, and text are required' });
    }

    // Check if question exists
    const question = await prisma.analysisQuestion.findUnique({
      where: { id: questionId }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const feedback = await prisma.commonFeedback.create({
      data: {
        questionId,
        title,
        text
      }
    });

    res.json(feedback);
  } catch (error) {
    console.error('Error creating common feedback:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update common feedback
app.put('/api/common-feedback/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, text, isActive } = req.body;

    const feedback = await prisma.commonFeedback.update({
      where: { id: parseInt(id) },
      data: {
        ...(title !== undefined && { title }),
        ...(text !== undefined && { text }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.json(feedback);
  } catch (error) {
    console.error('Error updating common feedback:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete common feedback (soft delete - just mark as inactive)
app.delete('/api/common-feedback/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete by setting isActive to false
    const feedback = await prisma.commonFeedback.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    });

    res.json({ message: 'Common feedback deleted successfully' });
  } catch (error) {
    console.error('Error deleting common feedback:', error);
    res.status(500).json({ error: error.message });
  }
});

// Practice Answer Management API endpoints - ADD these to your index.js

// Get practice answers for a specific practice clone
app.get('/api/practice-clones/:id/answers', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Fetching practice answers for clone ID:', id);

    const practiceAnswers = await prisma.practiceAnswer.findMany({
      where: { practiceCloneId: parseInt(id) },
      orderBy: { questionId: 'asc' }
    });

    console.log(`Found ${practiceAnswers.length} practice answers`);
    res.json(practiceAnswers);
  } catch (error) {
    console.error('Error fetching practice answers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save or update practice answers for a specific practice clone
app.post('/api/practice-clones/:id/answers', async (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body; // answers is an array of { questionId, correctAnswer, explanation }

    console.log('Saving practice answers for clone ID:', id);
    console.log('Received answers:', answers);

    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers must be an array' });
    }

    // First, verify the practice clone exists
    const practiceClone = await prisma.practiceClone.findUnique({
      where: { id: parseInt(id) }
    });

    if (!practiceClone) {
      return res.status(404).json({ error: 'Practice clone not found' });
    }

    // Delete existing answers for this practice clone
    await prisma.practiceAnswer.deleteMany({
      where: { practiceCloneId: parseInt(id) }
    });

    // Create new answers
    const createdAnswers = [];
    for (const answer of answers) {
      // Only create answers that have actual content
      if (answer.correctAnswer && answer.correctAnswer.trim() !== '') {
        const practiceAnswer = await prisma.practiceAnswer.create({
          data: {
            practiceCloneId: parseInt(id),
            questionId: answer.questionId,
            correctAnswer: answer.correctAnswer.trim(),
            explanation: answer.explanation && answer.explanation.trim() !== ''
              ? answer.explanation.trim()
              : null
          }
        });
        createdAnswers.push(practiceAnswer);
      }
    }

    console.log(`Created ${createdAnswers.length} practice answers`);
    res.json({
      message: 'Practice answers saved successfully',
      answers: createdAnswers
    });

  } catch (error) {
    console.error('Error saving practice answers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a specific practice answer
app.delete('/api/practice-answers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.practiceAnswer.delete({
      where: { id: id }
    });

    res.json({ message: 'Practice answer deleted successfully' });
  } catch (error) {
    console.error('Error deleting practice answer:', error);
    res.status(500).json({ error: error.message });
  }
});

// ======================================
// IMPORT/EXPORT API ENDPOINTS
// REPLACE the duplicate import/export section with this corrected version
// ======================================

// Create separate multer config for JSON import files (don't interfere with existing .ab1 upload config)
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Only allow JSON files for imports
    if (file.originalname.toLowerCase().endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only .json files are allowed for imports'), false);
    }
  }
});

// Get user counts for export modal
app.get('/api/export/user-counts', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { status: 'approved' },
      select: { role: true }
    });

    const counts = {
      directors: users.filter(u => u.role === 'director').length,
      instructors: users.filter(u => u.role === 'instructor').length,
      students: users.filter(u => u.role === 'student').length
    };

    res.json(counts);
  } catch (error) {
    console.error('Error fetching user counts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export data endpoint
app.post('/api/export', async (req, res) => {
  try {
    const {
      directors: exportDirectors,
      instructors: exportInstructors,
      students: exportStudents,
      schools: exportSchools,
      practiceClones: exportPracticeClones,
      analysisQuestions: exportAnalysisQuestions,
      commonFeedback: exportCommonFeedback,
      programSettings: exportProgramSettings,
      createDefaultDirector
    } = req.body;

    const exportData = {
      exportInfo: {
        version: '1.0',
        timestamp: new Date().toISOString(),
        sourceInstance: 'DNA Analysis Program'
      }
    };

    // Export Users by role (excluding passwords for security)
    const rolesToExport = [];
    if (exportDirectors) rolesToExport.push('director');
    if (exportInstructors) rolesToExport.push('instructor');
    if (exportStudents) rolesToExport.push('student');

    if (rolesToExport.length > 0) {
      let usersToExport = await prisma.user.findMany({
        where: {
          status: 'approved',
          role: { in: rolesToExport }
        },
        include: {
          school: true
        }
      });

      // Remove sensitive data and group by role
      usersToExport = usersToExport.map(user => ({
        ...user,
        password: undefined, // Never export passwords
        schoolId: user.school?.schoolId || null,
        schoolName: user.school?.name || null
      }));

      // Group users by role for import
      if (exportDirectors) {
        exportData.directors = usersToExport.filter(u => u.role === 'director');
      }
      if (exportInstructors) {
        exportData.instructors = usersToExport.filter(u => u.role === 'instructor');
      }
      if (exportStudents) {
        exportData.students = usersToExport.filter(u => u.role === 'student');
      }
    }

    // Add default director if requested and no directors being exported
    if (createDefaultDirector) {
      const existingDirectors = exportData.directors || [];

      if (existingDirectors.length === 0) {
        const hashedPassword = await bcrypt.hash('password123', 10);
        const defaultDirector = {
          email: 'director@example.com',
          name: 'Default Director',
          role: 'director',
          status: 'approved',
          schoolId: null,
          schoolName: null,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        if (!exportData.directors) exportData.directors = [];
        exportData.directors.push(defaultDirector);
      }
    }

    // Export Schools
    if (exportSchools) {
      exportData.schools = await prisma.school.findMany();
    }

    // Export Practice Clones with answers
    if (exportPracticeClones) {
      exportData.practiceClones = await prisma.practiceClone.findMany({
        include: {
          practiceAnswers: true
        }
      });
    }

    // Export Analysis Questions
    if (exportAnalysisQuestions) {
      const questions = await prisma.analysisQuestion.findMany({
        orderBy: [
          { step: 'asc' },
          { order: 'asc' }
        ]
      });



      // Parse JSON fields for export
      exportData.analysisQuestions = questions.map(q => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
        conditionalLogic: q.conditionalLogic ? JSON.parse(q.conditionalLogic) : null
      }));
    }

    // Export Common Feedback
    if (exportCommonFeedback) {
      exportData.commonFeedback = await prisma.commonFeedback.findMany({
        where: { isActive: true },
        orderBy: [
          { questionId: 'asc' },
          { title: 'asc' }
        ]
      });
    }

    // Export Program Settings
    if (exportProgramSettings) {
      exportData.programSettings = await prisma.programSettings.findFirst();
    }

    // Set response headers for download
    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="dna-analysis-export-${timestamp}.json"`);

    res.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import data endpoint - NOTE: Uses importUpload instead of upload to avoid conflicts
app.post('/api/import', importUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const options = JSON.parse(req.body.options || '{}');
    const importData = JSON.parse(req.file.buffer.toString('utf8'));

    // Validate import file format
    if (!importData.exportInfo || !importData.exportInfo.version) {
      return res.status(400).json({ error: 'Invalid import file format' });
    }

    const results = {
      users: { created: 0, updated: 0, skipped: 0, errors: 0 },
      schools: { created: 0, updated: 0, skipped: 0, errors: 0 },
      practiceClones: { created: 0, updated: 0, skipped: 0, errors: 0 },
      analysisQuestions: { created: 0, updated: 0, skipped: 0, errors: 0 },
      commonFeedback: { created: 0, updated: 0, skipped: 0, errors: 0 },  // ADD THIS
      programSettings: { updated: 0, errors: 0 }
    };

    // Import Program Settings
    if (options.programSettings && importData.programSettings) {
      try {
        const existing = await prisma.programSettings.findFirst();

        if (existing && options.conflictResolution === 'skip') {
          results.skipped.programSettings = 'Program settings already exist';
        } else {
          const settingsData = { ...importData.programSettings };
          delete settingsData.id; // Don't import the ID
          delete settingsData.createdAt;
          delete settingsData.updatedAt;

          if (existing) {
            await prisma.programSettings.update({
              where: { id: existing.id },
              data: settingsData
            });
          } else {
            await prisma.programSettings.create({
              data: settingsData
            });
          }
          results.imported.programSettings = 'Program settings imported';
        }
      } catch (error) {
        results.errors.push(`Program Settings: ${error.message}`);
      }
    }

    // Import Schools
    if (options.schools && importData.schools) {
      let importedCount = 0;
      let skippedCount = 0;

      for (const school of importData.schools) {
        try {
          const existing = await prisma.school.findUnique({
            where: { schoolId: school.schoolId }
          });

          if (existing && options.conflictResolution === 'skip') {
            skippedCount++;
            continue;
          }

          const schoolData = { ...school };
          delete schoolData.id; // Don't import the ID
          delete schoolData.createdAt;
          delete schoolData.updatedAt;

          if (existing && options.conflictResolution === 'overwrite') {
            await prisma.school.update({
              where: { id: existing.id },
              data: schoolData
            });
          } else if (!existing) {
            await prisma.school.create({
              data: schoolData
            });
          }

          importedCount++;
        } catch (error) {
          results.errors.push(`School ${school.name}: ${error.message}`);
        }
      }

      results.imported.schools = `${importedCount} schools imported`;
      if (skippedCount > 0) {
        results.skipped.schools = `${skippedCount} schools skipped`;
      }
    }

    // Import Analysis Questions
    if (options.analysisQuestions && importData.analysisQuestions) {
      let importedCount = 0;
      let skippedCount = 0;

      for (const question of importData.analysisQuestions) {
        try {
          const existing = await prisma.analysisQuestion.findUnique({
            where: { id: question.id }
          });

          if (existing && options.conflictResolution === 'skip') {
            skippedCount++;
            continue;
          }

          const questionData = {
            ...question,
            options: question.options ? JSON.stringify(question.options) : null,
            conditionalLogic: question.conditionalLogic ? JSON.stringify(question.conditionalLogic) : null
          };

          delete questionData.createdAt;
          delete questionData.updatedAt;

          if (existing && options.conflictResolution === 'overwrite') {
            await prisma.analysisQuestion.update({
              where: { id: existing.id },
              data: questionData
            });
          } else if (!existing) {
            await prisma.analysisQuestion.create({
              data: questionData
            });
          }

          importedCount++;
        } catch (error) {
          results.errors.push(`Question ${question.text?.substring(0, 50)}...: ${error.message}`);
        }
      }

      results.imported.analysisQuestions = `${importedCount} questions imported`;
      if (skippedCount > 0) {
        results.skipped.analysisQuestions = `${skippedCount} questions skipped`;
      }
    }

    // Import Common Feedback
    if (data.commonFeedback && options.commonFeedback) {
      console.log('Importing common feedback...');

      for (const feedback of data.commonFeedback) {
        try {
          // Check if the questionId exists in our system
          const questionExists = await prisma.analysisQuestion.findUnique({
            where: { id: feedback.questionId }
          });

          if (questionExists) {
            // Check for existing feedback with same title and questionId
            const existingFeedback = await prisma.commonFeedback.findFirst({
              where: {
                questionId: feedback.questionId,
                title: feedback.title
              }
            });

            if (existingFeedback) {
              if (options.conflictResolution === 'overwrite') {
                await prisma.commonFeedback.update({
                  where: { id: existingFeedback.id },
                  data: {
                    text: feedback.text,
                    isActive: feedback.isActive
                  }
                });
                results.commonFeedback.updated++;
              } else {
                results.commonFeedback.skipped++;
              }
            } else {
              await prisma.commonFeedback.create({
                data: {
                  questionId: feedback.questionId,
                  title: feedback.title,
                  text: feedback.text,
                  isActive: feedback.isActive !== false
                }
              });
              results.commonFeedback.created++;
            }
          } else {
            console.log(`Skipping feedback for non-existent question ID: ${feedback.questionId}`);
            results.commonFeedback.skipped++;
          }
        } catch (error) {
          console.error('Error importing feedback:', error);
          results.commonFeedback.errors++;
        }
      }
    }


    // Import Practice Clones
    if (options.practiceClones && importData.practiceClones) {
      let importedCount = 0;
      let skippedCount = 0;

      for (const clone of importData.practiceClones) {
        try {
          const existing = await prisma.practiceClone.findFirst({
            where: { cloneName: clone.cloneName }
          });

          if (existing && options.conflictResolution === 'skip') {
            skippedCount++;
            continue;
          }

          const cloneData = { ...clone };
          delete cloneData.id;
          delete cloneData.createdAt;
          delete cloneData.updatedAt;
          delete cloneData.practiceAnswers;

          let cloneRecord;
          if (existing && options.conflictResolution === 'overwrite') {
            cloneRecord = await prisma.practiceClone.update({
              where: { id: existing.id },
              data: cloneData
            });
          } else if (!existing) {
            cloneRecord = await prisma.practiceClone.create({
              data: cloneData
            });
          } else {
            continue; // Skip if merge mode and exists
          }

          // Import practice answers
          if (clone.practiceAnswers) {
            // Delete existing answers if overwriting
            if (existing && options.conflictResolution === 'overwrite') {
              await prisma.practiceAnswer.deleteMany({
                where: { practiceCloneId: cloneRecord.id }
              });
            }

            for (const answer of clone.practiceAnswers) {
              const answerData = {
                practiceCloneId: cloneRecord.id,
                questionId: answer.questionId,
                correctAnswer: answer.correctAnswer,
                explanation: answer.explanation
              };

              await prisma.practiceAnswer.upsert({
                where: {
                  practiceCloneId_questionId: {
                    practiceCloneId: cloneRecord.id,
                    questionId: answer.questionId
                  }
                },
                update: answerData,
                create: answerData
              });
            }
          }

          importedCount++;
        } catch (error) {
          results.errors.push(`Practice Clone ${clone.cloneName}: ${error.message}`);
        }
      }

      results.imported.practiceClones = `${importedCount} practice clones imported`;
      if (skippedCount > 0) {
        results.skipped.practiceClones = `${skippedCount} practice clones skipped`;
      }
    }

    // Import Users by role (most complex due to relationships)
    const userRoles = ['directors', 'instructors', 'students'];
    let totalImportedUsers = 0;
    let totalSkippedUsers = 0;
    const roleResults = {};

    for (const roleKey of userRoles) {
      if (options[roleKey] && importData[roleKey]) {
        let importedCount = 0;
        let skippedCount = 0;

        for (const user of importData[roleKey]) {
          try {
            const existing = await prisma.user.findUnique({
              where: { email: user.email }
            });

            if (existing && options.conflictResolution === 'skip') {
              skippedCount++;
              continue;
            }

            // Find school by schoolId if provided
            let schoolId = null;
            if (user.schoolId) {
              const school = await prisma.school.findUnique({
                where: { schoolId: user.schoolId }
              });
              schoolId = school?.id || null;
            }

            const userData = {
              email: user.email,
              name: user.name,
              role: user.role,
              status: user.status,
              schoolId: schoolId,
              password: user.password || await bcrypt.hash('defaultpassword123', 10) // Fallback password
            };

            if (existing && options.conflictResolution === 'overwrite') {
              await prisma.user.update({
                where: { id: existing.id },
                data: userData
              });
            } else if (!existing) {
              await prisma.user.create({
                data: userData
              });
            }

            importedCount++;
          } catch (error) {
            results.errors.push(`User ${user.email}: ${error.message}`);
          }
        }

        totalImportedUsers += importedCount;
        totalSkippedUsers += skippedCount;

        if (importedCount > 0) {
          roleResults[roleKey] = `${importedCount} ${roleKey} imported`;
        }
        if (skippedCount > 0) {
          if (!results.skipped.users) results.skipped.users = [];
          roleResults[`${roleKey}_skipped`] = `${skippedCount} ${roleKey} skipped`;
        }
      }
    }

    // Combine role results
    if (totalImportedUsers > 0) {
      const importedRoles = Object.keys(roleResults).filter(k => !k.includes('_skipped'));
      results.imported.users = importedRoles.map(k => roleResults[k]).join(', ');
    }
    if (totalSkippedUsers > 0) {
      const skippedRoles = Object.keys(roleResults).filter(k => k.includes('_skipped'));
      results.skipped.users = skippedRoles.map(k => roleResults[k]).join(', ');
    }

    // Generate summary message
    const importedItems = Object.keys(results.imported).length;
    const totalErrors = results.errors.length;

    let message = `Import completed! ${importedItems} data types imported successfully.`;
    if (totalErrors > 0) {
      message += ` ${totalErrors} errors occurred.`;
    }

    res.json({
      success: true,
      message,
      results
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// NEW EXPORT SYSTEM v2.0 - Replace the existing export endpoint
app.post('/api/export-v2', async (req, res) => {
  try {
    const {
      directors: exportDirectors,
      instructors: exportInstructors,
      students: exportStudents,
      schools: exportSchools,
      practiceClones: exportPracticeClones,
      analysisQuestions: exportAnalysisQuestions,
      commonFeedback: exportCommonFeedback,
      stepHelp: exportStepHelp,
      helpTopics: exportHelpTopics,
      programSettings: exportProgramSettings,
      createDefaultDirector
    } = req.body;

    // Get current user info for export metadata
    const currentUser = req.user ? await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { email: true, name: true }
    }) : null;

    const exportData = {
      exportInfo: {
        version: '2.0',
        timestamp: new Date().toISOString(),
        source: 'DNA Analysis Program',
        exportedBy: currentUser?.email || 'unknown'
      }
    };

    // ===== USERS EXPORT =====
    const userRoles = [];
    if (exportDirectors) userRoles.push('director');
    if (exportInstructors) userRoles.push('instructor');
    if (exportStudents) userRoles.push('student');

    if (userRoles.length > 0) {
      const usersToExport = await prisma.user.findMany({
        where: {
          status: 'approved',
          role: { in: userRoles }
        },
        include: {
          school: true,
          demographics: true // Include demographics for students
        }
      });

      // Process and organize users by role
      exportData.users = {};

      if (exportDirectors) {
        exportData.users.directors = usersToExport
          .filter(user => user.role === 'director')
          .map(user => ({
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
            schoolId: user.school?.schoolId || null,
            schoolName: user.school?.name || null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
            // Note: Password excluded for security
          }));
      }

      if (exportInstructors) {
        exportData.users.instructors = usersToExport
          .filter(user => user.role === 'instructor')
          .map(user => ({
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
            schoolId: user.school?.schoolId || null,
            schoolName: user.school?.name || null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          }));
      }

      if (exportStudents) {
        exportData.users.students = usersToExport
          .filter(user => user.role === 'student')
          .map(user => ({
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
            schoolId: user.school?.schoolId || null,
            schoolName: user.school?.name || null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            // Include demographics data for students
            demographics: user.demographics ? {
              academicYear: user.demographics.academicYear,
              yearsInProgram: user.demographics.yearsInProgram,
              classesTaken: user.demographics.classesTaken ? JSON.parse(user.demographics.classesTaken) : null,
              otherScienceCourses: user.demographics.otherScienceCourses,
              age: user.demographics.age,
              gender: user.demographics.gender,
              ethnicity: user.demographics.ethnicity,
              educationLevel: user.demographics.educationLevel,
              city: user.demographics.city,
              state: user.demographics.state,
              country: user.demographics.country
            } : null
          }));
      }
    }

    // Add default director if requested and no directors being exported
    if (createDefaultDirector && (!exportData.users?.directors || exportData.users.directors.length === 0)) {
      if (!exportData.users) exportData.users = {};
      if (!exportData.users.directors) exportData.users.directors = [];

      exportData.users.directors.push({
        email: 'director@example.com',
        name: 'Default Director',
        role: 'director',
        status: 'approved',
        schoolId: null,
        schoolName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDefaultDirector: true // Flag to identify this as auto-created
      });
    }

    // ===== SCHOOLS EXPORT =====
    if (exportSchools) {
      exportData.schools = await prisma.school.findMany({
        orderBy: { name: 'asc' }
      });
    }

    // ===== PROGRAM SETTINGS EXPORT =====
    if (exportProgramSettings) {
      exportData.programSettings = await prisma.programSettings.findFirst();
    }

    // ===== ANALYSIS CONTENT EXPORT =====
    if (exportAnalysisQuestions || exportCommonFeedback || exportHelpTopics || exportStepHelp) {
      exportData.analysisContent = {};

      // Export Analysis Questions
      if (exportAnalysisQuestions) {
        const questions = await prisma.analysisQuestion.findMany({
          orderBy: [
            { step: 'asc' },
            { order: 'asc' }
          ]
        });

        exportData.analysisContent.questions = questions.map(q => ({
          ...q,
          options: q.options ? JSON.parse(q.options) : null,
          conditionalLogic: q.conditionalLogic ? JSON.parse(q.conditionalLogic) : null
        }));
      }

      // Enhanced export with full question details for validation
      if (exportHelpTopics) {
        exportData.analysisContent.masterHelpTopics = await prisma.masterHelpTopic.findMany({
          include: {
            helpTopics: {
              where: { isActive: true },
              orderBy: { order: 'asc' }
            },
            analysisQuestion: {
              select: {
                id: true,
                text: true,
                step: true,
                order: true,
                type: true,
                required: true,
                // Include enough detail for robust matching
                createdAt: true
              }
            }
          },
          orderBy: [
            { analysisQuestion: { step: 'asc' } },
            { analysisQuestion: { order: 'asc' } }
          ]
        });
      }

      // Export Step Help (general workflow help)
      if (exportStepHelp) {
        exportData.analysisContent.masterStepHelps = await prisma.masterStepHelp.findMany({
          include: {
            stepHelps: {
              where: { isActive: true },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { step: 'asc' }
        });
      }

      // Export Common Feedback
      // Export Common Feedback - FIXED VERSION
      if (exportCommonFeedback) {
        exportData.analysisContent.commonFeedback = await prisma.commonFeedback.findMany({
          where: { isActive: true },
          orderBy: [
            { questionId: 'asc' },
            { title: 'asc' }
          ]
        });
      }
    }

    // ===== PRACTICE CLONES EXPORT =====
    if (exportPracticeClones) {
      const practiceClones = await prisma.practiceClone.findMany({
        include: {
          practiceAnswers: {
            include: {
              // Include question info for relationship rebuilding
              practiceClone: {
                select: { id: true, cloneName: true }
              }
            }
          }
        },
        orderBy: { cloneName: 'asc' }
      });

      exportData.practiceClones = {
        clones: practiceClones.map(clone => ({
          id: clone.id,
          cloneName: clone.cloneName,
          filename: clone.filename,
          originalName: clone.originalName,
          description: clone.description,
          isActive: clone.isActive,
          uploadDate: clone.uploadDate,
          createdAt: clone.createdAt,
          updatedAt: clone.updatedAt
          // Note: Actual .ab1 file data excluded (metadata only)
        })),
        answers: practiceClones.flatMap(clone =>
          clone.practiceAnswers.map(answer => ({
            id: answer.id,
            practiceCloneId: clone.id,
            cloneName: clone.cloneName, // Include for easier import matching
            questionId: answer.questionId,
            correctAnswer: answer.correctAnswer,
            explanation: answer.explanation
          }))
        )
      };
    }

    // Set response headers for download
    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="dna-analysis-export-v2-${timestamp}.json"`);

    console.log('Export completed successfully:', {
      version: '2.0',
      dataTypes: Object.keys(exportData).filter(key => key !== 'exportInfo'),
      timestamp: exportData.exportInfo.timestamp
    });

    res.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update the user counts endpoint to include help topics and step help counts
// Update the /api/export/counts endpoint to handle master/child structure:
app.get('/api/export/counts', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { status: 'approved' },
      select: { role: true }
    });

    const counts = {
      directors: users.filter(u => u.role === 'director').length,
      instructors: users.filter(u => u.role === 'instructor').length,
      students: users.filter(u => u.role === 'student').length
    };

    // Count master help topics and their children
    const masterHelpTopics = await prisma.masterHelpTopic.count();
    const childHelpTopics = await prisma.helpTopic.count({ where: { isActive: true } });

    // Count master step helps and their children
    const masterStepHelps = await prisma.masterStepHelp.count();
    const childStepHelps = await prisma.stepHelp.count({ where: { isActive: true } });

    const [
      schools,
      analysisQuestions,
      commonFeedback,
      practiceClones,
      practiceAnswers,
      programSettings
    ] = await Promise.all([
      prisma.school.count(),
      prisma.analysisQuestion.count(),
      prisma.commonFeedback.count({ where: { isActive: true } }),
      prisma.practiceClone.count(),
      prisma.practiceAnswer.count(),
      prisma.programSettings.count()
    ]);

    res.json({
      users: counts,
      content: {
        schools,
        analysisQuestions,
        helpTopics: `${masterHelpTopics} masters, ${childHelpTopics} children`,
        stepHelp: `${masterStepHelps} masters, ${childStepHelps} children`,
        commonFeedback,
        practiceClones,
        practiceAnswers,
        programSettings
      }
    });
  } catch (error) {
    console.error('Error fetching counts:', error);
    res.status(500).json({ error: error.message });
  }
});

// NEW IMPORT SYSTEM v2.0 - Add this to index.js
app.post('/api/import-v2', importUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const options = JSON.parse(req.body.options || '{}');
    const importData = JSON.parse(req.file.buffer.toString('utf8'));

    // Validate import file format
    if (!importData.exportInfo || !importData.exportInfo.version) {
      return res.status(400).json({ error: 'Invalid import file format' });
    }

    console.log('Starting import process:', {
      version: importData.exportInfo.version,
      timestamp: importData.exportInfo.timestamp,
      source: importData.exportInfo.source
    });

    const results = {
      imported: {},
      updated: {},
      skipped: {},
      errors: []
    };

    // ID mapping for maintaining relationships
    const questionIdMapping = new Map(); // oldQuestionId -> newQuestionId
    const schoolIdMapping = new Map(); // oldSchoolId -> newSchoolId
    const practiceCloneMapping = new Map(); // oldCloneId -> newCloneId

    // ===== IMPORT SCHOOLS FIRST =====
    if (options.schools && importData.schools) {
      console.log('Importing schools...');
      let schoolsImported = 0;
      let schoolsUpdated = 0;
      let schoolsSkipped = 0;

      for (const school of importData.schools) {
        try {
          // Find existing school by schoolId (unique identifier)
          const existingSchool = await prisma.school.findUnique({
            where: { schoolId: school.schoolId }
          });

          if (existingSchool) {
            if (options.conflictResolution === 'overwrite') {
              await prisma.school.update({
                where: { id: existingSchool.id },
                data: {
                  name: school.name,
                  instructor: school.instructor,
                  students: school.students || 0
                }
              });
              schoolIdMapping.set(school.id, existingSchool.id);
              schoolsUpdated++;
            } else {
              schoolIdMapping.set(school.id, existingSchool.id);
              schoolsSkipped++;
            }
          } else {
            const newSchool = await prisma.school.create({
              data: {
                name: school.name,
                schoolId: school.schoolId,
                instructor: school.instructor,
                students: school.students || 0
              }
            });
            schoolIdMapping.set(school.id, newSchool.id);
            schoolsImported++;
          }
        } catch (error) {
          console.error('Error importing school:', error);
          results.errors.push(`School ${school.name}: ${error.message}`);
        }
      }

      if (schoolsImported > 0) results.imported.schools = `${schoolsImported} schools imported`;
      if (schoolsUpdated > 0) results.updated.schools = `${schoolsUpdated} schools updated`;
      if (schoolsSkipped > 0) results.skipped.schools = `${schoolsSkipped} schools skipped`;
    }

    // ===== IMPORT USERS =====
    if (importData.users) {
      const userRoles = ['directors', 'instructors', 'students'];
      let totalUsersImported = 0;
      let totalUsersUpdated = 0;
      let totalUsersSkipped = 0;

      for (const roleKey of userRoles) {
        if (options[roleKey] && importData.users[roleKey]) {
          console.log(`Importing ${roleKey}...`);

          for (const user of importData.users[roleKey]) {
            try {
              // Handle special case of default director
              if (user.isDefaultDirector) {
                // Check if any directors exist
                const existingDirectors = await prisma.user.count({
                  where: { role: 'director', status: 'approved' }
                });

                if (existingDirectors > 0) {
                  console.log('Skipping default director creation - directors already exist');
                  totalUsersSkipped++;
                  continue;
                }
              }

              // Find existing user by email
              const existingUser = await prisma.user.findUnique({
                where: { email: user.email }
              });

              // Determine school assignment
              let newSchoolId = null;
              if (user.schoolId) {
                // Try to find the mapped school ID
                const mappedSchoolId = schoolIdMapping.get(user.schoolId);
                if (mappedSchoolId) {
                  newSchoolId = mappedSchoolId;
                } else {
                  // Try to find by schoolId string
                  const school = await prisma.school.findUnique({
                    where: { schoolId: user.schoolId }
                  });
                  newSchoolId = school?.id || null;
                }
              }

              const userData = {
                email: user.email,
                name: user.name,
                role: user.role,
                status: user.status,
                schoolId: newSchoolId,
                password: user.isDefaultDirector
                  ? await bcrypt.hash('password123', 10)
                  : await bcrypt.hash('defaultpassword123', 10) // Default password for imported users
              };

              if (existingUser) {
                if (options.conflictResolution === 'overwrite') {
                  await prisma.user.update({
                    where: { id: existingUser.id },
                    data: userData
                  });

                  // Handle demographics for students
                  if (user.role === 'student' && user.demographics) {
                    await handleUserDemographics(existingUser.id, user.demographics);
                  }

                  totalUsersUpdated++;
                } else {
                  totalUsersSkipped++;
                }
              } else {
                const newUser = await prisma.user.create({
                  data: userData
                });

                // Handle demographics for students
                if (user.role === 'student' && user.demographics) {
                  await handleUserDemographics(newUser.id, user.demographics);
                }

                totalUsersImported++;
              }
            } catch (error) {
              console.error(`Error importing user ${user.email}:`, error);
              results.errors.push(`User ${user.email}: ${error.message}`);
            }
          }
        }
      }

      if (totalUsersImported > 0) results.imported.users = `${totalUsersImported} users imported`;
      if (totalUsersUpdated > 0) results.updated.users = `${totalUsersUpdated} users updated`;
      if (totalUsersSkipped > 0) results.skipped.users = `${totalUsersSkipped} users skipped`;
    }

    // ===== IMPORT PROGRAM SETTINGS =====
    if (options.programSettings && importData.programSettings) {
      console.log('Importing program settings...');
      try {
        const existingSettings = await prisma.programSettings.findFirst();

        if (existingSettings) {
          if (options.conflictResolution === 'overwrite') {
            await prisma.programSettings.update({
              where: { id: existingSettings.id },
              data: {
                ...importData.programSettings,
                id: undefined, // Don't update the ID
                createdAt: undefined,
                updatedAt: undefined
              }
            });
            results.updated.programSettings = 'Program settings updated';
          } else {
            results.skipped.programSettings = 'Program settings skipped (already exists)';
          }
        } else {
          await prisma.programSettings.create({
            data: {
              ...importData.programSettings,
              id: undefined,
              createdAt: undefined,
              updatedAt: undefined
            }
          });
          results.imported.programSettings = 'Program settings imported';
        }
      } catch (error) {
        console.error('Error importing program settings:', error);
        results.errors.push(`Program settings: ${error.message}`);
      }
    }

    // ===== IMPORT ANALYSIS CONTENT (Questions first, then dependent content) =====
    if (importData.analysisContent) {

      // STEP 1: Import Analysis Questions
      if (options.analysisQuestions && importData.analysisContent.questions) {
        console.log('Importing analysis questions...');
        let questionsImported = 0;
        let questionsSkipped = 0;

        for (const question of importData.analysisContent.questions) {
          try {
            const existingQuestion = await prisma.analysisQuestion.findFirst({
              where: {
                step: question.step,
                order: question.order,
                text: question.text
              }
            });

            if (existingQuestion && options.conflictResolution !== 'overwrite') {
              questionIdMapping.set(question.id, existingQuestion.id);
              questionsSkipped++;
            } else {
              const questionData = {
                step: question.step,
                text: question.text,
                type: question.type,
                options: question.options ? JSON.stringify(question.options) : null,
                required: question.required,
                order: question.order,
                conditionalLogic: question.conditionalLogic ? JSON.stringify(question.conditionalLogic) : null,
                questionGroup: question.questionGroup,
                groupOrder: question.groupOrder || 0
              };

              if (existingQuestion) {
                await prisma.analysisQuestion.update({
                  where: { id: existingQuestion.id },
                  data: questionData
                });
                questionIdMapping.set(question.id, existingQuestion.id);
              } else {
                const newQuestion = await prisma.analysisQuestion.create({
                  data: questionData
                });
                questionIdMapping.set(question.id, newQuestion.id);
                questionsImported++;
              }
            }
          } catch (error) {
            console.error('Error importing question:', error);
            results.errors.push(`Question "${question.text}": ${error.message}`);
          }
        }

        // ADD THIS NEW SECTION - Second pass to fix conditional logic
        console.log('Updating conditional logic references...');
        let conditionalLogicUpdated = 0;

        for (const question of importData.analysisContent.questions) {
          if (question.conditionalLogic && question.conditionalLogic.showIf) {
            const oldDependentQuestionId = question.conditionalLogic.showIf.questionId;
            const newDependentQuestionId = questionIdMapping.get(oldDependentQuestionId);

            if (newDependentQuestionId) {
              // Get the new ID for this question
              const newQuestionId = questionIdMapping.get(question.id);

              if (newQuestionId) {
                try {
                  // Update the conditional logic with the new question ID reference
                  const updatedConditionalLogic = {
                    showIf: {
                      questionId: newDependentQuestionId,
                      answer: question.conditionalLogic.showIf.answer
                    }
                  };

                  await prisma.analysisQuestion.update({
                    where: { id: newQuestionId },
                    data: {
                      conditionalLogic: JSON.stringify(updatedConditionalLogic)
                    }
                  });

                  conditionalLogicUpdated++;
                } catch (error) {
                  console.error(`Error updating conditional logic for question ${question.text}:`, error);
                  results.errors.push(`Conditional logic update for "${question.text}": ${error.message}`);
                }
              }
            } else {
              console.warn(`Warning: Could not find mapping for dependent question ID ${oldDependentQuestionId}`);
              results.errors.push(`Question "${question.text}": Could not map conditional logic dependency`);
            }
          }
        }

        console.log(`Updated conditional logic for ${conditionalLogicUpdated} questions`);

        if (questionsImported > 0) results.imported.analysisQuestions = `${questionsImported} questions imported`;
        if (questionsSkipped > 0) results.skipped.analysisQuestions = `${questionsSkipped} questions skipped`;
        if (conditionalLogicUpdated > 0) {
          results.imported.analysisQuestions += ` (${conditionalLogicUpdated} conditional logic updated)`;
        }
      }

      // STEP 2: Import Master Help Topics with Enhanced Validation
      if (options.helpTopics && importData.analysisContent.masterHelpTopics) {
        console.log('Importing master help topics with enhanced validation...');
        let masterHelpTopicsImported = 0;
        let childHelpTopicsImported = 0;
        let masterHelpTopicsSkipped = 0;
        let childHelpTopicsSkipped = 0;
        let validationWarnings = [];

        for (const masterHelpTopic of importData.analysisContent.masterHelpTopics) {
          try {
            // Validate master/child structure
            const structureWarnings = validateMasterChildStructure(masterHelpTopic);
            if (structureWarnings.length > 0) {
              validationWarnings.push(...structureWarnings.map(w =>
                `Master "${masterHelpTopic.title}" - Structure: ${w}`
              ));
            }

            // Get the exported question details for validation
            const exportedQuestion = masterHelpTopic.analysisQuestion;
            if (!exportedQuestion) {
              results.errors.push(`Master help topic "${masterHelpTopic.title}": Missing question reference`);
              continue;
            }

            // Enhanced question matching with validation (pass prisma parameter)
            const matchResult = await findMatchingQuestion(exportedQuestion, questionIdMapping, prisma);

            if (!matchResult.question) {
              results.errors.push(
                `Master help topic "${masterHelpTopic.title}": No matching question found for ` +
                `${exportedQuestion.step}-${exportedQuestion.order}: "${exportedQuestion.text}"`
              );
              continue;
            }

            // Log validation confidence and warnings
            if (matchResult.confidence === 'fuzzy') {
              validationWarnings.push(
                `Master help topic "${masterHelpTopic.title}": Fuzzy match found for question. ` +
                `Expected: "${exportedQuestion.text}" | Found: "${matchResult.question.text}"`
              );
            }

            if (matchResult.confidence === 'fuzzy-cross-order') {
              validationWarnings.push(
                `Master help topic "${masterHelpTopic.title}": Cross-order fuzzy match found. ` +
                `Expected order: ${exportedQuestion.order}, Found order: ${matchResult.question.order}`
              );
            }

            if (matchResult.warning) {
              validationWarnings.push(`Master help topic "${masterHelpTopic.title}": ${matchResult.warning}`);
            }

            // Additional relationship validation
            const relationshipWarnings = validateQuestionHelpTopicRelationship(
              exportedQuestion,
              masterHelpTopic,
              matchResult.question
            );
            if (relationshipWarnings.length > 0) {
              validationWarnings.push(...relationshipWarnings.map(w =>
                `Master help topic "${masterHelpTopic.title}": ${w}`
              ));
            }

            const targetQuestionId = matchResult.question.id;

            // Check if master help topic already exists for this question
            let existingMasterHelpTopic = await prisma.masterHelpTopic.findFirst({
              where: { analysisQuestionId: targetQuestionId }
            });

            let currentMasterHelpTopicId;

            if (existingMasterHelpTopic && options.conflictResolution !== 'overwrite') {
              masterHelpTopicsSkipped++;
              currentMasterHelpTopicId = existingMasterHelpTopic.id;
            } else {
              // Validate that we're linking to the correct question
              if (existingMasterHelpTopic &&
                existingMasterHelpTopic.analysisQuestionId !== targetQuestionId) {
                results.errors.push(
                  `Master help topic "${masterHelpTopic.title}": Question mismatch detected. ` +
                  `This could indicate data corruption.`
                );
                continue;
              }

              const masterHelpTopicData = {
                analysisQuestionId: targetQuestionId,
                title: masterHelpTopic.title
              };

              if (existingMasterHelpTopic) {
                // Update existing master
                const updated = await prisma.masterHelpTopic.update({
                  where: { id: existingMasterHelpTopic.id },
                  data: masterHelpTopicData
                });
                currentMasterHelpTopicId = updated.id;
              } else {
                // Create new master
                const newMaster = await prisma.masterHelpTopic.create({
                  data: masterHelpTopicData
                });
                currentMasterHelpTopicId = newMaster.id;
                masterHelpTopicsImported++;
              }
            }

            // Import child help topics with validation
            if (masterHelpTopic.helpTopics && masterHelpTopic.helpTopics.length > 0) {
              for (const childHelpTopic of masterHelpTopic.helpTopics) {
                try {
                  // Additional validation: ensure child belongs to this master
                  if (childHelpTopic.masterHelpTopicId &&
                    childHelpTopic.masterHelpTopicId !== masterHelpTopic.id) {
                    validationWarnings.push(
                      `Child help topic "${childHelpTopic.title}": Parent reference mismatch`
                    );
                  }

                  // Validate required child topic fields
                  if (!childHelpTopic.title || childHelpTopic.title.trim() === '') {
                    results.errors.push(
                      `Child help topic in master "${masterHelpTopic.title}": Missing or empty title`
                    );
                    continue;
                  }

                  if (!childHelpTopic.videoBoxUrl && !childHelpTopic.helpDocumentUrl) {
                    validationWarnings.push(
                      `Child help topic "${childHelpTopic.title}": No video or document URL provided`
                    );
                  }

                  // Check if child help topic already exists
                  const existingChildHelpTopic = await prisma.helpTopic.findFirst({
                    where: {
                      masterHelpTopicId: currentMasterHelpTopicId,
                      title: childHelpTopic.title
                    }
                  });

                  if (existingChildHelpTopic && options.conflictResolution !== 'overwrite') {
                    childHelpTopicsSkipped++;
                  } else {
                    const childHelpTopicData = {
                      masterHelpTopicId: currentMasterHelpTopicId,
                      title: childHelpTopic.title.trim(),
                      videoBoxUrl: childHelpTopic.videoBoxUrl || '',
                      helpDocumentUrl: childHelpTopic.helpDocumentUrl || '',
                      isActive: childHelpTopic.isActive !== false, // default to true if undefined
                      order: childHelpTopic.order || 0
                    };

                    if (existingChildHelpTopic) {
                      await prisma.helpTopic.update({
                        where: { id: existingChildHelpTopic.id },
                        data: childHelpTopicData
                      });
                    } else {
                      await prisma.helpTopic.create({
                        data: childHelpTopicData
                      });
                      childHelpTopicsImported++;
                    }
                  }
                } catch (error) {
                  console.error('Error importing child help topic:', error);
                  results.errors.push(`Child help topic "${childHelpTopic.title}": ${error.message}`);
                }
              }
            }
          } catch (error) {
            console.error('Error importing master help topic:', error);
            results.errors.push(`Master help topic "${masterHelpTopic.title}": ${error.message}`);
          }
        }

        // Add validation warnings to results
        if (validationWarnings.length > 0) {
          results.warnings = validationWarnings;
        }

        if (masterHelpTopicsImported > 0) results.imported.masterHelpTopics = `${masterHelpTopicsImported} master help topics imported`;
        if (childHelpTopicsImported > 0) results.imported.childHelpTopics = `${childHelpTopicsImported} child help topics imported`;
        if (masterHelpTopicsSkipped > 0) results.skipped.masterHelpTopics = `${masterHelpTopicsSkipped} master help topics skipped`;
        if (childHelpTopicsSkipped > 0) results.skipped.childHelpTopics = `${childHelpTopicsSkipped} child help topics skipped`;
      }

      // STEP 3: Import Step Help (independent)
      if (options.stepHelp && importData.analysisContent.stepHelp) {
        console.log('Importing step help...');
        let stepHelpImported = 0;
        let stepHelpSkipped = 0;

        for (const stepHelp of importData.analysisContent.stepHelp) {
          try {
            const existingStepHelp = await prisma.stepHelp.findUnique({
              where: { step: stepHelp.step }
            });

            if (existingStepHelp && options.conflictResolution !== 'overwrite') {
              stepHelpSkipped++;
            } else {
              const stepHelpData = {
                step: stepHelp.step,
                title: stepHelp.title,
                description: stepHelp.description,
                videoBoxUrl: stepHelp.videoBoxUrl,
                helpDocumentUrl: stepHelp.helpDocumentUrl,
                isActive: stepHelp.isActive
              };

              if (existingStepHelp) {
                await prisma.stepHelp.update({
                  where: { id: existingStepHelp.id },
                  data: stepHelpData
                });
              } else {
                await prisma.stepHelp.create({
                  data: stepHelpData
                });
                stepHelpImported++;
              }
            }
          } catch (error) {
            console.error('Error importing step help:', error);
            results.errors.push(`Step help "${stepHelp.step}": ${error.message}`);
          }
        }

        if (stepHelpImported > 0) results.imported.stepHelp = `${stepHelpImported} step help imported`;
        if (stepHelpSkipped > 0) results.skipped.stepHelp = `${stepHelpSkipped} step help skipped`;
      }

      // STEP 4: Import Common Feedback (depends on questions)
      if (options.commonFeedback && importData.analysisContent.commonFeedback) {
        console.log('Importing common feedback...');
        let feedbackImported = 0;
        let feedbackSkipped = 0;

        for (const feedback of importData.analysisContent.commonFeedback) {
          try {
            // Map the question ID
            const newQuestionId = questionIdMapping.get(feedback.questionId);
            if (!newQuestionId) {
              results.errors.push(`Common feedback "${feedback.title}": Referenced question not found`);
              continue;
            }

            // Check if feedback already exists
            const existingFeedback = await prisma.commonFeedback.findFirst({
              where: {
                questionId: newQuestionId,
                title: feedback.title
              }
            });

            if (existingFeedback && options.conflictResolution !== 'overwrite') {
              feedbackSkipped++;
            } else {
              const feedbackData = {
                questionId: newQuestionId,
                title: feedback.title,
                text: feedback.text,
                isActive: feedback.isActive
              };

              if (existingFeedback) {
                await prisma.commonFeedback.update({
                  where: { id: existingFeedback.id },
                  data: feedbackData
                });
              } else {
                await prisma.commonFeedback.create({
                  data: feedbackData
                });
                feedbackImported++;
              }
            }
          } catch (error) {
            console.error('Error importing common feedback:', error);
            results.errors.push(`Common feedback "${feedback.title}": ${error.message}`);
          }
        }

        if (feedbackImported > 0) results.imported.commonFeedback = `${feedbackImported} feedback imported`;
        if (feedbackSkipped > 0) results.skipped.commonFeedback = `${feedbackSkipped} feedback skipped`;
      }
    }

    // ===== IMPORT PRACTICE CLONES =====
    if (options.practiceClones && importData.practiceClones) {
      console.log('Importing practice clones...');
      let clonesImported = 0;
      let clonesSkipped = 0;
      let answersImported = 0;

      // Import clones first
      if (importData.practiceClones.clones) {
        for (const clone of importData.practiceClones.clones) {
          try {
            const existingClone = await prisma.practiceClone.findFirst({
              where: { cloneName: clone.cloneName }
            });

            if (existingClone && options.conflictResolution !== 'overwrite') {
              practiceCloneMapping.set(clone.id, existingClone.id);
              clonesSkipped++;
            } else {
              const cloneData = {
                cloneName: clone.cloneName,
                filename: clone.filename,
                originalName: clone.originalName,
                description: clone.description,
                isActive: clone.isActive,
                uploadDate: clone.uploadDate
              };

              if (existingClone) {
                await prisma.practiceClone.update({
                  where: { id: existingClone.id },
                  data: cloneData
                });
                practiceCloneMapping.set(clone.id, existingClone.id);
              } else {
                const newClone = await prisma.practiceClone.create({
                  data: cloneData
                });
                practiceCloneMapping.set(clone.id, newClone.id);
                clonesImported++;
              }
            }
          } catch (error) {
            console.error('Error importing practice clone:', error);
            results.errors.push(`Practice clone "${clone.cloneName}": ${error.message}`);
          }
        }
      }

      // Import answers
      if (importData.practiceClones.answers) {
        for (const answer of importData.practiceClones.answers) {
          try {
            const newCloneId = practiceCloneMapping.get(answer.practiceCloneId);
            const newQuestionId = questionIdMapping.get(answer.questionId);

            if (!newCloneId || !newQuestionId) {
              results.errors.push(`Practice answer: Referenced clone or question not found`);
              continue;
            }

            // Check if answer already exists
            const existingAnswer = await prisma.practiceAnswer.findUnique({
              where: {
                practiceCloneId_questionId: {
                  practiceCloneId: newCloneId,
                  questionId: newQuestionId
                }
              }
            });

            const answerData = {
              practiceCloneId: newCloneId,
              questionId: newQuestionId,
              correctAnswer: answer.correctAnswer,
              explanation: answer.explanation
            };

            if (existingAnswer && options.conflictResolution === 'overwrite') {
              await prisma.practiceAnswer.update({
                where: { id: existingAnswer.id },
                data: answerData
              });
            } else if (!existingAnswer) {
              await prisma.practiceAnswer.create({
                data: answerData
              });
              answersImported++;
            }
          } catch (error) {
            console.error('Error importing practice answer:', error);
            results.errors.push(`Practice answer: ${error.message}`);
          }
        }
      }

      if (clonesImported > 0) results.imported.practiceClones = `${clonesImported} practice clones imported`;
      if (clonesSkipped > 0) results.skipped.practiceClones = `${clonesSkipped} practice clones skipped`;
      if (answersImported > 0) results.imported.practiceAnswers = `${answersImported} practice answers imported`;
    }

    // Generate summary
    const importedCount = Object.keys(results.imported).length;
    const errorCount = results.errors.length;

    let message = `Import completed! ${importedCount} data types imported successfully.`;
    if (errorCount > 0) {
      message += ` ${errorCount} errors occurred.`;
    }

    console.log('Import completed:', {
      imported: results.imported,
      updated: results.updated,
      skipped: results.skipped,
      errors: results.errors.length
    });

    res.json({
      success: true,
      message,
      results
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function for handling user demographics
async function handleUserDemographics(userId, demographicsData) {
  if (!demographicsData) return;

  try {
    const existingDemographics = await prisma.demographics.findUnique({
      where: { userId }
    });

    const demographicsPayload = {
      academicYear: demographicsData.academicYear,
      yearsInProgram: demographicsData.yearsInProgram,
      classesTaken: demographicsData.classesTaken ? JSON.stringify(demographicsData.classesTaken) : null,
      otherScienceCourses: demographicsData.otherScienceCourses,
      age: demographicsData.age,
      gender: demographicsData.gender,
      ethnicity: demographicsData.ethnicity,
      educationLevel: demographicsData.educationLevel,
      city: demographicsData.city,
      state: demographicsData.state,
      country: demographicsData.country
    };

    if (existingDemographics) {
      await prisma.demographics.update({
        where: { userId },
        data: demographicsPayload
      });
    } else {
      await prisma.demographics.create({
        data: {
          userId,
          ...demographicsPayload
        }
      });
    }
  } catch (error) {
    console.error('Error handling demographics for user:', userId, error);
  }
}

// ======================================
// PRACTICE CLONE BULK RE-UPLOAD SYSTEM
// Add these endpoints to your index.js
// ======================================

// Check which practice clones have missing files
// FIXED: Better missing files detection
// TEMPORARY DEBUG VERSION - Replace the missing-files endpoint with this:
// PRODUCTION VERSION - Replace the debug endpoint with this:
app.get('/api/practice-clones/missing-files', authenticateToken, requireRole(['director']), async (req, res) => {
  try {
    console.log('Checking for practice clones with missing files...');

    const practiceClones = await prisma.practiceClone.findMany({
      where: { isActive: true },
      include: {
        practiceAnswers: {
          select: { id: true }
        }
      },
      orderBy: { cloneName: 'asc' }
    });

    const missingFiles = [];
    const foundFiles = [];
    let fixedFilenames = 0;

    for (const clone of practiceClones) {
      let fileExists = false;
      let actualFilename = null;
      let checkMethod = null;

      try {
        // Method 1: Check the exact filename from database in local storage
        if (clone.filename) {
          const filePath = path.join(__dirname, 'uploads', clone.filename);

          if (fs.existsSync(filePath)) {
            fileExists = true;
            actualFilename = clone.filename;
            checkMethod = 'exact_match';
          }
        }
      } catch (error) {
        console.error(`Error checking exact filename for ${clone.cloneName}:`, error);
      }

      // Method 2: If exact filename doesn't exist, try to find similar files
      if (!fileExists) {
        try {
          console.log(`Exact filename not found for ${clone.cloneName}, searching for alternatives...`);

          const uploadsDir = path.join(__dirname, 'uploads');

          // Check if uploads directory exists
          if (fs.existsSync(uploadsDir)) {
            const allFiles = fs.readdirSync(uploadsDir);

            // Look for files that contain the original name or clone name
            const possibleMatches = allFiles.filter(filename => {
              const lowerFilename = filename.toLowerCase();
              const cloneName = clone.cloneName.toLowerCase();
              const originalName = (clone.originalName || '').toLowerCase();

              return (
                lowerFilename.includes(cloneName) ||
                (originalName && lowerFilename.includes(originalName.replace('.ab1', ''))) ||
                lowerFilename.includes(cloneName.replace(' ', '')) ||
                lowerFilename.includes(cloneName.replace(/[^a-z0-9]/g, ''))
              );
            });

            if (possibleMatches.length > 0) {
              // Take the first match (most likely candidate)
              actualFilename = possibleMatches[0];
              fileExists = true;
              checkMethod = 'fuzzy_match';

              console.log(`Found alternative file for ${clone.cloneName}: ${actualFilename}`);

              // Update the database with the correct filename
              await prisma.practiceClone.update({
                where: { id: clone.id },
                data: { filename: actualFilename }
              });

              console.log(`Updated database filename for ${clone.cloneName}`);
              fixedFilenames++;
            }
          }
        } catch (listError) {
          console.error(`Error searching for alternative files for ${clone.cloneName}:`, listError);
        }
      }

      if (fileExists) {
        foundFiles.push({
          id: clone.id,
          cloneName: clone.cloneName,
          filename: actualFilename,
          checkMethod: checkMethod
        });
      } else {
        missingFiles.push({
          id: clone.id,
          cloneName: clone.cloneName,
          filename: clone.filename,
          originalName: clone.originalName,
          description: clone.description,
          uploadDate: clone.uploadDate,
          hasAnswers: clone.practiceAnswers.length > 0,
          reason: 'File not found in local storage'
        });
      }
    }

    console.log(`File check complete:`);
    console.log(`- Found files: ${foundFiles.length}`);
    console.log(`- Missing files: ${missingFiles.length}`);
    if (fixedFilenames > 0) {
      console.log(`- Fixed filenames: ${fixedFilenames}`);
    }

    res.json({
      totalClones: practiceClones.length,
      foundFiles: foundFiles,
      missingFiles: missingFiles,
      fixedFilenames: fixedFilenames,
      hasError: missingFiles.some(f => f.error)
    });

  } catch (error) {
    console.error('Error checking missing files:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk upload and match practice clone files
app.post('/api/practice-clones/bulk-upload', upload.array('files'), authenticateToken, requireRole(['director']), async (req, res) => {
  try {
    const files = req.files;
    const manualMatches = req.body.manualMatches ? JSON.parse(req.body.manualMatches) : {};

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`Processing bulk upload of ${files.length} files`);
    console.log('Manual matches provided:', manualMatches);

    // Get practice clones that need files
    const practiceClones = await prisma.practiceClone.findMany({
      where: { isActive: true },
      select: { id: true, cloneName: true, filename: true, originalName: true }
    });

    const results = {
      uploaded: [],
      matched: [],
      unmatched: [],
      errors: []
    };

    // Function to calculate filename similarity
    const calculateSimilarity = (str1, str2) => {
      const a = str1.toLowerCase();
      const b = str2.toLowerCase();

      // Exact match
      if (a === b) return 1.0;

      // Check if one contains the other
      if (a.includes(b) || b.includes(a)) return 0.8;

      // Levenshtein distance similarity
      const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));

      for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
      for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

      for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
          if (a[i - 1] === b[j - 1]) {
            matrix[j][i] = matrix[j - 1][i - 1];
          } else {
            matrix[j][i] = Math.min(
              matrix[j - 1][i - 1] + 1,
              matrix[j][i - 1] + 1,
              matrix[j - 1][i] + 1
            );
          }
        }
      }

      const maxLen = Math.max(a.length, b.length);
      return (maxLen - matrix[b.length][a.length]) / maxLen;
    };

    // Process each uploaded file
    for (const file of files) {
      try {
        const fileBaseName = file.originalname.replace(/\.[^/.]+$/, ''); // Remove extension
        let matchedClone = null;

        // Check for manual match first
        if (manualMatches[file.originalname]) {
          const cloneId = parseInt(manualMatches[file.originalname]);
          matchedClone = practiceClones.find(c => c.id === cloneId);

          if (matchedClone) {
            console.log(`Manual match: ${file.originalname} → ${matchedClone.cloneName}`);
          }
        }

        // If no manual match, try auto-matching
        if (!matchedClone) {
          let bestMatch = null;
          let bestSimilarity = 0;

          for (const clone of practiceClones) {
            // Try matching against different name variations
            const namesToTry = [
              clone.cloneName,
              clone.originalName,
              clone.filename.replace(/\.[^/.]+$/, '') // filename without extension
            ].filter(Boolean);

            for (const name of namesToTry) {
              const similarity = calculateSimilarity(fileBaseName, name);
              if (similarity > bestSimilarity && similarity > 0.6) { // 60% similarity threshold
                bestSimilarity = similarity;
                bestMatch = clone;
              }
            }
          }

          if (bestMatch) {
            matchedClone = bestMatch;
            console.log(`Auto-match: ${file.originalname} → ${matchedClone.cloneName} (${Math.round(bestSimilarity * 100)}% similarity)`);
          }
        }

        if (matchedClone) {
          // Upload file to S3 with the practice clone's expected filename
          const key = matchedClone.filename;

          const filePath = path.join(__dirname, 'uploads', matchedClone.filename);
          fs.writeFileSync(filePath, file.buffer);
          console.log('Saved file locally:', filePath);

          // Update the practice clone record if needed
          await prisma.practiceClone.update({
            where: { id: matchedClone.id },
            data: {
              // Keep existing filename, just ensure file exists in S3
              updatedAt: new Date()
            }
          });

          results.uploaded.push({
            filename: file.originalname,
            cloneName: matchedClone.cloneName,
            cloneId: matchedClone.id,
            s3Key: key,
            matchType: manualMatches[file.originalname] ? 'manual' : 'auto'
          });

          results.matched.push(matchedClone.id);

        } else {
          results.unmatched.push({
            filename: file.originalname,
            reason: 'No matching practice clone found'
          });
        }

      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
        results.errors.push({
          filename: file.originalname,
          error: error.message
        });
      }
    }

    console.log('Bulk upload results:', {
      uploaded: results.uploaded.length,
      unmatched: results.unmatched.length,
      errors: results.errors.length
    });

    res.json({
      message: `Bulk upload completed. ${results.uploaded.length} files uploaded successfully.`,
      results
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get suggested matches for unmatched files
app.post('/api/practice-clones/suggest-matches', authenticateToken, requireRole(['director']), async (req, res) => {
  try {
    const { filenames } = req.body;

    const practiceClones = await prisma.practiceClone.findMany({
      where: { isActive: true },
      select: { id: true, cloneName: true, originalName: true, filename: true }
    });

    const suggestions = {};

    filenames.forEach(filename => {
      const fileBaseName = filename.replace(/\.[^/.]+$/, '');
      const matches = [];

      practiceClones.forEach(clone => {
        const namesToTry = [
          clone.cloneName,
          clone.originalName,
          clone.filename.replace(/\.[^/.]+$/, '')
        ].filter(Boolean);

        let bestSimilarity = 0;
        namesToTry.forEach(name => {
          const similarity = calculateSimilarity(fileBaseName, name);
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
          }
        });

        if (bestSimilarity > 0.3) { // Lower threshold for suggestions
          matches.push({
            id: clone.id,
            cloneName: clone.cloneName,
            similarity: Math.round(bestSimilarity * 100)
          });
        }
      });

      // Sort by similarity
      matches.sort((a, b) => b.similarity - a.similarity);
      suggestions[filename] = matches.slice(0, 5); // Top 5 suggestions
    });

    res.json(suggestions);

  } catch (error) {
    console.error('Error generating suggestions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function for similarity calculation (same as above)
function calculateSimilarity(str1, str2) {
  const a = str1.toLowerCase();
  const b = str2.toLowerCase();

  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) return 0.8;

  const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i - 1] + 1,
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1
        );
      }
    }
  }

  const maxLen = Math.max(a.length, b.length);
  return (maxLen - matrix[b.length][a.length]) / maxLen;
}

app.get('/api/schools/public', async (req, res) => {
  try {
    console.log('=== PUBLIC SCHOOLS ENDPOINT HIT ===');

    const schools = await prisma.school.findMany({
      select: {
        id: true,
        name: true,
        schoolId: true,
        // Only return basic info, no sensitive data
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log('Found schools for registration:', schools.length);
    res.json(schools);
  } catch (error) {
    console.log('=== PUBLIC SCHOOLS ERROR ===', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students/with-progress', authenticateToken, requireRole(['director', 'instructor']), async (req, res) => {
  try {
    //console.log('=== OPTIMIZED STUDENTS WITH PROGRESS ENDPOINT ===');

    // Step 1: Get all approved students (same as original)
    const students = await prisma.user.findMany({
      where: {
        role: 'student',
        status: 'approved'
      },
      include: {
        school: {
          select: {
            id: true,
            name: true,
            instructor: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    //console.log('✓ Students fetched:', students.length);

    // Step 2: Get active practice clones (same as original)
    const allPracticeClones = await prisma.practiceClone.findMany({
      where: {
        isActive: true
      }
    });

    //console.log('✓ Active practice clones:', allPracticeClones.length);

    // Step 3: OPTIMIZED - Get all progress in one query instead of N queries
    const allProgressRecords = await prisma.userPracticeProgress.findMany({
      select: {
        userId: true,
        practiceCloneId: true,
        progress: true,
        reviewScore: true
      }
    });

    //console.log('✓ All progress records fetched:', allProgressRecords.length);

    // Step 4: Process students with their progress data (optimized lookup)
    const studentsWithProgress = students.map(student => {
      const practiceProgress = [];
      const practiceCloneData = [];

      // For each active practice clone, find this student's progress
      allPracticeClones.forEach(clone => {
        // Find progress record for this student-clone combination
        const progressRecord = allProgressRecords.find(record =>
          record.userId === student.id && record.practiceCloneId === clone.id
        );

        const progress = progressRecord?.progress || 0;
        const reviewScore = progressRecord?.reviewScore || 0; // ADD THIS

        practiceProgress.push(progress);
        practiceCloneData.push({
          id: clone.id,
          name: clone.cloneName,
          progress: progress,
          reviewScore: reviewScore  // ADD THIS
        });
      });

      return {
        id: student.id,
        name: student.name,
        email: student.email,
        school: student.school?.name || 'No School Assigned',
        instructor: student.school?.instructor || 'Unassigned',
        practiceProgress,
        practiceCloneData
      };
    });

    //console.log('✓ Students with progress processed:', studentsWithProgress.length);

    res.json({
      students: studentsWithProgress,
      metadata: {
        totalStudents: studentsWithProgress.length,
        activePracticeClones: allPracticeClones.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('=== ERROR IN STUDENTS WITH PROGRESS ===');
    console.error('Error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to fetch students with progress',
      details: error.message
    });
  }
});


// OPTIONAL: Add pagination support for extremely large datasets
app.get('/api/students/with-progress/paginated', authenticateToken, requireRole(['director']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';

    const offset = (page - 1) * limit;

    console.log(`=== PAGINATED STUDENTS ENDPOINT (page ${page}, limit ${limit}) ===`);

    // Build where clause for search
    const whereClause = {
      role: 'student',
      status: 'approved'
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { school: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Get total count for pagination
    const totalCount = await prisma.user.count({ where: whereClause });

    // Get paginated students
    const students = await prisma.user.findMany({
      where: whereClause,
      include: {
        school: {
          select: {
            id: true,
            name: true,
            instructor: true
          }
        }
      },
      orderBy: { name: 'asc' },
      skip: offset,
      take: limit
    });

    // Get active practice clones (same as before)
    const activePracticeClones = await prisma.practiceClone.findMany({
      where: { isActive: true },
      select: { id: true, cloneName: true, originalName: true },
      orderBy: { id: 'asc' }
    });

    // Get progress records for these specific students only
    const studentIds = students.map(s => s.id);
    const progressRecords = await prisma.userPracticeProgress.findMany({
      where: {
        userId: { in: studentIds }
      },
      select: {
        userId: true,
        practiceCloneId: true,
        progress: true
      }
    });

    // Create progress lookup
    const progressLookup = new Map();
    progressRecords.forEach(record => {
      const key = `${record.userId}-${record.practiceCloneId}`;
      progressLookup.set(key, record.progress || 0);
    });

    // Process students with progress
    const studentsWithProgress = students.map(student => {
      const practiceProgress = [];
      const practiceCloneData = [];

      activePracticeClones.forEach(clone => {
        const lookupKey = `${student.id}-${clone.id}`;
        const progress = progressLookup.get(lookupKey) || 0;

        practiceProgress.push(progress);
        practiceCloneData.push({
          id: clone.id,
          name: clone.cloneName,
          progress: progress
        });
      });

      return {
        id: student.id,
        name: student.name,
        email: student.email,
        school: student.school?.name || 'No School Assigned',
        instructor: student.school?.instructor || 'Unassigned',
        practiceProgress,
        practiceCloneData
      };
    });

    res.json({
      students: studentsWithProgress,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNextPage: offset + limit < totalCount,
        hasPrevPage: page > 1
      },
      metadata: {
        activePracticeClones: activePracticeClones.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('=== ERROR IN PAGINATED STUDENTS ===');
    console.error('Error:', error);
    res.status(500).json({
      error: 'Failed to fetch paginated students',
      details: error.message
    });
  }
});

// ======================================
// Help Topics API endpoints
// ======================================

// Get ALL master help topics
app.get('/api/master-help-topics', async (req, res) => {
  try {
    const masterHelpTopics = await prisma.masterHelpTopic.findMany({
      include: {
        helpTopics: {
          where: { isActive: true },
          orderBy: { order: 'asc' }
        },
        analysisQuestion: {
          select: { id: true, text: true, step: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(masterHelpTopics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ALL master step helps
app.get('/api/master-step-helps', async (req, res) => {
  try {
    const masterStepHelps = await prisma.masterStepHelp.findMany({
      include: {
        stepHelps: {
          where: { isActive: true },
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { step: 'asc' }
    });
    res.json(masterStepHelps);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get master help topic with all its child topics
app.get('/api/master-help-topics/:questionId', async (req, res) => {
  try {
    const { questionId } = req.params;
    const masterHelpTopic = await prisma.masterHelpTopic.findUnique({
      where: { analysisQuestionId: questionId },
      include: {
        helpTopics: {
          where: { isActive: true },
          orderBy: { order: 'asc' }
        }
      }
    });
    res.json(masterHelpTopic);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get master step help with all its child topics  
app.get('/api/master-step-help/:step', async (req, res) => {
  try {
    const { step } = req.params;
    const masterStepHelp = await prisma.masterStepHelp.findUnique({
      where: { step },
      include: {
        stepHelps: {
          where: { isActive: true },
          orderBy: { order: 'asc' }
        }
      }
    });
    res.json(masterStepHelp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Create master help topic
app.post('/api/master-help-topics', async (req, res) => {
  try {
    const { analysisQuestionId, title } = req.body;
    const masterHelpTopic = await prisma.masterHelpTopic.create({
      data: {
        analysisQuestionId,
        title
      },
      include: {
        helpTopics: {
          where: { isActive: true },
          orderBy: { order: 'asc' }
        },
        analysisQuestion: {
          select: { id: true, text: true, step: true }
        }
      }
    });
    res.json(masterHelpTopic);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update master help topic
app.put('/api/master-help-topics/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const masterHelpTopic = await prisma.masterHelpTopic.update({
      where: { id },
      data: { title },
      include: {
        helpTopics: {
          where: { isActive: true },
          orderBy: { order: 'asc' }
        },
        analysisQuestion: {
          select: { id: true, text: true, step: true }
        }
      }
    });
    res.json(masterHelpTopic);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete master help topic
app.delete('/api/master-help-topics/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.masterHelpTopic.delete({
      where: { id }
    });
    res.json({ message: 'Master help topic deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Create master step help
app.post('/api/master-step-helps', async (req, res) => {
  try {
    const { step, title, description } = req.body;
    const masterStepHelp = await prisma.masterStepHelp.create({
      data: {
        step,
        title,
        description
      },
      include: {
        stepHelps: {
          where: { isActive: true },
          orderBy: { order: 'asc' }
        }
      }
    });
    res.json(masterStepHelp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update master step help
app.put('/api/master-step-helps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const masterStepHelp = await prisma.masterStepHelp.update({
      where: { id },
      data: { title, description },
      include: {
        stepHelps: {
          where: { isActive: true },
          orderBy: { order: 'asc' }
        }
      }
    });
    res.json(masterStepHelp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete master step help
app.delete('/api/master-step-helps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.masterStepHelp.delete({
      where: { id }
    });
    res.json({ message: 'Master step help deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update the existing help-topics POST to work with new schema
app.post('/api/help-topics', async (req, res) => {
  try {
    const { masterHelpTopicId, title, description, videoBoxUrl, helpDocumentUrl, order } = req.body;
    const helpTopic = await prisma.helpTopic.create({
      data: {
        masterHelpTopicId,
        title,
        description,
        videoBoxUrl,
        helpDocumentUrl,
        order: order || 0
      }
    });
    res.json(helpTopic);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update the existing step-helps POST to work with new schema
app.post('/api/step-helps', async (req, res) => {
  try {
    const { masterStepHelpId, title, description, videoBoxUrl, helpDocumentUrl, order } = req.body;
    const stepHelp = await prisma.stepHelp.create({
      data: {
        masterStepHelpId,
        title,
        description,
        videoBoxUrl,
        helpDocumentUrl,
        order: order || 0
      }
    });
    res.json(stepHelp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update help topic
app.put('/api/help-topics/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const helpTopic = await prisma.helpTopic.update({
      where: { id },
      data: updates
    });
    res.json(helpTopic);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update step help
app.put('/api/step-helps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const stepHelp = await prisma.stepHelp.update({
      where: { id },
      data: updates
    });
    res.json(stepHelp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/help-topics', async (req, res) => {
  try {
    const helpTopics = await prisma.helpTopic.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(helpTopics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/help-topics', async (req, res) => {
  try {
    const { analysisQuestionId, title, videoBoxUrl, helpDocumentUrl } = req.body;
    const helpTopic = await prisma.helpTopic.create({
      data: {
        analysisQuestionId,
        title,
        videoBoxUrl,
        helpDocumentUrl
      }
    });
    res.json(helpTopic);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/help-topics/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const helpTopic = await prisma.helpTopic.update({
      where: { id },
      data: updates
    });
    res.json(helpTopic);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/help-topics/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.helpTopic.delete({
      where: { id }
    });
    res.json({ message: 'Help topic deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific help topic by ID
// Modified existing endpoint to handle both HelpTopic and StepHelp
app.get('/api/help-topics/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First try to find in HelpTopic (question-specific help)
    let helpContent = await prisma.helpTopic.findUnique({
      where: { id },
      include: {
        analysisQuestion: {
          select: {
            id: true,
            text: true,
            step: true
          }
        }
      }
    });

    // If not found, try StepHelp (step-level background help)
    if (!helpContent) {
      helpContent = await prisma.stepHelp.findUnique({
        where: { id }
      });

      if (helpContent) {
        // Add flags to indicate this is step help
        helpContent.isStepHelp = true;
        helpContent.stepName = helpContent.step;
      }
    }

    if (!helpContent) {
      return res.status(404).json({ error: 'Help topic not found' });
    }

    res.json(helpContent);
  } catch (error) {
    console.error('Error fetching help topic:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get help topic for specific analysis question
app.get('/api/help-topics/question/:questionId', async (req, res) => {
  try {
    const { questionId } = req.params;
    const helpTopic = await prisma.helpTopic.findFirst({
      where: {
        analysisQuestionId: questionId,
        isActive: true
      }
    });
    res.json(helpTopic);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if student qualifies for claiming new clones (all active practice clones have score 100)
app.get('/api/students/:userId/clone-qualification', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get all active practice clones
    const activePracticeClones = await prisma.practiceClone.findMany({
      where: { isActive: true }
    });

    if (activePracticeClones.length === 0) {
      return res.json({ qualifies: false, reason: 'No active practice clones' });
    }

    // Get user's progress on all active practice clones
    const userProgress = await prisma.userPracticeProgress.findMany({
      where: {
        userId: parseInt(userId),
        practiceCloneId: { in: activePracticeClones.map(clone => clone.id) }
      }
    });

    // Check if user has perfect scores on ALL active practice clones
    const allPerfectScores = activePracticeClones.every(clone => {
      const progress = userProgress.find(p => p.practiceCloneId === clone.id);
      return progress && progress.reviewScore === 100;
    });

    res.json({
      qualifies: allPerfectScores,
      activeClonesCount: activePracticeClones.length,
      perfectScoresCount: userProgress.filter(p => p.reviewScore === 100).length,
      reason: allPerfectScores ? 'All active practice clones completed with perfect scores' : 'Not all practice clones have perfect scores'
    });

  } catch (error) {
    console.error('Error checking clone qualification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get unassigned research clones from DirectorCloneLibrary
app.get('/api/students/:userId/unassigned-clones', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('Fetching unassigned research clones for user:', userId);

    // Get all uploaded files that are unassigned
    const unassignedClones = await prisma.uploadedFile.findMany({
      where: {
        OR: [
          { status: CLONE_STATUSES.UNASSIGNED },
          { assignedToId: null }
        ]
      },
      orderBy: { cloneName: 'asc' },
      include: {
        uploadedBy: {
          select: { id: true, name: true }
        }
      }
    });

    console.log('Total unassigned research clones found:', unassignedClones.length);
    res.json(unassignedClones);

  } catch (error) {
    console.error('Error fetching unassigned research clones:', error);
    res.status(500).json({ error: error.message });
  }
});

// Claim a research clone (assign it to student)
app.post('/api/students/:userId/claim-clone/:cloneId', async (req, res) => {
  try {
    const { userId, cloneId } = req.params;
    console.log('Student', userId, 'attempting to claim research clone', cloneId);

    // Check if student qualifies first (perfect scores on all active practice clones)
    const activePracticeClones = await prisma.practiceClone.findMany({
      where: { isActive: true }
    });

    const userProgress = await prisma.userPracticeProgress.findMany({
      where: {
        userId: parseInt(userId),
        practiceCloneId: { in: activePracticeClones.map(clone => clone.id) }
      }
    });

    const allPerfectScores = activePracticeClones.every(clone => {
      const progress = userProgress.find(p => p.practiceCloneId === clone.id);
      return progress && progress.reviewScore === 100;
    });

    if (!allPerfectScores) {
      return res.status(403).json({
        error: 'Student does not qualify to claim new clones',
        reason: 'Not all active practice clones have perfect scores'
      });
    }

    // Check if clone exists and is unassigned
    const clone = await prisma.uploadedFile.findUnique({
      where: { id: parseInt(cloneId) },
      include: {
        assignedTo: { select: { name: true } }
      }
    });

    if (!clone) {
      return res.status(404).json({ error: 'Research clone not found' });
    }

    if (clone.assignedToId || clone.status !== CLONE_STATUSES.UNASSIGNED) {
      return res.status(400).json({
        error: 'Clone is already assigned',
        assignedTo: clone.assignedTo?.name
      });
    }

    // Assign the clone to the student
    const updatedClone = await prisma.uploadedFile.update({
      where: { id: parseInt(cloneId) },
      data: {
        assignedToId: parseInt(userId),
        status: CLONE_STATUSES.BEING_WORKED_ON,
        progress: 0
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            school: { select: { name: true } }
          }
        }
      }
    });

    res.json({
      success: true,
      message: `Successfully claimed ${clone.cloneName}`,
      clone: updatedClone
    });

  } catch (error) {
    console.error('Error claiming research clone:', error);
    res.status(500).json({ error: error.message });
  }
});



// Forgot password endpoint - ADD THIS
// Forgot password endpoint with Railway support
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    console.log('=== FORGOT PASSWORD REQUEST ===');
    console.log('Email:', email);
    console.log('Environment check - EMAIL_USER:', process.env.EMAIL_USER);
    console.log('Environment check - SENDGRID_API_KEY exists:', !!process.env.SENDGRID_API_KEY);
    console.log('Environment check - FRONTEND_URL:', process.env.FRONTEND_URL);
    console.log('Request headers - Origin:', req.headers.origin);
    console.log('Request headers - Host:', req.headers.host);

    // Basic validation
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if SendGrid is configured
    if (!process.env.SENDGRID_API_KEY || !process.env.EMAIL_USER) {
      console.error('SendGrid not configured');
      return res.status(500).json({ error: 'Email service not available' });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.log('User not found, sending generic response');
      return res.json({ message: 'If an account exists with this email, you will receive reset instructions.' });
    }

    console.log('User found:', user.name);

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    console.log('Generated reset token:', resetToken.substring(0, 10) + '...');

    // Save token to database
    console.log('Saving token to database...');
    await prisma.user.update({
      where: { email },
      data: {
        resetToken,
        resetTokenExpiry
      }
    });
    console.log('Token saved to database successfully');

    // Generate frontend URL
    let frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      const origin = req.headers.origin;
      const host = req.headers.host;
      if (origin) {
        frontendUrl = origin;
      } else if (host && !host.includes('localhost')) {
        frontendUrl = `https://${host}`;
      } else {
        frontendUrl = 'http://localhost:3000';
      }
    }
    frontendUrl = frontendUrl.replace(/\/$/, '');

    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    console.log('Final reset URL:', resetUrl);

    console.log('Attempting to send email via SendGrid Web API...');
    console.log('From:', process.env.EMAIL_USER);
    console.log('To:', email);

    // Send email using SendGrid Web API
    const msg = {
      to: email,
      from: process.env.EMAIL_USER, // Must be verified in SendGrid
      subject: 'Password Reset Request - DNA Analysis Program',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3B82F6;">Password Reset Request</h2>
          <p>You requested a password reset for your account.</p>
          <p>Click the link below to reset your password (expires in 1 hour):</p>
          <div style="margin: 20px 0;">
            <a href="${resetUrl}" 
               style="background-color: #3B82F6; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">
            <a href="${resetUrl}" style="color: #3B82F6;">${resetUrl}</a>
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            If you didn't request this password reset, please ignore this email. 
            Your password will remain unchanged.
          </p>
        </div>
      `
    };

    await sgMail.send(msg);

    console.log('Email sent successfully via SendGrid Web API!');
    res.json({ message: 'If an account exists with this email, you will receive reset instructions.' });

  } catch (error) {
    console.error('=== FORGOT PASSWORD ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);

    // SendGrid-specific error handling
    let errorMessage = 'Error processing request';

    if (error.code === 401) {
      errorMessage = 'SendGrid authentication failed. Check API key.';
    } else if (error.code === 403) {
      errorMessage = 'SendGrid access forbidden. Check sender verification.';
    } else if (error.response?.body?.errors) {
      errorMessage = `SendGrid error: ${error.response.body.errors[0].message}`;
    }

    res.status(500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add this test endpoint to your index.js
app.get('/api/test-email', async (req, res) => {
  try {
    console.log('Testing email connection...');
    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    console.log('EMAIL_PASSWORD exists:', !!process.env.EMAIL_PASSWORD);

    // Test connection
    const testResult = await emailTransporter.verify();
    console.log('Email connection successful:', testResult);

    res.json({
      success: true,
      message: 'Email connection working',
      emailUser: process.env.EMAIL_USER
    });
  } catch (error) {
    console.error('Email connection failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

// Reset password endpoint - ADD THIS
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// BLAST search endpoint with proper NCBI integration
// BLAST search endpoint with proper NCBI integration and polling support
// BLAST search endpoint with proper NCBI integration and polling support
app.post('/api/blast-search/:fileId/:questionId', async (req, res) => {
  try {
    const { fileId, questionId } = req.params;
    const { sequence, database = 'nt', program = 'blastn', forceRefresh = false } = req.body;

    console.log('=== BLAST SEARCH REQUEST ===');
    console.log('File ID:', fileId);
    console.log('Question ID:', questionId);
    console.log('Program:', program);
    console.log('Database requested:', database);
    console.log('Sequence length:', sequence?.length);
    console.log('Force refresh:', forceRefresh);
    console.log('Timestamp:', new Date().toISOString());

    const actualDatabase = getAppropriateDatabase(program, database);
    console.log('Actual database to use:', actualDatabase);

    // Get current file data
    const file = await prisma.uploadedFile.findUnique({
      where: { id: parseInt(fileId) }
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Parse existing analysis data
    let analysisData = {};
    try {
      analysisData = JSON.parse(file.analysisData || '{}');
    } catch (e) {
      analysisData = {};
    }

    // Initialize cached results if not exists
    if (!analysisData.cachedBlastResults) {
      analysisData.cachedBlastResults = {};
    }



    // Handle polling requests (when frontend is checking for completed results)
    if (!forceRefresh && (!sequence || sequence === "dummy" || sequence.length < 10)) {
      console.log('This is a polling request, checking for cached results...');

      // For polling, look for ANY cached results for this question that are completed or have errors
      const cachedResults = analysisData.cachedBlastResults || {};

      // Find any completed results for this question (regardless of exact parameters)
      if (!forceRefresh && (!sequence || sequence === "dummy" || sequence.length < 10)) {
        console.log('This is a polling request, checking for cached results...');

        // The frontend should send the actual sequence even during polling
        // If sequence is "dummy", we can't determine the correct cache key
        // Return no results and let frontend handle properly
        if (sequence === "dummy") {
          console.log('Polling with dummy sequence - frontend should send real sequence');
          return res.json({
            status: 'no_results',
            message: 'Polling requires actual sequence for parameter-specific caching'
          });
        }

        // For other short sequences, treat as error
        return res.json({
          status: 'no_results',
          message: 'Sequence too short for analysis'
        });
      }

      if (completedEntries.length > 0) {
        const [cacheKey, completedResult] = completedEntries[0];
        console.log('Found completed result for polling request:', cacheKey);
        return res.json({ ...completedResult, fromCache: true });
      }

      // Check for pending operations
      const pendingEntries = Object.entries(cachedResults).filter(([key, value]) =>
        key.startsWith(questionId + '_') && value.status === 'pending'
      );

      if (pendingEntries.length > 0) {
        const [cacheKey, pendingResult] = pendingEntries[0];
        console.log('Found pending result for polling request:', cacheKey);

        // Check if it's still recent (less than 10 minutes old)
        const pendingTime = new Date() - new Date(pendingResult.searchedAt);
        if (pendingTime < 600000) { // 10 minutes
          return res.json({ status: 'pending', message: 'BLAST search still in progress' });
        } else {
          console.log('Found stale pending search, considering it failed');
          return res.json({ status: 'no_results', message: 'Previous search timed out, please try again' });
        }
      }

      // Check for error results
      const errorEntries = Object.entries(cachedResults).filter(([key, value]) =>
        key.startsWith(questionId + '_') && value.status === 'error'
      );

      if (errorEntries.length > 0) {
        const [cacheKey, errorResult] = errorEntries[0];
        console.log('Found error result for polling request:', cacheKey);
        return res.json({ ...errorResult });
      }

      // No cached results found at all
      console.log('No cached results found for polling request');
      return res.json({ status: 'no_results', message: 'No BLAST search initiated yet' });
    }

    // For actual searches with real sequence, validate first
    if (!sequence || sequence.length < 10) {
      return res.status(400).json({
        error: 'Sequence too short for BLAST analysis (minimum 10 bp)',
        status: 'error'
      });
    }

    // Generate proper cache key for exact parameter matching
    const sequenceHash = crypto.createHash('md5').update(sequence).digest('hex').substring(0, 12);
    const cacheKey = `${questionId}_${sequenceHash}_${program}_${actualDatabase}`;
    console.log('Generated cache key:', cacheKey);

    // Check for EXACT cache match (not just any cache for this question)
    const exactCachedResult = analysisData.cachedBlastResults[cacheKey];
    if (!forceRefresh && exactCachedResult && exactCachedResult.status === 'completed') {
      console.log('Returning exact cached BLAST results for', cacheKey);
      return res.json({
        ...exactCachedResult,
        fromCache: true
      });
    }

    // Check if there's a pending search for this EXACT parameter combination
    if (!forceRefresh && exactCachedResult && exactCachedResult.status === 'pending') {
      const pendingTime = new Date() - new Date(exactCachedResult.searchedAt);
      if (pendingTime < 300000) { // Less than 5 minutes old
        console.log('Found recent pending search for exact parameters, returning pending status');
        return res.json({
          ...exactCachedResult,
          fromCache: false
        });
      } else {
        console.log('Found stale pending search for exact parameters, will restart');
        // Continue to start new search below
      }
    }

    // Check for error status on this exact parameter combination
    if (!forceRefresh && exactCachedResult && exactCachedResult.status === 'error') {
      console.log('Found previous error for exact parameters, returning error');
      return res.json({
        ...exactCachedResult,
        fromCache: true
      });
    }

    console.log('Starting new BLAST search...');

    // Mark as pending for this exact parameter combination
    analysisData.cachedBlastResults[cacheKey] = {
      sequence: sequence.substring(0, 100) + (sequence.length > 100 ? '...' : ''),
      sequenceLength: sequence.length,
      status: 'pending',
      searchedAt: new Date().toISOString(),
      database: actualDatabase,
      program
    };

    // Save pending status
    await prisma.uploadedFile.update({
      where: { id: parseInt(fileId) },
      data: { analysisData: JSON.stringify(analysisData) }
    });

    // Send immediate response for pending status
    res.json({
      ...analysisData.cachedBlastResults[cacheKey],
      fromCache: false
    });

    // Perform BLAST search asynchronously
    console.log('Starting asynchronous BLAST search with NCBI...');
    performNCBIBlastSearch(sequence, actualDatabase, program)
      .then(async (blastResults) => {
        console.log('BLAST search completed successfully! Got', blastResults.length, 'results');

        // Re-fetch current analysis data (in case it was updated elsewhere)
        const currentFile = await prisma.uploadedFile.findUnique({
          where: { id: parseInt(fileId) }
        });

        let currentAnalysisData = {};
        try {
          currentAnalysisData = JSON.parse(currentFile.analysisData || '{}');
        } catch (e) {
          currentAnalysisData = {};
        }

        if (!currentAnalysisData.cachedBlastResults) {
          currentAnalysisData.cachedBlastResults = {};
        }

        // Update cache with results
        currentAnalysisData.cachedBlastResults[cacheKey] = {
          sequence: sequence.substring(0, 100) + (sequence.length > 100 ? '...' : ''),
          sequenceLength: sequence.length,
          results: blastResults,
          status: 'completed',
          searchedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          database: actualDatabase,
          program,
          resultCount: blastResults.length
        };

        // Save results to database
        await prisma.uploadedFile.update({
          where: { id: parseInt(fileId) },
          data: { analysisData: JSON.stringify(currentAnalysisData) }
        });

        console.log('BLAST results cached successfully with key:', cacheKey);
      })
      .catch(async (error) => {
        console.error('BLAST search failed:', error);
        console.error('Error details:', error.message);

        try {
          // Re-fetch current analysis data
          const currentFile = await prisma.uploadedFile.findUnique({
            where: { id: parseInt(fileId) }
          });

          let currentAnalysisData = {};
          try {
            currentAnalysisData = JSON.parse(currentFile.analysisData || '{}');
          } catch (e) {
            currentAnalysisData = {};
          }

          if (!currentAnalysisData.cachedBlastResults) {
            currentAnalysisData.cachedBlastResults = {};
          }

          // Mark as error
          currentAnalysisData.cachedBlastResults[cacheKey] = {
            sequence: sequence.substring(0, 100) + (sequence.length > 100 ? '...' : ''),
            sequenceLength: sequence.length,
            status: 'error',
            error: error.message,
            searchedAt: new Date().toISOString(),
            failedAt: new Date().toISOString(),
            database: actualDatabase,
            program
          };

          await prisma.uploadedFile.update({
            where: { id: parseInt(fileId) },
            data: { analysisData: JSON.stringify(currentAnalysisData) }
          });

          console.log('BLAST error status cached with key:', cacheKey);
        } catch (dbError) {
          console.error('Failed to save BLAST error status:', dbError);
        }
      });

  } catch (error) {
    console.error('BLAST endpoint error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: error.message,
      status: 'error',
      details: 'Check server console for more details'
    });
  }
});

// Get Data for Report Export
app.get('/api/students/export-data', authenticateToken, requireRole(['director']), async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: {
        role: 'student',
        status: 'approved'
      },
      include: {
        school: { select: { name: true, instructor: true } },
        demographics: true,
        loginLogs: { select: { id: true } },
        assignedFiles: {
          select: { id: true, cloneName: true, status: true, progress: true }
        }
      }
    });

    // Get practice progress data
    const practiceClones = await prisma.practiceClone.findMany({
      where: { isActive: true }
    });

    const allPracticeProgress = await prisma.userPracticeProgress.findMany({
      select: {
        userId: true,
        practiceCloneId: true,
        progress: true,
        reviewScore: true
      }
    });

    // Format for export
    const exportData = students.map(student => {
      // Calculate practice progress for this student
      const practiceProgress = [];
      const practiceCloneData = [];

      practiceClones.forEach(clone => {
        const progressRecord = allPracticeProgress.find(record =>
          record.userId === student.id && record.practiceCloneId === clone.id
        );

        const progress = progressRecord?.progress || 0;
        const reviewScore = progressRecord?.reviewScore || 0;

        practiceProgress.push(progress);
        practiceCloneData.push({
          id: clone.id,
          name: clone.cloneName,
          progress: progress,
          reviewScore: reviewScore
        });
      });

      return {
        id: student.id,
        name: student.name,
        email: student.email,
        school: student.school?.name || 'No School Assigned',
        instructor: student.school?.instructor || 'Unassigned',
        createdAt: student.createdAt,
        loginCount: student.loginLogs.length,

        // Research clone data
        researchAssignments: student.assignedFiles,
        researchClonesAssigned: student.assignedFiles.length,
        researchClonesCompleted: student.assignedFiles.filter(
          a => a.status === 'reviewed_correct' || a.progress === 100
        ).length,

        // Practice clone data
        practiceProgress,
        practiceCloneData,
        completedAssignments: practiceCloneData.filter(p => p.progress === 100).length,

        // Demographics data
        demographics: student.demographics
      };
    });

    res.json(exportData);
  } catch (error) {
    console.error('Error fetching export data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:id/demographics', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const demographics = await prisma.demographics.findUnique({
      where: { userId: parseInt(id) }
    });
    res.json(demographics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Bug Report Endpoints
// ==========================================

// Updated GET endpoint for bug reports with sorting
app.get('/api/bug-reports', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'director') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { status, urgency, page = 1, limit = 20, sortBy = 'created', sortOrder = 'desc' } = req.query;

    const where = {};
    if (status && status !== 'all') where.status = status;
    if (urgency && urgency !== 'all') where.urgency = urgency;

    // Build orderBy based on sortBy parameter
    let orderBy = [];

    switch (sortBy) {
      case 'created':
        orderBy.push({ createdAt: sortOrder });
        break;

      case 'urgency':
        // For urgency, we need custom ordering since it's a string
        if (sortOrder === 'desc') {
          // High -> Medium -> Low
          orderBy.push({ urgency: 'desc' });
        } else {
          // Low -> Medium -> High
          orderBy.push({ urgency: 'asc' });
        }
        // Add secondary sort by creation date
        orderBy.push({ createdAt: 'desc' });
        break;

      case 'status':
        orderBy.push({ status: sortOrder });
        // Add secondary sort by creation date
        orderBy.push({ createdAt: 'desc' });
        break;

      default:
        // Fallback to creation date
        orderBy.push({ createdAt: 'desc' });
    }

    const bugReports = await prisma.bugReport.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true, role: true }
        },
        assignedTo: {
          select: { name: true, email: true }
        }
      },
      orderBy,
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });

    // For urgency sorting, we need to do custom ordering since Prisma doesn't handle enum-like sorting well
    let sortedBugReports = bugReports;
    if (sortBy === 'urgency') {
      const urgencyOrder = sortOrder === 'desc'
        ? { 'high': 3, 'medium': 2, 'low': 1 }
        : { 'high': 1, 'medium': 2, 'low': 3 };

      sortedBugReports = bugReports.sort((a, b) => {
        const aValue = urgencyOrder[a.urgency] || 0;
        const bValue = urgencyOrder[b.urgency] || 0;

        if (aValue !== bValue) {
          return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
        }

        // Secondary sort by creation date (newest first)
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }

    const total = await prisma.bugReport.count({ where });

    res.json({
      bugReports: sortedBugReports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching bug reports:', error);
    res.status(500).json({ error: 'Failed to fetch bug reports' });
  }
});

// The other endpoints (submit, update, stats) remain the same as before
app.post('/api/bug-reports/submit', authenticateToken, async (req, res) => {
  try {
    const { description, steps, urgency, browserInfo, consoleOutput } = req.body;
    const userId = req.user.userId;

    const bugReport = await prisma.bugReport.create({
      data: {
        title: `Bug Report #${Date.now()}`,
        description,
        steps: steps || '',
        urgency,
        userId,
        userRole: req.user.role,
        browserInfo: JSON.stringify({
          userAgent: req.headers['user-agent'],
          ...browserInfo
        }),
        consoleOutput: consoleOutput ? JSON.stringify(consoleOutput) : null
      },
      include: {
        user: {
          select: { name: true, email: true, role: true }
        }
      }
    });

    res.json({ success: true, id: bugReport.id });
  } catch (error) {
    console.error('Error creating bug report:', error);
    res.status(500).json({ error: 'Failed to submit bug report' });
  }
});

app.patch('/api/bug-reports/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'director') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const { status, resolution, assignedToId } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (resolution !== undefined) updateData.resolution = resolution;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId;
    if (status === 'resolved' || status === 'closed') {
      updateData.resolvedAt = new Date();
    }

    const bugReport = await prisma.bugReport.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        user: { select: { name: true, email: true, role: true } },
        assignedTo: { select: { name: true, email: true } }
      }
    });

    res.json(bugReport);
  } catch (error) {
    console.error('Error updating bug report:', error);
    res.status(500).json({ error: 'Failed to update bug report' });
  }
});

app.get('/api/bug-reports/stats', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'director') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = await Promise.all([
      prisma.bugReport.count({ where: { status: 'open' } }),
      prisma.bugReport.count({ where: { status: 'in_progress' } }),
      prisma.bugReport.count({ where: { urgency: 'high', status: { in: ['open', 'in_progress'] } } }),
      prisma.bugReport.count()
    ]);

    res.json({
      open: stats[0],
      inProgress: stats[1],
      highPriority: stats[2],
      total: stats[3]
    });
  } catch (error) {
    console.error('Error fetching bug report stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ==========================================
// Instructor Smart Suggestions Endpoint
// ==========================================
app.get('/api/instructor-suggestions/:instructorId', async (req, res) => {
  try {
    const { instructorId } = req.params;
    const instructor = await prisma.user.findUnique({
      where: { id: parseInt(instructorId) },
      include: { school: true }
    });

    if (!instructor?.school) {
      return res.status(400).json({ error: 'Instructor not found or not assigned to a school' });
    }

    const suggestions = [];
    const now = new Date();
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

    // 1. PATTERN DETECTION: Multiple resubmissions = common issue
    const recentResubmissions = await prisma.uploadedFile.findMany({
      where: {
        status: 'Corrected by student, waiting review',
        assignedTo: { schoolId: instructor.schoolId },
        updatedAt: { gt: oneWeekAgo }
      },
      include: { assignedTo: true },
      orderBy: { updatedAt: 'desc' }
    });

    if (recentResubmissions.length >= 3) {
      const resubmissionDetails = recentResubmissions.map(file => ({
        studentName: file.assignedTo.name,
        studentEmail: file.assignedTo.email,
        cloneName: file.cloneName || file.originalName,
        resubmittedDate: file.updatedAt,
        daysAgo: Math.floor((now - new Date(file.updatedAt)) / (1000 * 60 * 60 * 24))
      }));

      suggestions.push({
        type: 'common_issues',
        priority: 'medium',
        icon: 'AlertTriangle',
        title: `${recentResubmissions.length} resubmissions this week`,
        subtitle: 'Multiple students struggling - consider group guidance',
        action: 'review_submissions',
        count: recentResubmissions.length,
        details: resubmissionDetails,
        expandable: true
      });
    }

    // 2. WORKFLOW OPTIMIZATION: Batch approvals
    const readyForApproval = await prisma.uploadedFile.findMany({
      where: {
        status: 'Completed, waiting review by staff',
        assignedTo: { schoolId: instructor.schoolId },
        updatedAt: { gt: new Date(now - 2 * 24 * 60 * 60 * 1000) }
      },
      include: { assignedTo: true },
      orderBy: { updatedAt: 'desc' }
    });

    if (readyForApproval.length >= 3) {
      const approvalDetails = readyForApproval.map(file => ({
        studentName: file.assignedTo.name,
        studentEmail: file.assignedTo.email,
        cloneName: file.cloneName || file.originalName,
        submittedDate: file.updatedAt,
        progress: file.progress || 0,
        hoursAgo: Math.floor((now - new Date(file.updatedAt)) / (1000 * 60 * 60))
      }));

      suggestions.push({
        type: 'batch_opportunity',
        priority: 'low',
        icon: 'Zap',
        title: `${readyForApproval.length} recent submissions ready for review`,
        subtitle: 'Perfect for batch processing',
        action: 'review_submissions',
        count: readyForApproval.length,
        details: approvalDetails,
        expandable: true
      });
    }

    // 3. RISK MANAGEMENT: Students going silent (already implemented)
    const allSchoolStudents = await prisma.user.findMany({
      where: {
        schoolId: instructor.schoolId,
        role: 'student',
        status: 'approved'
      }
    });

    const silentStudents = [];
    for (const student of allSchoolStudents) {
      const recentActivity = await prisma.uploadedFile.findFirst({
        where: {
          assignedToId: student.id,
          updatedAt: { gt: twoWeeksAgo }
        },
        orderBy: { updatedAt: 'desc' }
      });

      if (!recentActivity) {
        const lastActivity = await prisma.uploadedFile.findFirst({
          where: { assignedToId: student.id },
          orderBy: { updatedAt: 'desc' }
        });

        silentStudents.push({
          id: student.id,
          name: student.name,
          email: student.email,
          lastActivityDate: lastActivity?.updatedAt || student.createdAt,
          daysSinceActivity: lastActivity
            ? Math.floor((now - new Date(lastActivity.updatedAt)) / (1000 * 60 * 60 * 24))
            : Math.floor((now - new Date(student.createdAt)) / (1000 * 60 * 60 * 24))
        });
      }
    }

    if (silentStudents.length >= 2) {
      suggestions.push({
        type: 'silent_students',
        priority: 'medium',
        icon: 'UserX',
        title: `${silentStudents.length} students haven't been active in 2+ weeks`,
        subtitle: 'May need check-ins or assignment clarification',
        action: 'view_students',
        count: silentStudents.length,
        details: silentStudents,
        expandable: true
      });
    }

    // 4. TEACHING INSIGHTS: High-maintenance assignments
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const allRecentSubmissions = await prisma.uploadedFile.findMany({
      where: {
        assignedTo: { schoolId: instructor.schoolId },
        createdAt: { gt: monthAgo }
      },
      include: { assignedTo: true }
    });

    // Group by clone name and analyze
    const cloneStats = {};
    allRecentSubmissions.forEach(file => {
      const cloneName = file.cloneName || 'Unknown';
      if (!cloneStats[cloneName]) {
        cloneStats[cloneName] = {
          total: 0,
          resubmissions: 0,
          students: new Set(),
          resubmittingStudents: []
        };
      }
      cloneStats[cloneName].total++;
      cloneStats[cloneName].students.add(file.assignedTo.name);

      if (file.status === 'Corrected by student, waiting review' ||
        file.status === 'Reviewed, needs to be reanalyzed') {
        cloneStats[cloneName].resubmissions++;
        cloneStats[cloneName].resubmittingStudents.push({
          name: file.assignedTo.name,
          email: file.assignedTo.email,
          lastUpdate: file.updatedAt
        });
      }
    });

    const problematicClones = Object.entries(cloneStats)
      .filter(([name, stats]) => stats.total >= 3 && (stats.resubmissions / stats.total) > 0.6)
      .sort((a, b) => (b[1].resubmissions / b[1].total) - (a[1].resubmissions / a[1].total));

    if (problematicClones.length > 0) {
      const [cloneName, stats] = problematicClones[0];
      const resubRate = Math.round((stats.resubmissions / stats.total) * 100);

      const assignmentDetails = {
        cloneName,
        totalStudents: stats.students.size,
        totalSubmissions: stats.total,
        resubmissions: stats.resubmissions,
        resubmissionRate: resubRate,
        strugglingStudents: stats.resubmittingStudents.map(student => ({
          name: student.name,
          email: student.email,
          lastResubmission: student.lastUpdate,
          daysAgo: Math.floor((now - new Date(student.lastUpdate)) / (1000 * 60 * 60 * 24))
        }))
      };

      suggestions.push({
        type: 'difficult_assignment',
        priority: 'low',
        icon: 'BookOpen',
        title: `${cloneName} has ${resubRate}% resubmission rate`,
        subtitle: 'Consider reviewing assignment instructions',
        action: 'review_submissions',
        count: stats.resubmissions,
        details: assignmentDetails,
        expandable: true
      });
    }

    // Sort by priority and return top 3
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    suggestions.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

    if (suggestions.length > 0) {
      res.json(suggestions.slice(0, 3));
    } else {
      res.json([{
        type: 'all_good',
        priority: 'low',
        icon: 'CheckCircle',
        title: 'No patterns detected',
        subtitle: 'Your students are progressing smoothly',
        action: 'celebrate',
        count: 0
      }]);
    }

  } catch (error) {
    console.error('Error generating smart suggestions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Temporary debug endpoint - ADD THIS
app.get('/api/debug/demographics', authenticateToken, requireRole(['director']), async (req, res) => {
  try {
    console.log('=== DEBUG: CHECKING DEMOGRAPHICS ===');

    // Get all users with demographics
    const usersWithDemographics = await prisma.user.findMany({
      where: {
        role: 'student',
        status: 'approved'
      },
      include: {
        demographics: true
      }
    });

    console.log(`Found ${usersWithDemographics.length} students`);

    // Check which students have demographics
    const demographicsData = usersWithDemographics.map(user => ({
      userId: user.id,
      name: user.name,
      email: user.email,
      hasDemographics: !!user.demographics,
      demographics: user.demographics
    }));

    console.log('Demographics data:', JSON.stringify(demographicsData, null, 2));

    res.json(demographicsData);
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CLONE DISCUSSION API ENDPOINTS
// ==========================================


// Get discussions for instructors (only from their school's students)
// Get discussions for instructors (only from their school's students)
app.get('/api/clone-discussions/instructor/:instructorId', async (req, res) => {
  try {
    const { instructorId } = req.params;

    // Get instructor's school
    const instructor = await prisma.user.findUnique({
      where: { id: parseInt(instructorId) },
      include: { school: true }
    });

    if (!instructor || !instructor.school) {
      return res.status(400).json({ error: 'Instructor not found or not assigned to a school' });
    }

    console.log('Getting discussions for instructor:', instructor.name, 'at school:', instructor.school.name);

    // Get discussions from students in instructor's school
    const discussions = await prisma.cloneDiscussion.findMany({
      where: {
        student: {
          school: {
            name: instructor.school.name
          }
        }
      },
      include: {
        student: {
          select: { profilePicture: true, id: true, name: true, email: true, school: { select: { name: true } } }
        },
        clone: {
          select: { id: true, cloneName: true, originalName: true }
        },
        practiceClone: {
          select: { id: true, cloneName: true, originalName: true }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: { id: true, name: true, role: true }
            }
          }
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { lastMessageAt: 'desc' }
    });

    console.log('Found discussions for instructor school:', discussions.length);

    // Calculate unread count for THIS SPECIFIC instructor
    const discussionsWithUnread = await Promise.all(
      discussions.map(async (discussion) => {
        // Get messages not sent by this instructor
        const messagesFromOthers = await prisma.discussionMessage.findMany({
          where: {
            discussionId: discussion.id,
            senderId: { not: parseInt(instructorId) }
          },
          select: {
            id: true,
            readBy: true
          }
        });

        // Count messages not read by THIS instructor
        let unreadCount = 0;
        for (const message of messagesFromOthers) {
          let readByArray = [];

          if (message.readBy) {
            try {
              readByArray = JSON.parse(message.readBy);
              if (!Array.isArray(readByArray)) {
                readByArray = [];
              }
            } catch (e) {
              readByArray = [];
            }
          }

          // Check if THIS instructor has read this message
          if (!readByArray.includes(parseInt(instructorId))) {
            unreadCount++;
          }
        }

        return {
          ...discussion,
          unreadCount,
          lastMessage: discussion.messages[0] || null,
          messageCount: discussion._count.messages
        };
      })
    );

    res.json(discussionsWithUnread);

  } catch (error) {
    console.error('Error getting instructor discussions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all discussions for an instructor's school students
app.get('/api/clone-discussions/instructor/:instructorId', async (req, res) => {
  try {
    const { instructorId } = req.params;

    console.log('=== GETTING INSTRUCTOR DISCUSSIONS ===');
    console.log('Instructor ID:', instructorId);

    // First, get the instructor to find their school
    const instructor = await prisma.user.findUnique({
      where: { id: parseInt(instructorId) },
      select: { schoolId: true, role: true }
    });

    if (!instructor) {
      return res.status(404).json({ error: 'Instructor not found' });
    }

    if (instructor.role !== 'instructor') {
      return res.status(403).json({ error: 'User is not an instructor' });
    }

    if (!instructor.schoolId) {
      console.log('Instructor has no school assigned');
      return res.json([]);
    }

    console.log('Instructor school ID:', instructor.schoolId);

    // Get all students from the same school as the instructor
    const schoolStudents = await prisma.user.findMany({
      where: {
        role: 'student',
        schoolId: instructor.schoolId // Same school as instructor
      },
      select: { id: true }
    });

    const studentIds = schoolStudents.map(student => student.id);
    console.log('School student IDs:', studentIds);

    if (studentIds.length === 0) {
      console.log('No students at this school');
      return res.json([]);
    }

    // Get discussions only for students at this instructor's school
    const discussions = await prisma.cloneDiscussion.findMany({
      where: {
        studentId: { in: studentIds } // Only students from instructor's school
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            school: {
              select: { name: true }
            },
            profilePicture: true
          }
        },
        clone: {
          select: { id: true, cloneName: true, originalName: true }
        },
        practiceClone: {
          select: { id: true, cloneName: true, originalName: true }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: { id: true, name: true, role: true }
            }
          }
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { lastMessageAt: 'desc' }
    });

    console.log('Found school discussions:', discussions.length);

    // Add unread count for each discussion
    const discussionsWithUnread = await Promise.all(
      discussions.map(async (discussion) => {
        const messagesFromStudents = await prisma.discussionMessage.findMany({
          where: {
            discussionId: discussion.id,
            senderId: { not: parseInt(instructorId) } // Messages not from this instructor
          },
          select: {
            id: true,
            readBy: true
          }
        });

        let unreadCount = 0;
        for (const message of messagesFromStudents) {
          let readByArray = [];
          if (message.readBy) {
            try {
              readByArray = JSON.parse(message.readBy);
              if (!Array.isArray(readByArray)) {
                readByArray = [];
              }
            } catch (e) {
              readByArray = [];
            }
          }

          if (!readByArray.includes(parseInt(instructorId))) {
            unreadCount++;
          }
        }

        return {
          ...discussion,
          unreadCount,
          lastMessage: discussion.messages[0] || null,
          messageCount: discussion._count.messages
        };
      })
    );

    console.log('Final school discussions with unread counts:', discussionsWithUnread.length);
    res.json(discussionsWithUnread);

  } catch (error) {
    console.error('=== ERROR GETTING INSTRUCTOR DISCUSSIONS ===');
    console.error('Error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Get all discussions for directors (all discussions across all students)
app.get('/api/clone-discussions/director', async (req, res) => {
  try {
    const discussions = await prisma.cloneDiscussion.findMany({
      include: {
        student: {
          select: { id: true, name: true, email: true, profilePicture: true, school: { select: { name: true } } }
        },
        clone: {
          select: { id: true, cloneName: true, originalName: true }
        },
        practiceClone: {
          select: { id: true, cloneName: true, originalName: true }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: { id: true, name: true, role: true }
            }
          }
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { lastMessageAt: 'desc' }
    });

    // Get all director IDs once
    const directors = await prisma.user.findMany({
      where: { role: 'director' },
      select: { id: true }
    });

    const directorIds = directors.map(d => d.id);

    // In /api/clone-discussions/director, replace the unread count calculation:
    const discussionsWithUnread = await Promise.all(
      discussions.map(async (discussion) => {
        // Get all director IDs
        const directors = await prisma.user.findMany({
          where: { role: 'director' },
          select: { id: true }
        });
        const directorIds = directors.map(d => d.id);

        // Get messages not sent by directors
        const messagesFromNonDirectors = await prisma.discussionMessage.findMany({
          where: {
            discussionId: discussion.id,
            senderId: { not: { in: directorIds } }
          },
          select: {
            id: true,
            readBy: true
          }
        });

        // Count messages not read by ANY director
        let unreadCount = 0;
        for (const message of messagesFromNonDirectors) {
          let readByArray = [];

          if (message.readBy) {
            try {
              readByArray = JSON.parse(message.readBy);
              if (!Array.isArray(readByArray)) {
                readByArray = [];
              }
            } catch (e) {
              readByArray = [];
            }
          }

          // Check if ANY director has read this message
          const readByAnyDirector = directorIds.some(directorId =>
            readByArray.includes(directorId)
          );

          if (!readByAnyDirector) {
            unreadCount++;
          }
        }

        return {
          ...discussion,
          unreadCount,
          lastMessage: discussion.messages[0] || null,
          messageCount: discussion._count.messages
        };
      })
    );

    res.json(discussionsWithUnread);

  } catch (error) {
    console.error('Error getting director discussions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add this endpoint to your index.js
// Simplified endpoint - load all messages at once
app.get('/api/clone-discussions/:discussionId/messages', async (req, res) => {
  try {
    const { discussionId } = req.params;

    const messages = await prisma.discussionMessage.findMany({
      where: {
        discussionId: parseInt(discussionId)
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true, profilePicture: true }
        }
      },
      orderBy: { createdAt: 'asc' } // Oldest first
    });

    res.json({
      messages,
      totalCount: messages.length
    });

  } catch (error) {
    console.error('Error loading discussion messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all discussions for a student - FIXED VERSION
app.get('/api/clone-discussions/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    //console.log('=== GETTING STUDENT DISCUSSIONS ===');
    //console.log('Student ID:', studentId);

    const discussions = await prisma.cloneDiscussion.findMany({
      where: {
        studentId: parseInt(studentId)
      },
      include: {
        clone: {
          select: { id: true, cloneName: true, originalName: true }
        },
        practiceClone: {  // ADD THIS - was missing
          select: { id: true, cloneName: true, originalName: true }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: { id: true, name: true, role: true }
            }
          }
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { lastMessageAt: 'desc' }
    });

    /*
    console.log('Found discussions:', discussions.length);
    console.log('Discussion details:', discussions.map(d => ({
      id: d.id,
      title: d.title,
      cloneId: d.cloneId,
      practiceCloneId: d.practiceCloneId,
      messageCount: d._count.messages
    })));
    */

    // Add unread count for each discussion - FIXED readBy handling
    // Fix in index.js - the unread count calculation
    // Replace the unread count calculation in /api/clone-discussions/student/:studentId
    // In /api/clone-discussions/student/:studentId, replace the unread count calculation:
    const discussionsWithUnread = await Promise.all(
      discussions.map(async (discussion) => {
        // Simple and correct approach: manually check each message
        const messagesFromOthers = await prisma.discussionMessage.findMany({
          where: {
            discussionId: discussion.id,
            senderId: { not: parseInt(studentId) }
          },
          select: {
            id: true,
            readBy: true
          }
        });

        let unreadCount = 0;
        for (const message of messagesFromOthers) {
          let readByArray = [];

          // Parse readBy safely
          if (message.readBy) {
            try {
              readByArray = JSON.parse(message.readBy);
              if (!Array.isArray(readByArray)) {
                readByArray = [];
              }
            } catch (e) {
              readByArray = [];
            }
          }

          // Check if this student has read this message
          if (!readByArray.includes(parseInt(studentId))) {
            unreadCount++;
          }
        }

        return {
          ...discussion,
          unreadCount,
          lastMessage: discussion.messages[0] || null,
          messageCount: discussion._count.messages
        };
      })
    );

    //console.log('Final discussions with unread counts:', discussionsWithUnread.length);
    res.json(discussionsWithUnread);

  } catch (error) {
    console.error('=== ERROR GETTING STUDENT DISCUSSIONS ===');
    console.error('Error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});



// Add this debug endpoint to your index.js
app.get('/api/debug/unread-calculation/:discussionId/:studentId', async (req, res) => {
  try {
    const { discussionId, studentId } = req.params;

    console.log('=== UNREAD COUNT DEBUG ===');
    console.log('Discussion ID:', discussionId);
    console.log('Student ID:', studentId);

    // Get all messages from other users in this discussion
    const allMessagesFromOthers = await prisma.discussionMessage.findMany({
      where: {
        discussionId: parseInt(discussionId),
        senderId: { not: parseInt(studentId) }
      },
      select: {
        id: true,
        senderId: true,
        readBy: true,
        content: true
      }
    });

    console.log('Messages from others:', allMessagesFromOthers.length);

    // Test the current unread query logic
    const currentUnreadCount = await prisma.discussionMessage.count({
      where: {
        discussionId: parseInt(discussionId),
        senderId: { not: parseInt(studentId) },
        OR: [
          { readBy: null },
          { readBy: "" },
          { readBy: "[]" },
          {
            AND: [
              { readBy: { not: null } },
              { readBy: { not: "" } },
              { readBy: { not: "[]" } },
              {
                readBy: {
                  not: {
                    contains: `"${studentId}"`
                  }
                }
              }
            ]
          }
        ]
      }
    });

    console.log('Current query unread count:', currentUnreadCount);

    // Manual calculation for comparison
    let manualUnreadCount = 0;
    const analysis = allMessagesFromOthers.map(msg => {
      let parsedReadBy = [];
      try {
        if (msg.readBy) {
          parsedReadBy = JSON.parse(msg.readBy);
        }
      } catch (e) {
        parsedReadBy = [];
      }

      const isRead = Array.isArray(parsedReadBy) && parsedReadBy.includes(parseInt(studentId));
      if (!isRead) {
        manualUnreadCount++;
      }

      return {
        id: msg.id,
        readByRaw: msg.readBy,
        parsedReadBy,
        isRead,
        containsCheck: msg.readBy ? msg.readBy.includes(`"${studentId}"`) : false
      };
    });

    console.log('Manual unread count:', manualUnreadCount);
    console.log('Analysis:', analysis);

    res.json({
      discussionId: parseInt(discussionId),
      studentId: parseInt(studentId),
      allMessagesFromOthers: allMessagesFromOthers.length,
      currentQueryUnreadCount: currentUnreadCount,
      manualUnreadCount,
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Debug unread calculation error:', error);
    res.status(500).json({ error: error.message });
  }
});


// Add a new message to a discussion
app.post('/api/clone-discussions/:discussionId/messages', async (req, res) => {
  try {
    const { discussionId } = req.params;
    const { senderId, content, messageType = 'message' } = req.body;

    if (!senderId || !content?.trim()) {
      return res.status(400).json({ error: 'SenderId and content are required' });
    }

    // Verify discussion exists
    const discussion = await prisma.cloneDiscussion.findUnique({
      where: { id: parseInt(discussionId) },
      include: {
        student: { select: { id: true } }
      }
    });

    if (!discussion) {
      return res.status(404).json({ error: 'Discussion not found' });
    }

    // Create the message
    const message = await prisma.discussionMessage.create({
      data: {
        discussionId: parseInt(discussionId),
        senderId: parseInt(senderId),
        content: content.trim(),
        messageType: messageType,
        readBy: JSON.stringify([parseInt(senderId)]) // Mark as read by sender
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });

    // Update discussion's lastMessageAt
    await prisma.cloneDiscussion.update({
      where: { id: parseInt(discussionId) },
      data: { lastMessageAt: new Date() }
    });

    console.log(`Added message to discussion ${discussionId} from user ${senderId}`);
    res.json(message);

  } catch (error) {
    console.error('Error adding message to discussion:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark messages as read by a user
// Simplified mark-read endpoint in index.js
// Replace your existing mark-read endpoint with this enhanced version:
app.patch('/api/clone-discussions/:discussionId/mark-read', async (req, res) => {
  try {
    const { discussionId } = req.params;
    const { userId } = req.body;

    console.log('=== MARK AS READ DEBUG ===');
    console.log('Discussion ID:', discussionId);
    console.log('User ID:', userId);
    console.log('Request timestamp:', new Date().toISOString());

    // Get all messages in this discussion
    const allMessages = await prisma.discussionMessage.findMany({
      where: { discussionId: parseInt(discussionId) },
      select: {
        id: true,
        senderId: true,
        readBy: true,
        content: true
      }
    });

    console.log('Total messages in discussion:', allMessages.length);

    // Filter messages that need to be marked as read
    const messagesToUpdate = [];

    for (const message of allMessages) {
      // Skip messages sent by this user
      if (message.senderId === parseInt(userId)) {
        console.log(`Skipping message ${message.id} - sent by user ${userId}`);
        continue;
      }

      let readBy = [];
      let needsUpdate = false;

      // Parse existing readBy
      if (message.readBy) {
        try {
          const parsed = JSON.parse(message.readBy);
          if (Array.isArray(parsed)) {
            readBy = parsed;
          }
        } catch (e) {
          console.log(`Invalid JSON in message ${message.id} readBy:`, message.readBy);
        }
      }

      // Check if user already marked as read
      if (!readBy.includes(parseInt(userId))) {
        readBy.push(parseInt(userId));
        needsUpdate = true;
        console.log(`Message ${message.id} needs update. New readBy:`, readBy);
      } else {
        console.log(`Message ${message.id} already read by user ${userId}`);
      }

      if (needsUpdate) {
        messagesToUpdate.push({
          id: message.id,
          newReadBy: JSON.stringify(readBy)
        });
      }
    }

    console.log('Messages that need updating:', messagesToUpdate.length);

    // Update messages in database
    let updatedCount = 0;
    for (const update of messagesToUpdate) {
      try {
        await prisma.discussionMessage.update({
          where: { id: update.id },
          data: { readBy: update.newReadBy }
        });
        updatedCount++;
        console.log(`Successfully updated message ${update.id}`);
      } catch (updateError) {
        console.error(`Failed to update message ${update.id}:`, updateError);
      }
    }

    console.log('Successfully marked', updatedCount, 'messages as read');
    console.log('=== MARK AS READ COMPLETE ===');

    res.json({
      success: true,
      markedAsRead: updatedCount,
      totalMessages: allMessages.length,
      messagesToUpdate: messagesToUpdate.length
    });

  } catch (error) {
    console.error('=== MARK AS READ ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Legacy endpoint compatibility - check if discussion exists (for backward compatibility)
app.get('/api/messages/check-discussion/:studentId/:cloneId', async (req, res) => {
  try {
    const { studentId, cloneId } = req.params;

    const cloneIdValue = (cloneId === 'general' || cloneId === 'null') ? null : parseInt(cloneId);

    const discussion = await prisma.cloneDiscussion.findFirst({
      where: {
        studentId: parseInt(studentId),
        cloneId: cloneIdValue
      },
      include: {
        clone: { select: { cloneName: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { content: true, createdAt: true }
        },
        _count: { select: { messages: true } }
      }
    });

    if (discussion) {
      res.json({
        exists: true,
        messageCount: discussion._count.messages,
        cloneName: discussion.clone?.cloneName || 'General Discussion',
        lastMessageDate: discussion.messages[0]?.createdAt,
        lastMessagePreview: discussion.messages[0]?.content?.substring(0, 100) +
          (discussion.messages[0]?.content?.length > 100 ? '...' : '')
      });
    } else {
      res.json({ exists: false });
    }

  } catch (error) {
    console.error('Error checking discussion:', error);
    res.status(500).json({ error: error.message, exists: false });
  }
});

// Delete a discussion and all its messages
app.delete('/api/clone-discussions/:discussionId', async (req, res) => {
  try {
    const { discussionId } = req.params;
    const { requesterId } = req.query; // Changed from req.body to req.query

    console.log('=== DELETE DISCUSSION DEBUG ===');
    console.log('Discussion ID:', discussionId);
    console.log('Requester ID:', requesterId, 'Type:', typeof requesterId);

    // Add validation
    if (!requesterId || isNaN(parseInt(requesterId))) {
      console.log('ERROR: Invalid or missing requesterId:', requesterId);
      return res.status(400).json({ error: 'Valid requesterId is required' });
    }

    // Verify requester is a director
    const requester = await prisma.user.findUnique({
      where: { id: parseInt(requesterId) }
    });

    if (!requester || requester.role !== 'director') {
      return res.status(403).json({ error: 'Only directors can delete discussions' });
    }

    // Delete discussion (messages will be deleted automatically due to cascade)
    const deletedDiscussion = await prisma.cloneDiscussion.delete({
      where: { id: parseInt(discussionId) },
      include: {
        _count: { select: { messages: true } }
      }
    });

    console.log(`Deleted discussion ${discussionId} with ${deletedDiscussion._count.messages} messages`);
    res.json({
      success: true,
      deletedMessages: deletedDiscussion._count.messages,
      message: 'Discussion deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting discussion:', error);
    res.status(500).json({ error: error.message });
  }
});


// Get or create a specific discussion for student + clone - FIXED VERSION FOR PRACTICE CLONES
app.get('/api/clone-discussions/:studentId/:cloneId', async (req, res) => {
  try {
    const { studentId, cloneId } = req.params;

    // ADD VALIDATION
    if (!studentId || isNaN(parseInt(studentId))) {
      console.error('Invalid studentId:', studentId);
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    // Handle 'general' or 'null' cloneId
    const cloneIdValue = (cloneId === 'general' || cloneId === 'null') ? null : parseInt(cloneId);

    // NEW: Determine if this is a practice clone or regular clone
    let isPracticeClone = false;
    let practiceClone = null;
    let regularClone = null;

    if (cloneIdValue) {
      // First check if it's a practice clone
      practiceClone = await prisma.practiceClone.findUnique({
        where: { id: cloneIdValue },
        select: { id: true, cloneName: true, originalName: true }
      });

      if (practiceClone) {
        isPracticeClone = true;
      } else {
        // Check if it's a regular clone
        regularClone = await prisma.uploadedFile.findUnique({
          where: { id: cloneIdValue },
          select: { id: true, cloneName: true, originalName: true }
        });
      }
    }

    // Find existing discussion with correct foreign key
    let whereClause;
    if (isPracticeClone) {
      whereClause = {
        studentId: parseInt(studentId),
        practiceCloneId: cloneIdValue,
        cloneId: null // must be null for practice clones
      };
    } else {
      whereClause = {
        studentId: parseInt(studentId),
        cloneId: cloneIdValue,
        practiceCloneId: null // must be null for regular clones
      };
    }

    let discussion = await prisma.cloneDiscussion.findFirst({
      where: whereClause,
      include: {
        student: {
          select: { id: true, name: true, email: true, role: true }
        },
        clone: {
          select: { id: true, cloneName: true, originalName: true }
        },
        practiceClone: {
          select: { id: true, cloneName: true, originalName: true }
        },
        messages: {
          include: {
            sender: {
              select: { id: true, name: true, email: true, role: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!discussion) {
      // Create new discussion if it doesn't exist
      const student = await prisma.user.findUnique({
        where: { id: parseInt(studentId) },
        select: { id: true, name: true, email: true, role: true }
      });

      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      let title = `General Discussion with ${student.name}`;

      if (isPracticeClone && practiceClone) {
        title = `Discussion: ${practiceClone.cloneName} (Practice)`;
      } else if (regularClone) {
        title = `Discussion: ${regularClone.cloneName}`;
      }

      console.log('Creating new discussion:', title);
      console.log('isPracticeClone:', isPracticeClone);

      // Create discussion with correct foreign key
      let createData = {
        studentId: parseInt(studentId),
        title
      };

      if (isPracticeClone) {
        createData.practiceCloneId = cloneIdValue;
        createData.cloneId = null;
      } else {
        createData.cloneId = cloneIdValue;
        createData.practiceCloneId = null;
      }

      discussion = await prisma.cloneDiscussion.create({
        data: createData,
        include: {
          student: {
            select: { id: true, name: true, email: true, role: true }
          },
          clone: {
            select: { id: true, cloneName: true, originalName: true }
          },
          practiceClone: {
            select: { id: true, cloneName: true, originalName: true }
          },
          messages: {
            include: {
              sender: {
                select: { id: true, name: true, email: true, role: true }
              }
            },
            orderBy: { createdAt: 'asc' }
          }
        }
      });
    }

    console.log('Discussion result:', {
      id: discussion.id,
      studentId: discussion.studentId,
      cloneId: discussion.cloneId,
      practiceCloneId: discussion.practiceCloneId,
      isPracticeClone
    });

    res.json(discussion);

  } catch (error) {
    console.error('=== ERROR IN GET/CREATE DISCUSSION ===');
    console.error('Error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// STEP-HELP API ENDPOINTS
// ==========================================
// Step Help API endpoints
app.get('/api/step-help', async (req, res) => {
  try {
    const stepHelp = await prisma.stepHelp.findMany({
      where: { isActive: true },
      orderBy: { step: 'asc' }
    });
    res.json(stepHelp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/step-help', async (req, res) => {
  try {
    const { step, title, description, videoBoxUrl, helpDocumentUrl } = req.body;
    const stepHelp = await prisma.stepHelp.create({
      data: {
        step,
        title,
        description,
        videoBoxUrl,
        helpDocumentUrl
      }
    });
    res.json(stepHelp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/step-help/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const stepHelp = await prisma.stepHelp.update({
      where: { id },
      data: updates
    });
    res.json(stepHelp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/step-help/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.stepHelp.delete({
      where: { id }
    });
    res.json({ message: 'Step help deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/step-help/:step', async (req, res) => {
  try {
    const { step } = req.params;
    const stepHelp = await prisma.stepHelp.findUnique({
      where: { step }
    });
    res.json(stepHelp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve React

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../client/build')));

// Catch-all handler: send back React's index.html file for any non-API requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


