const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth.middleware');
const {
  uploadPDF,
  listPDFs,
  deletePDF
} = require('../controllers/pdf.controller');

// Configure multer for PDF uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept only PDF files
  if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max size
  }
});

/**
 * @route   POST /api/pdf/upload
 * @desc    Upload academic PDF document with integrated validation
 *          The system checks PDF validity and notifies users if a file is unsupported
 * @access  Public
 */
router.post('/upload', upload.single('pdf'), uploadPDF);

/**
 * @route   GET /api/pdf/list
 * @desc    Get list of uploaded PDFs
 * @access  Public
 */
router.get('/list', listPDFs);

/**
 * @route   DELETE /api/pdf/:filename
 * @desc    Delete a PDF from storage
 * @access  Public (for testing) - Can be made Private with authenticateToken
 */
router.delete('/:filename', deletePDF);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'FILE_TOO_LARGE') {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        message: 'Maximum file size is 50MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files',
        message: 'Only one file can be uploaded at a time'
      });
    }
  }

  if (error.message === 'Only PDF files are allowed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid file type',
      message: 'Only PDF files are supported. Please upload a valid PDF document.'
    });
  }

  if (error) {
    return res.status(400).json({
      success: false,
      error: error.message || 'File upload error',
      message: error.message
    });
  }

  next();
});

module.exports = router;