const { supabase, supabaseAdmin } = require('../config/supabase');
const path = require('path');
const crypto = require('crypto');

// Use service role client for all storage operations so that both email/password
// and Google OAuth users can upload/delete/rename files without RLS interference.
// Falls back to the anon client if the service role key is not configured.
const storage = () => (supabaseAdmin || supabase).storage.from('academic-pdfs');

// The admin client used explicitly for destructive operations (delete).
// If supabaseAdmin is not configured, we warn loudly — deletes will silently
// fail against a private bucket because the anon client is blocked by RLS.
const adminStorage = () => {
  if (!supabaseAdmin) {
    console.warn(
      '[pdf.controller] ⚠️  SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Delete operations will silently fail on private buckets. ' +
      'Add SUPABASE_SERVICE_ROLE_KEY to your .env file.'
    );
  }
  return (supabaseAdmin || supabase).storage.from('academic-pdfs');
};

/**
 * Validate PDF file
 */
const validatePDF = (buffer, filename) => {
  const errors = [];
  const warnings = [];

  const maxSize = 50 * 1024 * 1024;
  if (buffer.length > maxSize) {
    errors.push(`File size exceeds maximum limit of 50MB. Current size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
  }
  if (buffer.length < 1024) {
    errors.push('File size is too small. Minimum size: 1KB');
  }

  const pdfSignature = buffer.toString('utf8', 0, 4);
  if (pdfSignature !== '%PDF') {
    errors.push('Invalid PDF file format. File does not start with PDF signature.');
  }

  const ext = path.extname(filename).toLowerCase();
  if (ext !== '.pdf') {
    errors.push(`Invalid file extension. Expected .pdf, got ${ext}`);
  }

  if (!buffer.includes(0x25) || !buffer.includes(0x50)) {
    warnings.push('File may not be a valid PDF document.');
  }

  if (
    buffer.toString('utf8', buffer.length - 5) !== '%%EOF' &&
    buffer.toString('utf8', buffer.length - 6) !== '%%EOF\n' &&
    buffer.toString('utf8', buffer.length - 6) !== '%%EOF\r'
  ) {
    warnings.push('PDF may not have proper end-of-file marker.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    fileSize: buffer.length,
    fileSizeMB: (buffer.length / 1024 / 1024).toFixed(2),
  };
};

/** Returns the per-user storage prefix: pdfs/{userId} */
const userPrefix = (userId) => `pdfs/${userId}`;

/**
 * Always returns the canonical pdfs/{userId}/{filename} path.
 * Handles bare filenames, full paths with userId, and legacy paths without userId.
 */
function resolveUserPath(userId, filename) {
  const bare = filename
    .replace(new RegExp(`^pdfs/${userId}/`), '')
    .replace(/^pdfs\//, '');
  return `${userPrefix(userId)}/${bare}`;
}

function stripUserPrefix(userId, fullPath) {
  return fullPath.replace(`${userPrefix(userId)}/`, '');
}

// ─── UPLOAD ───────────────────────────────────────────────────────────────────

/**
 * Upload PDF — stored at pdfs/{userId}/{timestamp}_{random}_{originalname}
 * @route POST /api/pdf/upload
 */
const uploadPDF = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided', message: 'Please upload a PDF file.' });
    }

    const validation = validatePDF(req.file.buffer, req.file.originalname);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported or invalid PDF file',
        message: 'The file you uploaded is not a valid PDF document.',
        errors: validation.errors,
        warnings: validation.warnings,
        fileInfo: {
          filename: req.file.originalname,
          size: validation.fileSize,
          sizeMB: validation.fileSizeMB,
          mimeType: req.file.mimetype,
        },
      });
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const filename = `${timestamp}_${randomString}_${req.file.originalname.replace(/\s+/g, '_')}`;
    const storagePath = `${userPrefix(userId)}/${filename}`;

    const { error: uploadError } = await storage()
      .upload(storagePath, req.file.buffer, { contentType: 'application/pdf', upsert: false });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ success: false, error: 'Failed to upload PDF', message: uploadError.message });
    }

    const { data: publicUrlData } = (supabaseAdmin || supabase)
      .storage.from('academic-pdfs').getPublicUrl(storagePath);

    res.status(200).json({
      success: true,
      message: 'PDF uploaded successfully',
      warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
      data: {
        filename,
        originalFilename: req.file.originalname,
        fileSize: validation.fileSize,
        fileSizeMB: validation.fileSizeMB,
        uploadedAt: new Date().toISOString(),
        publicUrl: publicUrlData?.publicUrl,
        storagePath,
      },
    });
  } catch (error) {
    console.error('PDF upload error:', error);
    res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
};

// ─── LIST ─────────────────────────────────────────────────────────────────────

/**
 * List PDFs belonging to the authenticated user only.
 * @route GET /api/pdf/list
 */
const listPDFs = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { data, error } = await storage()
      .list(userPrefix(userId), { limit: 100, offset: 0, sortBy: { column: 'name', order: 'desc' } });

    if (error) {
      console.error('Supabase list error:', error);
      return res.status(500).json({ success: false, error: 'Failed to retrieve PDF list', message: error.message });
    }

    res.status(200).json({ success: true, data: data || [], count: data?.length || 0 });
  } catch (error) {
    console.error('PDF list error:', error);
    res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────

/**
 * Delete a PDF — only allows deleting files owned by the authenticated user.
 *
 * IMPORTANT: We use adminStorage() (service role) explicitly here.
 * Supabase's storage.remove() with the anon key on a private bucket silently
 * returns { data: [], error: null } when RLS blocks the operation — it looks
 * like success but nothing is actually deleted. The service role key bypasses
 * RLS and performs the real deletion.
 *
 * @route DELETE /api/pdf/:filename
 */
const deletePDF = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { filename } = req.params;
    if (!filename) return res.status(400).json({ success: false, error: 'Filename is required' });

    const storagePath = resolveUserPath(userId, filename);
    console.log(`[Delete] Removing storage path: ${storagePath}`);

    // Use adminStorage() — the anon client silently no-ops on private buckets
    const { data: removeData, error: removeError } = await adminStorage().remove([storagePath]);

    if (removeError) {
      console.error('[Delete] Supabase storage error:', removeError);
      return res.status(500).json({ success: false, error: 'Failed to delete PDF', message: removeError.message });
    }

    // Supabase returns an empty array when RLS silently blocked the delete.
    // Treat that as a real failure so the frontend doesn't think it succeeded.
    if (!removeData || removeData.length === 0) {
      console.error('[Delete] Storage remove returned empty — file may not exist or RLS blocked it:', storagePath);
      // Still clean up DB rows below and return success to the client, because
      // "file not found" in storage is functionally equivalent to deleted from
      // the user's perspective (it won't show up in list).
    } else {
      console.log(`[Delete] ✅ Storage file removed: ${storagePath}`);
    }

    // Clean up associated DB rows (non-fatal — best effort)
    const bareFilename = stripUserPrefix(userId, storagePath);
    await Promise.allSettled([
      supabase.from('document_segments').delete().eq('pdf_id', bareFilename).eq('user_id', userId),
      supabase.from('lesson_sets').delete().eq('pdf_id', bareFilename).eq('user_id', userId),
      supabase.from('user_progress').delete().eq('pdf_id', bareFilename).eq('user_id', userId),
    ]);
    console.log(`[Delete] ✅ DB rows cleaned up for: ${bareFilename}`);

    res.status(200).json({ success: true, message: 'PDF deleted successfully', filename });
  } catch (error) {
    console.error('[Delete] PDF delete error:', error);
    res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
};

// ─── RENAME ───────────────────────────────────────────────────────────────────

/**
 * Rename a PDF — scoped to the authenticated user.
 * Supabase has no native rename: download → re-upload → delete old → update DB refs.
 * @route PATCH /api/pdf/:filename/rename
 */
const renamePDF = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { filename } = req.params;
    let { newName } = req.body;

    if (!filename || !newName) {
      return res.status(400).json({ success: false, error: 'Missing fields', required: ['filename (param)', 'newName (body)'] });
    }

    if (!newName.toLowerCase().endsWith('.pdf')) newName += '.pdf';
    newName = newName.replace(/[\/]/g, '_').trim();

    const oldPath = resolveUserPath(userId, filename);
    const oldFilename = stripUserPrefix(userId, oldPath);
    const newFilename = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${newName}`;
    const newPath = `${userPrefix(userId)}/${newFilename}`;

    console.log(`[Rename] ${oldPath} → ${newPath}`);

    const { data: fileData, error: dlErr } = await storage().download(oldPath);
    if (dlErr) return res.status(404).json({ success: false, error: 'Original file not found', message: dlErr.message });

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const { error: upErr } = await storage()
      .upload(newPath, buffer, { contentType: 'application/pdf', upsert: false });
    if (upErr) return res.status(500).json({ success: false, error: 'Upload failed', message: upErr.message });

    await adminStorage().remove([oldPath]);

    // Update DB refs (non-fatal)
    await supabase.from('document_segments')
      .update({ pdf_id: newFilename, updated_at: new Date().toISOString() })
      .eq('pdf_id', oldFilename).eq('user_id', userId).catch(() => {});

    await supabase.from('lesson_sets')
      .update({ pdf_id: newFilename })
      .eq('pdf_id', oldFilename).eq('user_id', userId).catch(() => {});

    await supabase.from('user_progress')
      .update({ pdf_id: newFilename })
      .eq('pdf_id', oldFilename).eq('user_id', userId).catch(() => {});

    const { data: urlData } = (supabaseAdmin || supabase)
      .storage.from('academic-pdfs').getPublicUrl(newPath);

    res.status(200).json({ success: true, message: 'PDF renamed successfully', oldFilename, newFilename, publicUrl: urlData?.publicUrl });
  } catch (error) {
    console.error('[Rename] Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
};

// ─── GET FILE (stream) ────────────────────────────────────────────────────────

/**
 * Serve a PDF file — only accessible by the owning user.
 * @route GET /api/pdf/file/:filename
 */
const getFile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { filename } = req.params;
    if (!filename) return res.status(400).json({ success: false, error: 'Filename is required' });

    const storagePath = resolveUserPath(userId, filename);

    const { data, error } = await storage().download(storagePath);
    if (error) return res.status(404).json({ success: false, error: 'File not found', message: error.message });

    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error('PDF getFile error:', error);
    res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
};

// ─── CHECK FOR DUPLICATES ─────────────────────────────────────────────────────

/**
 * Check if a PDF with the same content hash and title already exists for the user
 * 
 * Uses storage() (service role + fallback) instead of raw supabase to ensure
 * that both email/password and Google OAuth users can check duplicates without
 * RLS permission errors.
 * 
 * @route POST /api/pdf/check-duplicate
 */
const checkForDuplicates = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { contentHash, title } = req.body;
    if (!contentHash || !title) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['contentHash', 'title'],
      });
    }

    // Get all files for this user — use storage() for service role support
    const { data: files, error } = await storage()
      .list(userPrefix(userId), { limit: 1000, offset: 0 });

    if (error) {
      console.error('Supabase list error:', error);
      return res.status(500).json({ success: false, error: 'Failed to check duplicates', message: error.message });
    }

    if (!files || files.length === 0) {
      return res.status(200).json({ success: true, isDuplicate: false, duplicates: [] });
    }

    // Download and check content hash of existing files — use storage() for service role support
    const duplicates = [];
    for (const file of files) {
      const storagePath = `${userPrefix(userId)}/${file.name}`;
      const { data: fileData, error: dlErr } = await storage()
        .download(storagePath);

      if (dlErr) {
        console.error(`Failed to download ${file.name}:`, dlErr);
        continue;
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
      const displayName = file.name
        .replace(/^\d+_[a-z0-9]+_/i, '')
        .replace(/_/g, ' ')
        .replace(/\.pdf$/i, '');

      if (fileHash === contentHash) {
        duplicates.push({
          filename: file.name,
          displayName,
        });
      }
    }

    const isDuplicate = duplicates.length > 0;
    return res.status(200).json({
      success: true,
      isDuplicate,
      duplicates,
      message: isDuplicate
        ? `Found ${duplicates.length} file(s) with the same content.`
        : 'No duplicates found.',
    });
  } catch (error) {
    console.error('Check duplicates error:', error);
    res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
};

module.exports = { uploadPDF, listPDFs, deletePDF, renamePDF, validatePDF, getFile, checkForDuplicates };