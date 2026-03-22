/**
 * LESSONS CONTROLLER
 *
 * Endpoints:
 *   POST /api/pdf/lessons/generate  → extract PDF text, run AI pipeline, store & return lessons
 *   GET  /api/pdf/lessons/:pdfId    → retrieve cached lessons
 *   DELETE /api/pdf/lessons/:pdfId  → clear cached lessons (force re-generate)
 */

const pdfParse = require('pdf-parse');
const { supabase } = require('../config/supabase');
const { generateLessonsFromText } = require('../services/lessonAI.service');

// ─── PDF TEXT EXTRACTION ──────────────────────────────────────────────────────

async function extractFullText(pdfBuffer) {
  let result;
  try {
    result = await pdfParse(pdfBuffer);
  } catch (e) {
    throw new Error(`pdf-parse failed: ${e.message}`);
  }

  const rawText = result.text || '';
  const cleaned = rawText.replace(/\s+/g, ' ').trim();

  console.log(`[Lessons] Raw text length: ${rawText.length}, cleaned: ${cleaned.length}, pages: ${result.numpages}`);

  return {
    fullText:  cleaned,
    pageCount: result.numpages,
  };
}

// ─── DB HELPERS ───────────────────────────────────────────────────────────────

async function getCachedLessonSet(pdfId, userId) {
  const { data, error } = await supabase
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
    pdf_id:       pdfId,
    user_id:      userId,
    title:        lessonData.title,
    overview:     lessonData.overview,
    lessons_json: JSON.stringify(lessonData.lessons),
    total_lessons: lessonData.totalLessons,
    created_at:   new Date().toISOString(),
  };

  // Upsert — if a previous generation exists, replace it
  const { data, error } = await supabase
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

// ─── ENDPOINT: GENERATE LESSONS ───────────────────────────────────────────────

async function generateLessonsEndpoint(req, res) {
  const { pdfId, userId } = req.body;

  if (!pdfId || !userId) {
    return res.status(400).json({
      success:  false,
      error:    'Missing required fields',
      required: ['pdfId', 'userId'],
    });
  }

  console.log(`\n[Lessons] Starting generation for "${pdfId}"`);

  try {
    // Return cache if available
    const cached = await getCachedLessonSet(pdfId, userId);
    if (cached) {
      console.log('[Lessons] Returning cached lesson set');
      return res.status(200).json({
        success: true,
        cached:  true,
        message: 'Lessons loaded from cache',
        data:    formatResponse(cached),
      });
    }

    // Download PDF from Supabase Storage
    console.log('[Lessons] Downloading PDF from storage...');
    const { data: pdfBlob, error: dlErr } = await supabase
      .storage
      .from('academic-pdfs')
      .download(`pdfs/${pdfId}`);

    if (dlErr) {
      return res.status(404).json({
        success: false,
        error:   'PDF not found in storage',
        details: dlErr.message,
      });
    }

    // Extract text
    console.log('[Lessons] Extracting text from PDF...');
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
    let extraction;
    try {
      extraction = await extractFullText(pdfBuffer);
    } catch (extractErr) {
      console.error('[Lessons] Extraction threw:', extractErr.message);
      return res.status(422).json({
        success: false,
        error:   'Could not read this PDF',
        message: `Text extraction failed: ${extractErr.message}. Make sure the PDF contains selectable text (not a scanned image).`,
      });
    }

    // Guard: need at least some text to work with
    if (!extraction.fullText || extraction.fullText.length < 30) {
      console.warn(`[Lessons] Too little text extracted: "${extraction.fullText}"`);
      return res.status(422).json({
        success: false,
        error:   'PDF has no extractable text',
        message: `Only ${extraction.fullText.length} characters were extracted. This usually means the PDF is a scanned image or contains only pictures. Please upload a text-based PDF.`,
      });
    }

    // Run AI pipeline
    console.log('[Lessons] Running Claude AI lesson pipeline...');
    const lessonData = await generateLessonsFromText(extraction.fullText, pdfId);

    // Persist to DB
    console.log('[Lessons] Saving to database...');
    const saved = await saveLessonSet(pdfId, userId, lessonData);

    console.log(`[Lessons] ✅ Done — ${lessonData.totalLessons} lessons generated\n`);

    return res.status(200).json({
      success: true,
      cached:  false,
      message: `Generated ${lessonData.totalLessons} lessons successfully`,
      data:    formatResponse(saved),
    });

  } catch (err) {
    console.error('[Lessons] Error:', err.message);
    return res.status(500).json({
      success: false,
      error:   'Lesson generation failed',
      message: err.message,
    });
  }
}

// ─── ENDPOINT: GET LESSONS ────────────────────────────────────────────────────

async function getLessonsEndpoint(req, res) {
  const { pdfId }  = req.params;
  const userId     = req.query.userId;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId query param required' });
  }

  try {
    const row = await getCachedLessonSet(pdfId, userId);
    if (!row) {
      return res.status(404).json({
        success: false,
        error:   'Lessons not found',
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
  const { pdfId }  = req.params;
  const userId     = req.query.userId;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId query param required' });
  }

  try {
    const { error } = await supabase
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

module.exports = {
  generateLessonsEndpoint,
  getLessonsEndpoint,
  deleteLessonsEndpoint,
};