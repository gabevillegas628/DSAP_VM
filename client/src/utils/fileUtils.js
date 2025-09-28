export const getDisplayFilename = (clone) => {
  if (clone.type === 'practice') {
    // For practice clones, prefer originalName, or extract from path as fallback
    return clone.originalName || clone.filename?.split('/').pop() || clone.filename;
  }
  // For regular clones, use existing logic
  return clone.filename || clone.originalName;
};