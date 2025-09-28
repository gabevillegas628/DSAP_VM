const {
  CLONE_STATUSES,
  isValidStatus,
  isValidStatusTransition,
  validateAndWarnStatus,
  getReviewStatus,
  REVIEW_ACTION_MAP
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

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { group } = require('console');

const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Email configuration (add this near your other config)
const emailTransporter = nodemailer.createTransport({
  service: 'gmail', // or your email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD // Use app password for Gmail
  }
});

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
  origin: ['http://localhost:3000', 'http://localhost:3001', 'https://8f485d196d00.ngrok-free.app', 'https://2577de9df43b.ngrok-free.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
  credentials: true
}));

// Middleware (add this right after the app.options section)
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'https://8f485d196d00.ngrok-free.app', 'https://2577de9df43b.ngrok-free.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
  credentials: true
}));
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Keep original filename but add timestamp to avoid conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  // Only allow .ab1 files
  if (file.originalname.toLowerCase().endsWith('.ab1')) {
    cb(null, true);
  } else {
    cb(new Error('Only .ab1 files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

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
      return 'ClusteredNR';  // Fast clustered protein database
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

// Parse BLAST JSON results into our format
// Parse BLAST JSON results into our format
const parseBlastResults = (jsonData) => {
  try {
    console.log('Parsing BLAST JSON:', JSON.stringify(jsonData, null, 2).substring(0, 500));

    // Handle different possible JSON structures
    let hits = [];

    if (jsonData?.BlastOutput2?.[0]?.report?.results?.search?.hits) {
      hits = jsonData.BlastOutput2[0].report.results.search.hits;
    } else if (jsonData?.BlastOutput?.iterations?.[0]?.hits) {
      hits = jsonData.BlastOutput.iterations[0].hits;
    } else if (jsonData?.hits) {
      hits = jsonData.hits;
    } else {
      console.log('No hits found in expected locations');
      return [];
    }

    console.log('Found', hits.length, 'hits in BLAST results');

    return hits.slice(0, 3).map((hit, index) => {
      const hsp = hit.hsps?.[0] || hit.hsp?.[0] || {};

      return {
        rank: index + 1,
        accession: hit.accession || hit.id || '',
        definition: hit.definition || hit.title || '',
        organism: hit.taxid ? `Tax ID: ${hit.taxid}` : (hit.organism || ''),
        start: hsp.hit_from?.toString() || hsp.start?.toString() || '',
        end: hsp.hit_to?.toString() || hsp.end?.toString() || '',
        evalue: hsp.evalue ? parseFloat(hsp.evalue).toExponential(2) : '',
        score: hsp.score || hsp.bit_score || '',
        identity: hsp.identity || hsp.identities || ''
      };
    });

  } catch (error) {
    console.error('Error parsing BLAST results:', error);
    console.error('JSON data structure:', Object.keys(jsonData || {}));
    return [];
  }
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
    console.log('=== SCHOOLS ENDPOINT HIT ===');
    console.log('User from token:', req.user);

    const schools = await prisma.school.findMany();
    console.log('Found schools:', schools.length);
    console.log('Schools data:', schools);

    res.json(schools);
  } catch (error) {
    console.log('=== SCHOOLS ERROR ===', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/schools', async (req, res) => {
  try {
    const { name, schoolId, instructor, students } = req.body;
    const school = await prisma.school.create({
      data: { name, schoolId, instructor, students: parseInt(students) || 0 }
    });
    res.json(school);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/schools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // If instructor is being updated, we need to handle user assignments
    if (updates.instructor !== undefined) {
      const school = await prisma.school.findUnique({
        where: { id: parseInt(id) }
      });

      if (!school) {
        return res.status(404).json({ error: 'School not found' });
      }

      // If there was a previous instructor, remove their school assignment
      if (school.instructor && school.instructor !== 'Unassigned') {
        await prisma.user.updateMany({
          where: {
            name: school.instructor,
            role: 'instructor'
          },
          data: { schoolId: null }
        });
      }

      // If assigning a new instructor (not "Unassigned"), update their user record
      if (updates.instructor && updates.instructor !== 'Unassigned') {
        await prisma.user.updateMany({
          where: {
            name: updates.instructor,
            role: 'instructor'
          },
          data: { schoolId: parseInt(id) }
        });
      }
    }

    // Update the school record
    const updatedSchool = await prisma.school.update({
      where: { id: parseInt(id) },
      data: updates
    });

    res.json(updatedSchool);
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
        { order: 'asc' }
      ]
    });

    // Parse JSON fields
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
    const { step, text, type, options, required, order, conditionalLogic } = req.body;
    const question = await prisma.analysisQuestion.create({
      data: {
        step,
        text,
        type,
        options: options ? JSON.stringify(options) : null,
        required,
        order,
        conditionalLogic: conditionalLogic ? JSON.stringify(conditionalLogic) : null
      }
    });

    // Parse JSON fields for response
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
    const { step, text, type, options, required, order, conditionalLogic } = req.body;

    const question = await prisma.analysisQuestion.update({
      where: { id },
      data: {
        step,
        text,
        type,
        options: options ? JSON.stringify(options) : null,
        required,
        order,
        conditionalLogic: conditionalLogic ? JSON.stringify(conditionalLogic) : null
      }
    });

    // Parse JSON fields for response
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

    console.log('Deleting analysis question:', id);

    // First, delete all common feedback entries for this question
    const deletedFeedback = await prisma.commonFeedback.deleteMany({
      where: { questionId: id }
    });

    console.log(`Deleted ${deletedFeedback.count} common feedback entries for question ${id}`);

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

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        school: true
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check if user is approved
    if (user.status !== 'approved') {
      if (user.status === 'pending') {
        return res.status(403).json({ error: 'Account pending approval. Please contact your administrator.' });
      } else if (user.status === 'rejected') {
        return res.status(403).json({ error: 'Account access denied. Please contact your administrator.' });
      }
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const { role, status } = req.query;

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

// Public registration endpoint (no auth required)
app.post('/api/auth/register-student', async (req, res) => {
  try {
    const { email, password, name, schoolId } = req.body;

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

// Clone Library API endpoints

// Simple function to use filename as clone name
function generateCloneName(filename) {
  return filename.replace(/\.ab1$/i, '');
}

// Get all uploaded files
app.get('/api/uploaded-files', authenticateToken, async (req, res) => {
  try {
    const { reviewReady } = req.query;

    let whereClause = {};
    if (reviewReady === 'true') {
      whereClause = {
        AND: [
          { assignedToId: { not: null } },
          { analysisData: { not: null } },
          {
            status: {
              in: [
                CLONE_STATUSES.COMPLETED_WAITING_REVIEW,
                CLONE_STATUSES.CORRECTED_WAITING_REVIEW,
                CLONE_STATUSES.REVIEWED_CORRECT,
                CLONE_STATUSES.NEEDS_REANALYSIS
              ]
            }
          }
        ]
      };
    }

    const files = await prisma.uploadedFile.findMany({
      where: whereClause,
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            school: {
              select: {
                name: true
              }
            }
          }
        },
        uploadedBy: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(files);
  } catch (error) {
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
          filename: file.filename,
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
app.put('/api/uploaded-files/:id/status', async (req, res) => {
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

    // Validate status transition
    if (!isValidStatusTransition(currentFile.status, status)) {
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

app.put('/api/uploaded-files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, analysisData, progress, ...otherUpdates } = req.body;

    console.log('=== FILE UPDATE DEBUG ===');
    console.log('File ID:', id);
    console.log('Status update:', status);
    console.log('Analysis data update:', analysisData ? 'Present' : 'None');
    console.log('Progress update:', progress);

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

    res.download(filePath, file.originalName);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete file

app.delete('/api/uploaded-files/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First check if file is assigned to a student
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

    // Prevent deletion if assigned to a student
    if (fileToDelete.assignedTo) {
      return res.status(400).json({
        error: 'Cannot delete file assigned to a student',
        assignedTo: fileToDelete.assignedTo.name
      });
    }

    // Proceed with deletion if not assigned
    await prisma.uploadedFile.delete({
      where: { id: parseInt(id) }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Student Progress API endpoints

// Save student progress and answers - WITH DETAILED DEBUGGING
app.put('/api/uploaded-files/:id/progress', validateStatusMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { progress, answers, currentStep, status, reviewComments, reviewScore, lastReviewed, submittedAt } = req.body;

    console.log('=== SAVE PROGRESS DEBUG ===');
    console.log('File ID:', id);
    console.log('Progress:', progress);
    console.log('Requested status:', status);

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

    // Continue with rest of your existing code...
    console.log('Review Comments received:', reviewComments?.length || 0);

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

    console.log('Final analysis data being saved:', updatedAnalysisData);
    console.log('Review comments being preserved:', updatedAnalysisData.reviewComments?.length || 0);

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
// CORRECTED GET progress endpoint in index.js:
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

// Message API endpoints - CONSOLIDATED VERSION (no duplicates)

// Add this to your index.js file in the messages section

// Check if a discussion already exists for a specific clone and student
// REPLACE your existing check-discussion endpoint with this corrected version:
app.get('/api/messages/check-discussion/:studentId/:cloneId', async (req, res) => {
  try {
    const { studentId, cloneId } = req.params;

    console.log('=== CHECK EXISTING DISCUSSION ENDPOINT HIT ===');
    console.log('Student ID:', studentId);
    console.log('Clone ID:', cloneId);
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    console.log('Request headers:', req.headers);

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

    console.log('Database query where clause:', whereClause);

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

    console.log('Raw database query returned:', existingMessages.length, 'messages');

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
    console.log('Discussion exists:', discussionExists);

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

// Send message to directors (for students asking for help)
// Send message to directors (for students asking for help)
// Send message to directors (for students asking for help) - UPDATED FOR GROUP MESSAGING
app.post('/api/messages/support', async (req, res) => {
  try {
    const { senderId, cloneId, cloneType, cloneProgress, currentStep, subject, content } = req.body;

    console.log('=== MESSAGE SUPPORT DEBUG ===');
    console.log('Request body:', req.body);
    console.log('Sender ID:', senderId, 'Type:', typeof senderId);
    console.log('Subject:', subject, 'Type:', typeof subject);
    console.log('Content:', content, 'Type:', typeof content);
    console.log('Clone ID:', cloneId, 'Type:', typeof cloneId);
    console.log('Clone Progress:', cloneProgress, 'Type:', typeof cloneProgress);
    console.log('Current Step:', currentStep, 'Type:', typeof currentStep);

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

    console.log(`Found ${directors.length} directors:`, directors.map(d => d.name));

    if (directors.length === 0) {
      console.log('ERROR: No directors found');
      return res.status(500).json({ error: 'No directors available to receive messages' });
    }

    // Get clone information if cloneId provided
    let clone = null;
    if (cloneId && !isNaN(parseInt(cloneId))) {
      console.log('Fetching clone information for ID:', cloneId);

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
            console.log('Found practice clone:', clone.cloneName);
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
            console.log('Found assigned clone:', clone.cloneName);
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
    console.log('Creating group messages for all directors:', directorIds);

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

    console.log('Created', groupMessages.length, 'group messages for all directors');

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

    const unreadCount = await prisma.message.count({
      where: {
        recipientId: parseInt(userId),
        isRead: false
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

// FIXED: Reply endpoint with proper recipient logic
// FIXED: Reply endpoint with proper group messaging logic
// FIXED: Reply endpoint with proper group messaging logic
app.post('/api/messages/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { senderId, content } = req.body;

    console.log('=== REPLY ENDPOINT DEBUG ===');
    console.log('Replying to message ID:', id);
    console.log('Sender ID:', senderId);
    console.log('Content:', content.substring(0, 50) + '...');

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

    console.log('Original message found:');
    console.log('- Original sender:', originalMessage.sender.name, originalMessage.senderId);
    console.log('- Original recipient:', originalMessage.recipient.name, originalMessage.recipientId);
    console.log('- Current replier:', senderId);
    console.log('- Is group message:', originalMessage.isGroupMessage);
    console.log('- Message type:', originalMessage.messageType);

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

      console.log('Original student ID:', originalStudentId);
      console.log('All participants:', participants);
      console.log('Recipients before student check:', recipients);

      // CRITICAL: Always ensure student gets the reply
      if (originalStudentId && !recipients.includes(originalStudentId)) {
        recipients.unshift(originalStudentId); // Add student as first recipient
        console.log('Added student to recipients:', originalStudentId);
      }

      console.log('Final recipients list:', recipients);

      console.log('Original student ID:', originalStudentId);
      console.log('Final recipients list:', recipients);

      console.log('Group participants:', participants);
      console.log('Reply recipients (excluding sender):', recipients);

      // Create reply messages for all recipients
      const replyMessages = [];
      for (const recipientId of recipients) {
        console.log('Creating reply for recipient:', recipientId);

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
        console.log('Created reply message:', replyMessage.id, 'to', replyMessage.recipient.name);
      }

      console.log('Created', replyMessages.length, 'group reply messages');

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

    console.log('Where clause:', whereClause);

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

    console.log('Found', messages.length, 'messages for user', userId);
    console.log('Message IDs:', messages.map(m => m.id));



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
      welcomeText,    // NEW FIELD
      overview        // NEW FIELD
    } = req.body;

    // Validate input
    if (!projectHeader || projectHeader.trim() === '') {
      return res.status(400).json({ error: 'Project header is required' });
    }

    // Helper function to sanitize string inputs
    const sanitizeString = (str) => {
      return str && str.trim() !== '' ? str.trim() : null;
    };

    // Check if settings already exist
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
      welcomeText: sanitizeString(welcomeText),    // NEW FIELD
      overview: sanitizeString(overview)           // NEW FIELD
    };

    if (settings) {
      // Update existing settings
      settings = await prisma.programSettings.update({
        where: { id: settings.id },
        data: updateData
      });
    } else {
      // Create new settings record
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
          filename: file.filename,
          originalName: file.originalname,
          description: `Practice clone: ${cloneName}`,
          isActive: true
        }
      });

      uploadedPracticeClones.push(practiceClone);
    }

    console.log(`Successfully uploaded ${uploadedPracticeClones.length} practice clones`);
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

    // Delete associated files and progress records
    await prisma.practiceAnswer.deleteMany({
      where: { practiceCloneId: parseInt(id) }
    });

    await prisma.userPracticeProgress.deleteMany({
      where: { practiceCloneId: parseInt(id) }
    });

    await prisma.practiceClone.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Practice clone deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get practice submissions ready for review
app.get('/api/practice-submissions', async (req, res) => {
  try {
    const { reviewReady } = req.query;

    let whereClause = {};
    if (reviewReady === 'true') {
      whereClause = {
        status: {
          in: [
            CLONE_STATUSES.COMPLETED_WAITING_REVIEW,
            CLONE_STATUSES.CORRECTED_WAITING_REVIEW
          ]
        },
        answers: { not: null }
      };
    }

    const submissions = await prisma.userPracticeProgress.findMany({
      where: whereClause,
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
      },
      orderBy: { submittedAt: 'desc' }
    });

    // Format to match regular submission structure
    const formattedSubmissions = submissions.map(submission => ({
      id: submission.id,
      practiceCloneId: submission.practiceClone.id, // ADD this line
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

    res.json(formattedSubmissions);
  } catch (error) {
    console.error('Error fetching practice submissions:', error);
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
app.get('/api/practice-clones/:id/download', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('=== PRACTICE CLONE DOWNLOAD DEBUG ===');
    console.log('Requested practice clone ID:', id);

    const practiceClone = await prisma.practiceClone.findUnique({
      where: { id: parseInt(id) }
    });

    if (!practiceClone) {
      console.log('ERROR: Practice clone not found in database with ID:', id);
      return res.status(404).json({ error: 'Practice clone not found' });
    }

    console.log('Found practice clone:', practiceClone.cloneName);
    console.log('Filename:', practiceClone.filename);
    console.log('Original name:', practiceClone.originalName);

    const filePath = path.join(__dirname, 'uploads', practiceClone.filename);
    console.log('File path:', filePath);

    if (!fs.existsSync(filePath)) {
      console.log('ERROR: File not found on disk at path:', filePath);

      // List all files in uploads directory for debugging
      const uploadDir = path.join(__dirname, 'uploads');
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir);
        console.log('Files in uploads directory:', files);
        console.log('Looking for file:', practiceClone.filename);

        // Check if there's a similar filename
        const matchingFiles = files.filter(f => f.includes(practiceClone.cloneName));
        if (matchingFiles.length > 0) {
          console.log('Found similar files:', matchingFiles);
        }
      } else {
        console.log('ERROR: Uploads directory does not exist:', uploadDir);
      }

      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Check file stats
    const stats = fs.statSync(filePath);
    console.log('File stats:');
    console.log('- Size:', stats.size, 'bytes');
    console.log('- Modified:', stats.mtime);
    console.log('- Is file:', stats.isFile());

    if (stats.size === 0) {
      console.log('ERROR: File is empty (0 bytes)');
      return res.status(500).json({ error: 'File is empty' });
    }

    // Check if it's a valid .ab1 file by reading first few bytes
    const buffer = fs.readFileSync(filePath, { start: 0, end: 16 });
    console.log('First 16 bytes (hex):', buffer.toString('hex'));
    console.log('First 4 bytes as string:', buffer.slice(0, 4).toString());

    const isValidAB1 = buffer.slice(0, 4).toString() === 'ABIF' ||
      (buffer[0] === 0x41 && buffer[1] === 0x42);
    console.log('Appears to be valid .ab1 file:', isValidAB1);

    if (!isValidAB1) {
      console.log('WARNING: File does not appear to be a valid .ab1 file');
    }

    console.log('Sending file download...');
    res.download(filePath, practiceClone.originalName, (err) => {
      if (err) {
        console.log('ERROR during file download:', err);
      } else {
        console.log('File download completed successfully');
      }
    });

  } catch (error) {
    console.error('=== ERROR IN PRACTICE CLONE DOWNLOAD ===');
    console.error('Error:', error);
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

app.get('/api/students/with-progress', authenticateToken, requireRole(['director']), async (req, res) => {
  try {
    console.log('=== OPTIMIZED STUDENTS WITH PROGRESS ENDPOINT ===');

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

    console.log('✓ Students fetched:', students.length);

    // Step 2: Get active practice clones (same as original)
    const allPracticeClones = await prisma.practiceClone.findMany({
      where: {
        isActive: true
      }
    });

    console.log('✓ Active practice clones:', allPracticeClones.length);

    // Step 3: OPTIMIZED - Get all progress in one query instead of N queries
    const allProgressRecords = await prisma.userPracticeProgress.findMany({
      select: {
        userId: true,
        practiceCloneId: true,
        progress: true
      }
    });

    console.log('✓ All progress records fetched:', allProgressRecords.length);

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

    console.log('✓ Students with progress processed:', studentsWithProgress.length);

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

// Help Topics API endpoints
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
app.get('/api/help-topics/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const helpTopic = await prisma.helpTopic.findUnique({
      where: { id },
      include: {
        // You might want to include the related question info too
        analysisQuestion: {
          select: {
            id: true,
            text: true,
            step: true
          }
        }
      }
    });

    if (!helpTopic) {
      return res.status(404).json({ error: 'Help topic not found' });
    }

    res.json(helpTopic);
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
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('=== FORGOT PASSWORD DEBUG ===');
    console.log('Email requested:', email);
    console.log('EMAIL_USER from env:', process.env.EMAIL_USER);
    console.log('EMAIL_PASSWORD exists:', !!process.env.EMAIL_PASSWORD);

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

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    console.log('Reset URL:', resetUrl);

    console.log('Attempting to send email...');
    console.log('From:', process.env.EMAIL_USER);
    console.log('To:', email);

    await emailTransporter.sendMail({
      to: email,
      subject: 'Password Reset Request - DNA Analysis Program',
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your account.</p>
        <p>Click the link below to reset your password (expires in 1 hour):</p>
        <a href="${resetUrl}" style="color: #3B82F6;">${resetUrl}</a>
        <p>If you didn't request this, please ignore this email.</p>
      `
    });

    console.log('Email sent successfully!');
    res.json({ message: 'If an account exists with this email, you will receive reset instructions.' });
  } catch (error) {
    console.error('=== FORGOT PASSWORD ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);

    // More specific error handling
    let errorMessage = 'Error processing request';
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please check email configuration.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Cannot connect to email server.';
    }

    res.status(500).json({
      error: errorMessage,
      details: error.message
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

      // Look for any cached result for this question that's completed or errored
      const cachedResults = analysisData.cachedBlastResults || {};
      const relevantCacheEntries = Object.entries(cachedResults).filter(([key, value]) =>
        key.startsWith(questionId + '_') && (value.status === 'completed' || value.status === 'error')
      );

      if (relevantCacheEntries.length > 0) {
        const [cacheKey, cachedResult] = relevantCacheEntries[0];
        console.log('Found completed cached result for polling request:', cacheKey);
        return res.json({ ...cachedResult, fromCache: true });
      }

      // Check for pending results
      const pendingEntries = Object.entries(cachedResults).filter(([key, value]) =>
        key.startsWith(questionId + '_') && value.status === 'pending'
      );

      if (pendingEntries.length > 0) {
        console.log('Found pending result for polling request');
        return res.json({ status: 'pending', message: 'BLAST search still in progress' });
      }

      // No cached results found at all
      console.log('No cached results found for polling request');
      return res.json({ status: 'no_results', message: 'No BLAST search initiated yet' });
    }

    // Validate sequence for new searches
    if (!sequence || sequence.length < 10) {
      return res.status(400).json({
        error: 'Sequence too short for BLAST analysis (minimum 10 bp)',
        status: 'error'
      });
    }

    // Create cache key from questionId and sequence hash
    const crypto = require('crypto');
    const sequenceHash = crypto.createHash('md5').update(sequence).digest('hex').substring(0, 12);
    const cacheKey = `${questionId}_${sequenceHash}_${program}_${actualDatabase}`;
    console.log('Generated cache key:', cacheKey);

    console.log('Generated cache key:', cacheKey);

    // Check cache first (unless force refresh)
    const cachedResult = analysisData.cachedBlastResults[cacheKey];
    if (!forceRefresh && cachedResult && cachedResult.status === 'completed') {
      console.log('Returning cached BLAST results for', cacheKey);
      return res.json({
        ...cachedResult,
        fromCache: true
      });
    }

    // Check if there's already a pending search for this exact sequence
    if (!forceRefresh && cachedResult && cachedResult.status === 'pending') {
      const pendingTime = new Date() - new Date(cachedResult.searchedAt);
      if (pendingTime < 300000) { // Less than 5 minutes old
        console.log('Found recent pending search, returning pending status');
        return res.json({
          ...cachedResult,
          fromCache: false
        });
      } else {
        console.log('Found stale pending search, will restart');
      }
    }

    console.log('Starting new BLAST search...');

    // Mark as pending
    analysisData.cachedBlastResults[cacheKey] = {
      sequence: sequence.substring(0, 100) + (sequence.length > 100 ? '...' : ''),
      sequenceLength: sequence.length,
      status: 'pending',
      searchedAt: new Date().toISOString(),
      database,
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
    performNCBIBlastSearch(sequence, database, program)
      .then(async (blastResults) => {
        console.log('BLAST search completed successfully! Got', blastResults.length, 'results');

        if (blastResults.length > 0) {
          console.log('First result preview:', {
            accession: blastResults[0].accession,
            definition: blastResults[0].definition?.substring(0, 50) + '...',
            evalue: blastResults[0].evalue
          });
        }

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
          database,
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
            database,
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


app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});