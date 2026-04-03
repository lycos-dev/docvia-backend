const express = require('express');
const router  = express.Router();
const multer  = require('multer');

const { authenticateToken } = require('../middleware/auth.middleware');
const { uploadPDF, listPDFs, deletePDF, renamePDF, getFile } = require('../controllers/pdf.controller');
const {
  segmentPDFEndpoint,
  getSegmentsEndpoint,
  deleteSegmentsEndpoint,
  chatWithSegmentEndpoint,
  generateMicrotaskEndpoint,
  evaluateMicrotaskEndpoint,
} = require('../controllers/segmentation.controller');
const {
  generateLessonsEndpoint,
  getLessonsEndpoint,
  deleteLessonsEndpoint,
  deepExplainEndpoint,
} = require('../controllers/lessons.controller');
const {
  saveProgressEndpoint,
  getProgressEndpoint,
  getAllProgressEndpoint,
} = require('../controllers/progress.controller');

// ── Multer ────────────────────────────────────────────────────────────────────
const storage    = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

// ── All PDF routes require authentication ─────────────────────────────────────
router.use(authenticateToken);

// ── PDF CRUD ──────────────────────────────────────────────────────────────────
router.post('/upload', upload.single('pdf'), uploadPDF);
router.get('/list', listPDFs);
router.get('/file/:filename', getFile);

// ── SEGMENTATION ──────────────────────────────────────────────────────────────
router.post('/segment', segmentPDFEndpoint);

// ── AI CHAT ───────────────────────────────────────────────────────────────────
router.post('/chat', chatWithSegmentEndpoint);

// ── LESSON GENERATION ─────────────────────────────────────────────────────────
router.post('/lessons/generate',     generateLessonsEndpoint);
router.post('/lessons/deep-explain', deepExplainEndpoint);
router.get('/lessons/:pdfId',        getLessonsEndpoint);
router.delete('/lessons/:pdfId',     deleteLessonsEndpoint);

// ── MICRO-TASKS ───────────────────────────────────────────────────────────────
router.post('/microtask/generate', generateMicrotaskEndpoint);
router.post('/microtask/evaluate', evaluateMicrotaskEndpoint);

// ── PROGRESS TRACKING ─────────────────────────────────────────────────────────
router.get('/progress',         getAllProgressEndpoint);
router.post('/progress',        saveProgressEndpoint);
router.get('/progress/:pdfId',  getProgressEndpoint);

// ── RENAME (must come before wildcard DELETE) ─────────────────────────────────
router.patch('/:filename/rename', renamePDF);

// ── PER-PDF SEGMENT DATA ──────────────────────────────────────────────────────
router.get('/:pdfId/segments',    getSegmentsEndpoint);
router.delete('/:pdfId/segments', deleteSegmentsEndpoint);
router.delete('/:filename',       deletePDF);

// ── Multer error handler ──────────────────────────────────────────────────────
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'FILE_TOO_LARGE')   return res.status(400).json({ success: false, error: 'File too large', message: 'Maximum file size is 50MB' });
    if (error.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ success: false, error: 'Too many files', message: 'Only one file at a time' });
  }
  if (error.message === 'Only PDF files are allowed') return res.status(400).json({ success: false, error: 'Invalid file type', message: 'Only PDF files are supported.' });
  if (error) return res.status(400).json({ success: false, error: error.message || 'Upload error' });
  next();
});

module.exports = router;