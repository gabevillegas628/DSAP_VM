// utils/importExportValidation.js

/**
 * Enhanced validation utilities for import/export operations
 * Ensures help topics are correctly linked to questions during imports
 */

// Simple text similarity function using Levenshtein distance
const calculateTextSimilarity = (text1, text2) => {
  const longer = text1.length > text2.length ? text1 : text2;
  const shorter = text1.length > text2.length ? text2 : text1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

// Levenshtein distance calculation
const levenshteinDistance = (str1, str2) => {
  const matrix = Array.from({ length: str2.length + 1 }, (_, i) => i);
  
  for (let i = 0; i < str1.length; i++) {
    matrix[0] = i + 1;
    for (let j = 0; j < str2.length; j++) {
      const cost = str1[i] === str2[j] ? 0 : 1;
      matrix[j + 1] = Math.min(
        matrix[j] + 1,      // deletion
        matrix[j + 1] + 1,  // insertion
        matrix[j] + cost    // substitution
      );
    }
  }
  
  return matrix[str2.length];
};

// Enhanced question matching with fuzzy logic
const findMatchingQuestion = async (exportedQuestion, questionIdMapping, prisma) => {
  // First try exact ID mapping
  const mappedId = questionIdMapping.get(exportedQuestion.id);
  if (mappedId) {
    const mappedQuestion = await prisma.analysisQuestion.findUnique({
      where: { id: mappedId }
    });
    
    // Validate that the mapped question actually matches the exported question
    if (mappedQuestion && 
        mappedQuestion.step === exportedQuestion.step &&
        mappedQuestion.order === exportedQuestion.order &&
        mappedQuestion.text.trim() === exportedQuestion.text.trim()) {
      return { question: mappedQuestion, confidence: 'exact' };
    }
    
    // ID mapping exists but details don't match - potential issue
    console.warn(`Question ID mapping found but details don't match:
      Exported: ${exportedQuestion.step}-${exportedQuestion.order}: "${exportedQuestion.text}"
      Found: ${mappedQuestion?.step}-${mappedQuestion?.order}: "${mappedQuestion?.text}"`);
  }
  
  // Try exact match by content
  const exactMatch = await prisma.analysisQuestion.findFirst({
    where: {
      step: exportedQuestion.step,
      order: exportedQuestion.order,
      text: exportedQuestion.text.trim()
    }
  });
  
  if (exactMatch) {
    return { question: exactMatch, confidence: 'exact' };
  }
  
  // Try fuzzy match (same step/order, similar text)
  const stepOrderMatches = await prisma.analysisQuestion.findMany({
    where: {
      step: exportedQuestion.step,
      order: exportedQuestion.order
    }
  });
  
  // Check for high similarity matches
  for (const candidate of stepOrderMatches) {
    const similarity = calculateTextSimilarity(
      exportedQuestion.text.trim().toLowerCase(),
      candidate.text.trim().toLowerCase()
    );
    
    if (similarity > 0.9) { // 90% similarity threshold
      return { question: candidate, confidence: 'fuzzy' };
    }
  }
  
  // Try broader fuzzy match (same step, any order, high similarity)
  const stepMatches = await prisma.analysisQuestion.findMany({
    where: {
      step: exportedQuestion.step
    }
  });
  
  for (const candidate of stepMatches) {
    const similarity = calculateTextSimilarity(
      exportedQuestion.text.trim().toLowerCase(),
      candidate.text.trim().toLowerCase()
    );
    
    if (similarity > 0.95) { // Higher threshold for cross-order matches
      return { 
        question: candidate, 
        confidence: 'fuzzy-cross-order',
        warning: `Order mismatch: exported order ${exportedQuestion.order}, found order ${candidate.order}`
      };
    }
  }
  
  return { question: null, confidence: 'none' };
};

// Validate question-help topic relationship integrity
const validateQuestionHelpTopicRelationship = (exportedQuestion, masterHelpTopic, matchedQuestion) => {
  const warnings = [];
  
  // Check if step matches
  if (exportedQuestion.step !== matchedQuestion.step) {
    warnings.push(`Step mismatch: expected ${exportedQuestion.step}, found ${matchedQuestion.step}`);
  }
  
  // Check if order is significantly different
  if (Math.abs(exportedQuestion.order - matchedQuestion.order) > 2) {
    warnings.push(`Significant order difference: expected ${exportedQuestion.order}, found ${matchedQuestion.order}`);
  }
  
  // Check if question type matches (if available)
  if (exportedQuestion.type && matchedQuestion.type && 
      exportedQuestion.type !== matchedQuestion.type) {
    warnings.push(`Question type mismatch: expected ${exportedQuestion.type}, found ${matchedQuestion.type}`);
  }
  
  return warnings;
};

// Validate master/child help topic structure
const validateMasterChildStructure = (masterHelpTopic) => {
  const warnings = [];
  
  if (!masterHelpTopic.helpTopics || masterHelpTopic.helpTopics.length === 0) {
    warnings.push(`Master help topic "${masterHelpTopic.title}" has no child topics`);
  }
  
  // Check for duplicate child titles
  const childTitles = masterHelpTopic.helpTopics.map(child => child.title);
  const duplicates = childTitles.filter((title, index) => childTitles.indexOf(title) !== index);
  if (duplicates.length > 0) {
    warnings.push(`Duplicate child topic titles found: ${duplicates.join(', ')}`);
  }
  
  // Validate child topic order sequence
  const orders = masterHelpTopic.helpTopics.map(child => child.order || 0).sort((a, b) => a - b);
  for (let i = 1; i < orders.length; i++) {
    if (orders[i] === orders[i - 1]) {
      warnings.push(`Duplicate order values found in child topics`);
      break;
    }
  }
  
  return warnings;
};

// Export all functions
module.exports = {
  findMatchingQuestion,
  calculateTextSimilarity,
  levenshteinDistance,
  validateQuestionHelpTopicRelationship,
  validateMasterChildStructure
};