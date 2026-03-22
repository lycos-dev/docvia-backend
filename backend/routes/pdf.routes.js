const express = require('express');
const router  = express.Router();
const multer  = require('multer');

const { uploadPDF, listPDFs, deletePDF, renamePDF } = require('../controllers/pdf.controller');
const {
  segmentPDFEndpoint,
  getSegmentsEndpoint,
  deleteSegmentsEndpoint,
  chatWithSegmentEndpoint,
  generateMicrotaskEndpoint,
  evaluateMicrotaskEndpoint,
} = require('../controllers/segmentation.controller');
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

// ── PDF CRUD ──────────────────────────────────────────────────────────────────
router.post('/upload', upload.single('pdf'), uploadPDF);
router.get('/list', listPDFs);

// ── SEGMENTATION ──────────────────────────────────────────────────────────────
router.post('/segment', segmentPDFEndpoint);

// ── AI CHAT ───────────────────────────────────────────────────────────────────
router.post('/chat', chatWithSegmentEndpoint);

// ── MICRO-TASKS ───────────────────────────────────────────────────────────────
router.post('/microtask/generate', generateMicrotaskEndpoint);
router.post('/microtask/evaluate', evaluateMicrotaskEndpoint);

// ── PROGRESS TRACKING ─────────────────────────────────────────────────────────
// GET all progress for a user (for dashboard visualization)
router.get('/progress', getAllProgressEndpoint);
// POST save progress for one document
router.post('/progress', saveProgressEndpoint);
// GET progress for one document
router.get('/progress/:pdfId', getProgressEndpoint);

// ── RENAME ────────────────────────────────────────────────────────────────────
// NOTE: must come before the generic /:filename DELETE wildcard
router.patch('/:filename/rename', renamePDF);

// ── PER-PDF SEGMENT DATA ──────────────────────────────────────────────────────
// Wildcard routes last
router.get('/:pdfId/segments', getSegmentsEndpoint);
router.delete('/:pdfId/segments', deleteSegmentsEndpoint);
router.delete('/:filename', deletePDF);

// ── Multer error handler ──────────────────────────────────────────────────────
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'FILE_TOO_LARGE')   return res.status(400).json({ success:false, error:'File too large', message:'Maximum file size is 50MB' });
    if (error.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ success:false, error:'Too many files', message:'Only one file at a time' });
  }
  if (error.message === 'Only PDF files are allowed') return res.status(400).json({ success:false, error:'Invalid file type', message:'Only PDF files are supported.' });
  if (error) return res.status(400).json({ success:false, error:error.message||'Upload error' });
  next();
});

module.exports = router;