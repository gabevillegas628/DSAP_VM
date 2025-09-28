// Universal statusConstraints.js - Uses CommonJS for compatibility with both environments

const CLONE_STATUSES = {
  // Student working states
  BEING_WORKED_ON: 'Being worked on by student',
  UNASSIGNED: 'Unassigned',
  AVAILABLE: 'Available', // For practice clones

  // Submission states
  COMPLETED_WAITING_REVIEW: 'Completed, waiting review by staff',
  CORRECTED_WAITING_REVIEW: 'Corrected by student, waiting review',

  // Review states (instructor feedback)
  NEEDS_REANALYSIS: 'Reviewed, needs to be reanalyzed',
  NEEDS_CORRECTIONS: 'Needs corrections from student', // Alternative naming
  REVIEWED_BY_TEACHER: 'Reviewed by teacher', // New status - set when instructor approves
  
  // Director review states
  REVIEWED_CORRECT: 'Reviewed and Correct', // Keep for backward compatibility
  TO_BE_SUBMITTED_NCBI: 'To be submitted to NCBI', // New - director selectable
  SUBMITTED_TO_NCBI: 'Submitted to NCBI', // New - director selectable
  UNREADABLE: 'Unreadable' // New - director selectable
};

// All valid status values in one array for validation
const ALL_VALID_STATUSES = Object.values(CLONE_STATUSES);

// Status validation function
const isValidStatus = (status) => {
  return ALL_VALID_STATUSES.includes(status) || status === null || status === '';
};

// Status groups for business logic
const STATUS_GROUPS = {
  // When students can edit their work
  STUDENT_EDITABLE: [
    CLONE_STATUSES.BEING_WORKED_ON,
    CLONE_STATUSES.NEEDS_REANALYSIS,
    CLONE_STATUSES.NEEDS_CORRECTIONS,
    CLONE_STATUSES.UNASSIGNED,
    CLONE_STATUSES.AVAILABLE,
    CLONE_STATUSES.REVIEWED_CORRECT,  // Students can still edit even after approval
    null,
    ''
  ],

  // When interface should be read-only
  READ_ONLY: [
    CLONE_STATUSES.COMPLETED_WAITING_REVIEW,
    CLONE_STATUSES.CORRECTED_WAITING_REVIEW,
    CLONE_STATUSES.REVIEWED_BY_TEACHER, // Read-only for students after teacher review
    CLONE_STATUSES.TO_BE_SUBMITTED_NCBI,
    CLONE_STATUSES.SUBMITTED_TO_NCBI,
    CLONE_STATUSES.UNREADABLE
  ],

  // Ready for instructor review
  REVIEW_READY: [
    CLONE_STATUSES.COMPLETED_WAITING_REVIEW,
    CLONE_STATUSES.CORRECTED_WAITING_REVIEW
  ],

  // Ready for director review (teacher-reviewed items)
  DIRECTOR_REVIEW_READY: [
    CLONE_STATUSES.REVIEWED_BY_TEACHER
  ],

  // Should show instructor feedback
  SHOW_FEEDBACK: [
    CLONE_STATUSES.NEEDS_REANALYSIS,
    CLONE_STATUSES.NEEDS_CORRECTIONS,
    CLONE_STATUSES.REVIEWED_CORRECT,
    CLONE_STATUSES.REVIEWED_BY_TEACHER
  ]
};

// Helper functions for business logic
const canStudentEdit = (status) => {
  return STATUS_GROUPS.STUDENT_EDITABLE.includes(status);
};

const isReadOnly = (status) => {
  return STATUS_GROUPS.READ_ONLY.includes(status);
};

const isReviewReady = (status) => {
  return STATUS_GROUPS.REVIEW_READY.includes(status);
};

const isDirectorReviewReady = (status) => {
  return STATUS_GROUPS.DIRECTOR_REVIEW_READY.includes(status);
};

const shouldShowFeedback = (status) => {
  return STATUS_GROUPS.SHOW_FEEDBACK.includes(status);
};

// Status transitions - what statuses can change to what
const STATUS_TRANSITIONS = {
  [CLONE_STATUSES.UNASSIGNED]: [CLONE_STATUSES.BEING_WORKED_ON],
  [CLONE_STATUSES.AVAILABLE]: [CLONE_STATUSES.BEING_WORKED_ON],
  [CLONE_STATUSES.BEING_WORKED_ON]: [
    CLONE_STATUSES.COMPLETED_WAITING_REVIEW,
    CLONE_STATUSES.CORRECTED_WAITING_REVIEW,
    CLONE_STATUSES.UNASSIGNED
  ],
  [CLONE_STATUSES.COMPLETED_WAITING_REVIEW]: [
    CLONE_STATUSES.REVIEWED_BY_TEACHER, // Instructor approves
    CLONE_STATUSES.NEEDS_REANALYSIS,
    CLONE_STATUSES.NEEDS_CORRECTIONS
  ],
  [CLONE_STATUSES.CORRECTED_WAITING_REVIEW]: [
    CLONE_STATUSES.REVIEWED_BY_TEACHER, // Instructor approves
    CLONE_STATUSES.NEEDS_REANALYSIS,
    CLONE_STATUSES.NEEDS_CORRECTIONS
  ],
  [CLONE_STATUSES.NEEDS_REANALYSIS]: [
    CLONE_STATUSES.BEING_WORKED_ON,
    CLONE_STATUSES.CORRECTED_WAITING_REVIEW
  ],
  [CLONE_STATUSES.NEEDS_CORRECTIONS]: [
    CLONE_STATUSES.BEING_WORKED_ON,
    CLONE_STATUSES.CORRECTED_WAITING_REVIEW
  ],
  [CLONE_STATUSES.REVIEWED_BY_TEACHER]: [
    // Director can set these manually
    CLONE_STATUSES.TO_BE_SUBMITTED_NCBI,
    CLONE_STATUSES.SUBMITTED_TO_NCBI,
    CLONE_STATUSES.UNREADABLE,
    CLONE_STATUSES.NEEDS_REANALYSIS // Director can send back for corrections
  ],
  [CLONE_STATUSES.TO_BE_SUBMITTED_NCBI]: [
    CLONE_STATUSES.SUBMITTED_TO_NCBI,
    CLONE_STATUSES.UNREADABLE
  ],
  [CLONE_STATUSES.SUBMITTED_TO_NCBI]: [
    CLONE_STATUSES.TO_BE_SUBMITTED_NCBI // Can go back if needed
  ],
  [CLONE_STATUSES.UNREADABLE]: [
    CLONE_STATUSES.NEEDS_REANALYSIS // Can send back for re-analysis
  ]
};

// Status transition validation
const isValidStatusTransition = (fromStatus, toStatus) => {
  if (!fromStatus) return true; // Allow any transition from null/empty
  const allowedTransitions = STATUS_TRANSITIONS[fromStatus] || [];
  return allowedTransitions.includes(toStatus);
};

// Status display configurations for UI
const STATUS_CONFIGS = {
  [CLONE_STATUSES.BEING_WORKED_ON]: {
    icon: 'Settings',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    iconColor: 'text-blue-600',
    badgeColor: 'bg-blue-100 text-blue-600',
    title: 'Being Worked On',
    message: 'Student is currently working on this assignment.',
    showRefresh: true,
    showFeedbackButton: false
  },

  [CLONE_STATUSES.COMPLETED_WAITING_REVIEW]: {
    icon: 'Clock',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-800',
    iconColor: 'text-amber-600',
    badgeColor: 'bg-amber-100 text-amber-600',
    title: 'Waiting for Review',
    message: 'Your submission is complete and waiting for instructor review.',
    showRefresh: false,
    showFeedbackButton: false
  },

  [CLONE_STATUSES.NEEDS_REANALYSIS]: {
    icon: 'AlertCircle',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    iconColor: 'text-red-600',
    badgeColor: 'bg-red-100 text-red-600',
    title: 'Needs Reanalysis',
    message: 'Your instructor has reviewed your work and it needs to be reanalyzed.',
    showRefresh: false,
    showFeedbackButton: true
  },

  [CLONE_STATUSES.NEEDS_CORRECTIONS]: {
    icon: 'AlertCircle',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-800',
    iconColor: 'text-orange-600',
    badgeColor: 'bg-orange-100 text-orange-600',
    title: 'Needs Corrections',
    message: 'Your instructor has reviewed your work and some corrections are needed.',
    showRefresh: false,
    showFeedbackButton: true
  },

  [CLONE_STATUSES.CORRECTED_WAITING_REVIEW]: {
    icon: 'RotateCcw',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-800',
    iconColor: 'text-purple-600',
    badgeColor: 'bg-purple-100 text-purple-600',
    title: 'Resubmitted for Review',
    message: 'Your corrections have been submitted and are waiting for review.',
    showRefresh: false,
    showFeedbackButton: false
  },

  [CLONE_STATUSES.REVIEWED_BY_TEACHER]: {
    icon: 'CheckCircle',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    iconColor: 'text-green-600',
    badgeColor: 'bg-green-100 text-green-600',
    title: 'Reviewed by Teacher',
    message: 'Your work has been reviewed and approved by your instructor. Awaiting final director review.',
    showRefresh: false,
    showFeedbackButton: true
  },

  [CLONE_STATUSES.REVIEWED_CORRECT]: {
    icon: 'CheckCircle',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    iconColor: 'text-green-600',
    badgeColor: 'bg-green-100 text-green-600',
    title: 'Reviewed and Correct',
    message: 'Great work! Your analysis has been reviewed and is correct.',
    showRefresh: false,
    showFeedbackButton: true
  },

  [CLONE_STATUSES.TO_BE_SUBMITTED_NCBI]: {
    icon: 'Upload',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    textColor: 'text-indigo-800',
    iconColor: 'text-indigo-600',
    badgeColor: 'bg-indigo-100 text-indigo-600',
    title: 'To be Submitted to NCBI',
    message: 'This analysis is ready for submission to NCBI.',
    showRefresh: false,
    showFeedbackButton: false
  },

  [CLONE_STATUSES.SUBMITTED_TO_NCBI]: {
    icon: 'CheckCircle2',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-800',
    iconColor: 'text-emerald-600',
    badgeColor: 'bg-emerald-100 text-emerald-600',
    title: 'Submitted to NCBI',
    message: 'This analysis has been successfully submitted to NCBI.',
    showRefresh: false,
    showFeedbackButton: false
  },

  [CLONE_STATUSES.UNREADABLE]: {
    icon: 'XCircle',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    textColor: 'text-gray-800',
    iconColor: 'text-gray-600',
    badgeColor: 'bg-gray-100 text-gray-600',
    title: 'Unreadable',
    message: 'This sequence data is unreadable and cannot be processed.',
    showRefresh: false,
    showFeedbackButton: false
  },

  [CLONE_STATUSES.UNASSIGNED]: {
    icon: 'AlertCircle',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    textColor: 'text-gray-800',
    iconColor: 'text-gray-600',
    badgeColor: 'bg-gray-100 text-gray-600',
    title: 'Unassigned',
    message: 'This clone is not yet assigned to a student.',
    showRefresh: false,
    showFeedbackButton: false
  },

  [CLONE_STATUSES.AVAILABLE]: {
    icon: 'AlertCircle',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    textColor: 'text-gray-800',
    iconColor: 'text-gray-600',
    badgeColor: 'bg-gray-100 text-gray-600',
    title: 'Available',
    message: 'This practice clone is available for student analysis.',
    showRefresh: false,
    showFeedbackButton: false
  }
};

// Get status display config with fallback
const getStatusConfig = (status) => {
  return STATUS_CONFIGS[status] || {
    icon: 'AlertCircle',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    textColor: 'text-gray-800',
    iconColor: 'text-gray-600',
    badgeColor: 'bg-gray-100 text-gray-600',
    title: 'Unknown Status',
    message: `Status: ${status}`,
    showRefresh: false,
    showFeedbackButton: false
  };
};

// Review status mapping for filtering in review components
const REVIEW_STATUS_MAP = {
  [CLONE_STATUSES.COMPLETED_WAITING_REVIEW]: 'pending',
  [CLONE_STATUSES.CORRECTED_WAITING_REVIEW]: 'resubmitted',
  [CLONE_STATUSES.REVIEWED_BY_TEACHER]: 'teacher_reviewed' // New status for director review queue
};

const getReviewStatus = (status) => {
  return REVIEW_STATUS_MAP[status] || null;
};

// Status mapping for review actions (approve/reject)
const REVIEW_ACTION_MAP = {
  'approved': CLONE_STATUSES.REVIEWED_BY_TEACHER, // Changed from REVIEWED_CORRECT
  'rejected': CLONE_STATUSES.NEEDS_REANALYSIS  // Use NEEDS_REANALYSIS for better workflow
};

// Dropdown options for director interfaces - includes manually selectable statuses
const STATUS_DROPDOWN_OPTIONS = [
  { value: CLONE_STATUSES.BEING_WORKED_ON, label: 'Being worked on by student' },
  { value: CLONE_STATUSES.COMPLETED_WAITING_REVIEW, label: 'Completed, waiting review by staff' },
  { value: CLONE_STATUSES.NEEDS_REANALYSIS, label: 'Reviewed, needs to be reanalyzed' },
  { value: CLONE_STATUSES.NEEDS_CORRECTIONS, label: 'Needs corrections from student' },
  { value: CLONE_STATUSES.CORRECTED_WAITING_REVIEW, label: 'Corrected by student, waiting review' },
  { value: CLONE_STATUSES.REVIEWED_BY_TEACHER, label: 'Reviewed by teacher' },
  { value: CLONE_STATUSES.REVIEWED_CORRECT, label: 'Reviewed and Correct' }
];

// Director-specific dropdown options for manual status changes
const DIRECTOR_STATUS_OPTIONS = [
  { value: CLONE_STATUSES.TO_BE_SUBMITTED_NCBI, label: 'To be submitted to NCBI' },
  { value: CLONE_STATUSES.SUBMITTED_TO_NCBI, label: 'Submitted to NCBI' },
  { value: CLONE_STATUSES.UNREADABLE, label: 'Unreadable' },
  { value: CLONE_STATUSES.NEEDS_REANALYSIS, label: 'Send back for reanalysis' }
];

// Progress calculation helpers
const getStatusProgressWeight = (status) => {
  switch (status) {
    case CLONE_STATUSES.UNASSIGNED:
    case CLONE_STATUSES.AVAILABLE:
      return 0;
    case CLONE_STATUSES.BEING_WORKED_ON:
      return 0.25;
    case CLONE_STATUSES.COMPLETED_WAITING_REVIEW:
      return 0.75;
    case CLONE_STATUSES.NEEDS_REANALYSIS:
    case CLONE_STATUSES.NEEDS_CORRECTIONS:
      return 0.5;
    case CLONE_STATUSES.CORRECTED_WAITING_REVIEW:
      return 0.75;
    case CLONE_STATUSES.REVIEWED_BY_TEACHER:
      return 0.9;
    case CLONE_STATUSES.REVIEWED_CORRECT:
    case CLONE_STATUSES.TO_BE_SUBMITTED_NCBI:
    case CLONE_STATUSES.SUBMITTED_TO_NCBI:
      return 1.0;
    case CLONE_STATUSES.UNREADABLE:
      return 0.1; // Low progress for unreadable
    default:
      return 0;
  }
};

// Development helper - logs a warning if an invalid status is used
const validateAndWarnStatus = (status, componentName = 'Unknown Component') => {
  if (!isValidStatus(status) && status !== null && status !== '') {
    console.warn(`⚠️  Invalid status "${status}" used in ${componentName}. Valid statuses are:`, ALL_VALID_STATUSES);
  }
  return status;
};

// CommonJS export (works in both Node.js and modern bundlers)
module.exports = {
  // Core constants
  CLONE_STATUSES,
  ALL_VALID_STATUSES,

  // Validation functions
  isValidStatus,
  isValidStatusTransition,

  // Business logic functions
  canStudentEdit,
  isReadOnly,
  isReviewReady,
  isDirectorReviewReady,
  shouldShowFeedback,

  // Status configuration
  STATUS_CONFIGS,
  getStatusConfig,

  // Review mappings
  REVIEW_STATUS_MAP,
  getReviewStatus,
  REVIEW_ACTION_MAP,

  // Dropdown options
  STATUS_DROPDOWN_OPTIONS,
  DIRECTOR_STATUS_OPTIONS,

  // Helper functions
  getStatusProgressWeight,
  validateAndWarnStatus,

  // Status groups
  STATUS_GROUPS
};