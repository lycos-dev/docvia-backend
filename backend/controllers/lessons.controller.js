/**
 * LESSONS CONTROLLER
 *
 * Endpoints:
 *   POST /api/pdf/lessons/generate      → extract PDF text, run AI pipeline, store & return lessons
 *   GET  /api/pdf/lessons/:pdfId        → retrieve cached lessons
 *   GET  /api/pdf/lessons/:pdfId/status → poll generation progress (non-blocking)
 *   DELETE /api/pdf/lessons/:pdfId      → clear cached lessons (force re-generate)
 *
 * FIX 1: In-flight deduplication — concurrent generate requests for the same
 *         pdfId+userId share a single Promise. No redundant generation or race conditions.
 * FIX 2: /status endpoint — frontend polls this instead of waiting on /generate,
 *         so an 8-second UI timeout never cancels a valid in-progress generation.
 * FIX 3: getUserKeyIndex is resolved once per generate call and passed down,
 *         not re-queried on every chunk.
 */

const { supabase, supabaseAdmin } = require('../config/supabase');

// Use admin client for storage operations so custom-JWT users bypass RLS.
const storageClient = () => (supabaseAdmin || supabase).storage.from('academic-pdfs');
const { generateLessonsFromText, deepExplainLesson } = require('../services/lessonAI.service');
const { extractPDFTextWithOCR } = require('../services/groq-ocr.service');

// ─── In-flight deduplication map ─────────────────────────────────────────────
// Key: `${userId}:${pdfId}`  Value: Promise<lessonData>
// Prevents concurrent requests from triggering duplicate AI pipelines.
const inFlightGenerations = new Map();

// ─── PDF TEXT EXTRACTION ──────────────────────────────────────────────────────

async function extractFullText(pdfBuffer, userId) {
  const result = await extractPDFTextWithOCR(pdfBuffer, userId, '[Lessons]');
  console.log(`[Lessons] Extraction complete: ${result.fullText.length} chars, ${result.pageCount} pages${result.usedOCR ? ' (via Groq OCR)' : ''}`);
  return { fullText: result.fullText, pageCount: result.pageCount, usedOCR: result.usedOCR };
}

// ─── DB HELPERS ───────────────────────────────────────────────────────────────

const db = () => (supabaseAdmin || supabase);

async function getCachedLessonSet(pdfId, userId) {
  const { data, error } = await db()
    .from('lesson_sets')
    .select('*')
    .eq('pdf_id', pdfId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function saveLessonSet(pdfId, userId, lessonData) {
  const row = {
    pdf_id:        pdfId,
    user_id:       userId,
    title:         lessonData.title,
    overview:      lessonData.overview,
    lessons_json:  JSON.stringify(lessonData.lessons),
    total_lessons: lessonData.totalLessons,
    created_at:    new Date().toISOString(),
  };

  const { data, error } = await db()
    .from('lesson_sets')
    .upsert(row, { onConflict: 'pdf_id,user_id' })
    .select()
    .single();

  if (error) throw new Error(`DB save failed: ${error.message}`);
  return data;
}

function formatResponse(row) {
  return {
    id:           row.id,
    pdfId:        row.pdf_id,
    title:        row.title,
    overview:     row.overview,
    lessons:      JSON.parse(row.lessons_json),
    totalLessons: row.total_lessons,
    createdAt:    row.created_at,
  };
}

// ─── CORE GENERATION LOGIC (shared by dedup map) ──────────────────────────────

async function runGenerationPipeline(pdfId, userId) {
  // Download PDF from Supabase Storage
  console.log('[Lessons] Downloading PDF from storage...');
  const { data: pdfBlob, error: dlErr } = await storageClient()
    .download(`pdfs/${userId}/${pdfId}`);

  if (dlErr) {
    throw Object.assign(new Error('PDF not found in storage'), { statusCode: 404, details: dlErr.message });
  }

  // Extract text
  console.log('[Lessons] Extracting text from PDF...');
  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
  const extraction = await extractFullText(pdfBuffer, userId);

  if (extraction.usedOCR) {
    console.log('[Lessons] Using OCR-extracted text for lesson generation');
  }

  // Run AI pipeline
  console.log('[Lessons] Running AI lesson pipeline...');
  const lessonData = await generateLessonsFromText(extraction.fullText, pdfId, userId);

  // Persist to DB
  console.log('[Lessons] Saving to database...');
  const saved = await saveLessonSet(pdfId, userId, lessonData);

  console.log(`[Lessons] ✅ Done — ${lessonData.totalLessons} lessons generated\n`);
  return formatResponse(saved);
}

// ─── ENDPOINT: GENERATE LESSONS ───────────────────────────────────────────────
// This endpoint now returns immediately with { queued: true } if generation is
// already in progress, so the frontend can poll /status instead of hanging.

async function generateLessonsEndpoint(req, res) {
  const { pdfId, userId } = req.body;

  if (!pdfId || !userId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      required: ['pdfId', 'userId'],
    });
  }

  console.log(`\n[Lessons] Generate request for "${pdfId}"`);

  try {
    // 1. Return cache immediately if available
    const cached = await getCachedLessonSet(pdfId, userId);
    if (cached) {
      console.log('[Lessons] Returning cached lesson set');
      return res.status(200).json({
        success: true,
        cached: true,
        status: 'complete',
        message: 'Lessons loaded from cache',
        data: formatResponse(cached),
      });
    }

    const inflightKey = `${userId}:${pdfId}`;

    // 2. If already generating, tell the client to poll /status
    if (inFlightGenerations.has(inflightKey)) {
      console.log('[Lessons] Generation already in progress, returning queued status');
      return res.status(202).json({
        success: true,
        status: 'generating',
        message: 'Lesson generation is already in progress. Poll GET /lessons/:pdfId/status for updates.',
      });
    }

    // 3. Start generation and register in dedup map
    const generationPromise = runGenerationPipeline(pdfId, userId)
      .finally(() => {
        inFlightGenerations.delete(inflightKey);
      });

    inFlightGenerations.set(inflightKey, generationPromise);

    // 4. Wait for result and return it
    const data = await generationPromise;

    return res.status(200).json({
      success: true,
      cached: false,
      status: 'complete',
      message: `Generated ${data.totalLessons} lessons successfully`,
      data,
    });

  } catch (err) {
    console.error('[Lessons] Error:', err.message);
    const statusCode = err.statusCode === 404 ? 404 : 500;
    const errorLabel = statusCode === 404 ? 'PDF not found in storage' : 'Lesson generation failed';
    return res.status(statusCode).json({
      success: false,
      status: 'error',
      error: errorLabel,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }
}

// ─── ENDPOINT: STATUS (non-blocking poll) ─────────────────────────────────────
// Returns immediately: 'complete' (cache hit), 'generating' (in-flight), or 'not_started'.
// The frontend polls this while showing a loading state, instead of blocking on /generate.

async function getLessonsStatusEndpoint(req, res) {
  const { pdfId } = req.params;
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId query param required' });
  }

  try {
    // Check if done
    const cached = await getCachedLessonSet(pdfId, userId);
    if (cached) {
      return res.status(200).json({
        success: true,
        status: 'complete',
        data: formatResponse(cached),
      });
    }

    // Check if in progress
    const inflightKey = `${userId}:${pdfId}`;
    if (inFlightGenerations.has(inflightKey)) {
      return res.status(200).json({
        success: true,
        status: 'generating',
        message: 'Lesson generation is in progress. Check back shortly.',
      });
    }

    return res.status(200).json({
      success: true,
      status: 'not_started',
      message: 'No lesson generation has been started for this PDF.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Status check failed', message: err.message });
  }
}

// ─── ENDPOINT: GET LESSONS ────────────────────────────────────────────────────

async function getLessonsEndpoint(req, res) {
  const { pdfId } = req.params;
  const userId    = req.query.userId;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId query param required' });
  }

  try {
    const row = await getCachedLessonSet(pdfId, userId);
    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'Lessons not found',
        message: 'No lessons generated yet for this PDF. Call POST /lessons/generate first.',
      });
    }
    return res.status(200).json({ success: true, data: formatResponse(row) });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve lessons', message: err.message });
  }
}

// ─── ENDPOINT: DELETE LESSONS ─────────────────────────────────────────────────

async function deleteLessonsEndpoint(req, res) {
  const { pdfId } = req.params;
  const userId    = req.query.userId;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId query param required' });
  }

  try {
    const { error } = await db()
      .from('lesson_sets')
      .delete()
      .eq('pdf_id', pdfId)
      .eq('user_id', userId);

    if (error) throw error;
    return res.status(200).json({ success: true, message: 'Lessons cleared. Re-generate with POST /lessons/generate.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to delete lessons', message: err.message });
  }
}

// ─── ENDPOINT: DEEP EXPLAIN ───────────────────────────────────────────────────

async function deepExplainEndpoint(req, res) {
  const { title, explanation, key_points, documentTitle, userId } = req.body;

  if (!title || !explanation) {
    return res.status(400).json({ success: false, error: 'Missing required fields', required: ['title', 'explanation'] });
  }

  console.log(`[Lessons] Deep explain: "${title}"`);

  try {
    const result = await deepExplainLesson({ title, explanation, key_points, documentTitle, userId });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('[Lessons] Deep explain error:', err.message);
    return res.status(500).json({ success: false, error: 'Deep explanation failed', message: err.message });
  }
}

module.exports = {
  generateLessonsEndpoint,
  getLessonsEndpoint,
  getLessonsStatusEndpoint,
  deleteLessonsEndpoint,
  deepExplainEndpoint,
};