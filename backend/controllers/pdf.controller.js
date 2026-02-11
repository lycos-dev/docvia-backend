const { supabase } = require('../config/supabase');
const fs = require('fs');
const path = require('path');

/**
 * Validate PDF file
 * @param {Buffer} buffer - PDF file buffer
 * @param {string} filename - Original filename
 * @returns {Object} - Validation result
 */
const validatePDF = (buffer, filename) => {
  const errors = [];
  const warnings = [];

  // Check file size (max 50MB)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (buffer.length > maxSize) {
    errors.push(`File size exceeds maximum limit of 50MB. Current size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
  }

  // Check if file is at least 1KB
  if (buffer.length < 1024) {
    errors.push('File size is too small. Minimum size: 1KB');
  }

  // Check PDF magic number (PDF files start with %PDF)
  const pdfSignature = buffer.toString('utf8', 0, 4);
  if (pdfSignature !== '%PDF') {
    errors.push('Invalid PDF file format. File does not start with PDF signature.');
  }

  // Check filename extension
  const ext = path.extname(filename).toLowerCase();
  if (ext !== '.pdf') {
    errors.push(`Invalid file extension. Expected .pdf, got ${ext}`);
  }

  // Check MIME type from magic bytes
  // PDF files have specific byte patterns
  if (!buffer.includes(0x25) || !buffer.includes(0x50)) { // % and P
    warnings.push('File may not be a valid PDF document.');
  }

  // Check for common corruption patterns
  if (buffer.toString('utf8', buffer.length - 5) !== '%%EOF' && 
      buffer.toString('utf8', buffer.length - 6) !== '%%EOF\n' &&
      buffer.toString('utf8', buffer.length - 6) !== '%%EOF\r') {
    warnings.push('PDF may not have proper end-of-file marker.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    fileSize: buffer.length,
    fileSizeMB: (buffer.length / 1024 / 1024).toFixed(2)
  };
};

/**
 * Upload academic PDF document with integrated validation
 * @route POST /api/pdf/upload
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * 
 * FEATURE: Academic PDF Upload
 * Users can upload academic PDF documents to the system.
 * 
 * INTEGRATED FEATURE: PDF File Validation
 * The system checks PDF validity and notifies users if a file is unsupported.
 * Validation happens automatically during the upload process.
 */
const uploadPDF = async (req, res) => {
  try {
    // Check if file is provided
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided',
        message: 'Please upload a PDF file.'
      });
    }

    // ===== INTEGRATED PDF VALIDATION =====
    // The system checks PDF validity and notifies users if a file is unsupported
    const validation = validatePDF(req.file.buffer, req.file.originalname);

    // If PDF is invalid/unsupported, notify user with details
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported or invalid PDF file',
        message: 'The file you uploaded is not a valid PDF document. Please check the errors below.',
        errors: validation.errors,
        warnings: validation.warnings,
        fileInfo: {
          filename: req.file.originalname,
          size: validation.fileSize,
          sizeMB: validation.fileSizeMB,
          mimeType: req.file.mimetype
        }
      });
    }

    // Validation passed - file is a valid/supported PDF
    const uploadWarnings = validation.warnings;

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const filename = `${timestamp}_${randomString}_${req.file.originalname.replace(/\s+/g, '_')}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('academic-pdfs')
      .upload(`pdfs/${filename}`, req.file.buffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload PDF',
        message: uploadError.message || 'Error occurred while uploading file to storage.'
      });
    }

    // Get public URL (for display purposes)
    const { data: publicUrlData } = supabase
      .storage
      .from('academic-pdfs')
      .getPublicUrl(`pdfs/${filename}`);

    const publicUrl = publicUrlData?.publicUrl;

    // Return success response
    res.status(200).json({
      success: true,
      message: 'PDF uploaded successfully',
      warnings: uploadWarnings.length > 0 ? uploadWarnings : undefined,
      data: {
        filename: filename,
        originalFilename: req.file.originalname,
        fileSize: validation.fileSize,
        fileSizeMB: validation.fileSizeMB,
        uploadedAt: new Date().toISOString(),
        publicUrl: publicUrl,
        storagePath: `pdfs/${filename}`
      }
    });

  } catch (error) {
    console.error('PDF upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get uploaded PDFs list
 * @route GET /api/pdf/list
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * 
 * Note: Supabase storage returns file.name with path prefix (e.g., "pdfs/filename.pdf")
 */
const listPDFs = async (req, res) => {
  try {
    const { data, error } = await supabase
      .storage
      .from('academic-pdfs')
      .list('pdfs', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'desc' }
      });

    if (error) {
      console.error('Supabase list error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve PDF list',
        message: error.message
      });
    }

    res.status(200).json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });

  } catch (error) {
    console.error('PDF list error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Delete a PDF from storage
 * @route DELETE /api/pdf/:filename
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deletePDF = async (req, res) => {
  try {
    const { filename } = req.params;

    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Filename is required'
      });
    }

    // Handle both cases: filename with or without 'pdfs/' prefix
    // If the filename already includes 'pdfs/', use it as-is
    // Otherwise, prepend 'pdfs/' to the filename
    const storagePath = filename.startsWith('pdfs/') ? filename : `pdfs/${filename}`;

    const { error } = await supabase
      .storage
      .from('academic-pdfs')
      .remove([storagePath]);

    if (error) {
      console.error('Supabase delete error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete PDF',
        message: error.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'PDF deleted successfully',
      filename: filename
    });

  } catch (error) {
    console.error('PDF delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

module.exports = {
  uploadPDF,
  listPDFs,
  deletePDF,
  validatePDF // Export for internal use only
};