/**
 * LESSONS CONTROLLER
 *
 * Endpoints:
 *   POST /api/pdf/lessons/generate  → extract PDF text, run AI pipeline, store & return lessons
 *   GET  /api/pdf/lessons/:pdfId    → retrieve cached lessons
 *   DELETE /api/pdf/lessons/:pdfId  → clear cached lessons (force re-generate)
 */

const pdfParse = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');
const { supabase } = require('../config/supabase');
const { generateLessonsFromText, deepExplainLesson } = require('../services/lessonAI.service');

// ─── OCR FALLBACK (Anthropic claude-haiku-4-5 vision) ──────────────────────────────

/**
 * Uses Anthropic's Claude claude-haiku-4-5 to extract text from a PDF buffer when
 * pdf-parse returns little/no selectable text (i.e., image-based / scanned PDF).
 */
async function extractTextViaOCR(pdfBuffer) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const base64PDF = pdfBuffer.toString('base64');

  console.log('[Lessons] Running OCR via Anthropic claude-haiku-4-5 vision...');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64PDF,
            },
          },
          {
            type: 'text',
            text: 'Extract ALL text from this PDF document. Output only the raw extracted text, preserving the logical reading order and paragraph breaks. Do not summarize, interpret, or add any commentary — just the text as it appears in the document.',
          },
        ],
      },
    ],
  });

  const extracted = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  console.log(`[Lessons] OCR extracted ${extracted.length} characters`);
  return extracted;
}

// ─── PDF TEXT EXTRACTION ──────────────────────────────────────────────────────

/**
 * Tries pdf-parse first (fast, for text-based PDFs).
 * Falls back to Anthropic vision OCR if extracted text is too short.
 */
async function extractFullText(pdfBuffer) {
  let result;
  let rawText = '';
  let pageCount = 0;

  try {
    result = await pdfParse(pdfBuffer);
    rawText = result.text || '';
    pageCount = result.numpages;
  } catch (e) {
    console.warn(`[Lessons] pdf-parse failed: ${e.message} — will attempt OCR`);
  }

  const cleaned = rawText.replace(/\s+/g, ' ').trim();
  console.log(`[Lessons] Raw text length: ${rawText.length}, cleaned: ${cleaned.length}, pages: ${pageCount}`);

  // If we got meaningful text, use it
  const MIN_CHARS_PER_PAGE = 80;
  const expectedMin = Math.max(100, (pageCount || 1) * MIN_CHARS_PER_PAGE);
  if (cleaned.length >= expectedMin) {
    return { fullText: cleaned, pageCount, usedOCR: false };
  }

  // Text too short — PDF is likely image-based; use OCR
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'PDF appears to be image-based but ANTHROPIC_API_KEY is not set. ' +
      'Please upload a text-based PDF or configure the Anthropic API key for OCR support.'
    );
  }

  console.log(`[Lessons] Text too short (${cleaned.length} chars) — falling back to OCR...`);
  const ocrText = await extractTextViaOCR(pdfBuffer);

  if (!ocrText || ocrText.length < 50) {
    throw new Error('OCR could not extract text from this PDF. The document may be blank, corrupted, or password-protected.');
  }

  return { fullText: ocrText, pageCount, usedOCR: true };
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
    pdf_id:        pdfId,
    user_id:       userId,
    title:         lessonData.title,
    overview:      lessonData.overview,
    lessons_json:  JSON.stringify(lessonData.lessons),
    total_lessons: lessonData.totalLessons,
    created_at:    new Date().toISOString(),
  };

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
      success: false,
      error: 'Missing required fields',
      required: ['pdfId', 'userId'],
    });
  }

  console.log(`\n[Lessons] Starting generation for "${pdfId}"`);

  try {
    // Return cache if available
    const cached = await getCachedLessonSet(pdfId, userId);
    if (cached) {
      console.log('[Lessons] Returning cached lesson set');
      return res.status(200).json({ success: true, cached: true, message: 'Lessons loaded from cache', data: formatResponse(cached) });
    }

    // Download PDF from Supabase Storage
    console.log('[Lessons] Downloading PDF from storage...');
    const { data: pdfBlob, error: dlErr } = await supabase
      .storage
      .from('academic-pdfs')
      .download(`pdfs/${userId}/${pdfId}`);

    if (dlErr) {
      return res.status(404).json({ success: false, error: 'PDF not found in storage', details: dlErr.message });
    }

    // Extract text (with OCR fallback for image-based PDFs)
    console.log('[Lessons] Extracting text from PDF...');
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
    let extraction;
    try {
      extraction = await extractFullText(pdfBuffer);
    } catch (extractErr) {
      console.error('[Lessons] Extraction failed:', extractErr.message);
      return res.status(422).json({
        success: false,
        error: 'Could not read this PDF',
        message: extractErr.message,
      });
    }

    if (extraction.usedOCR) {
      console.log('[Lessons] Using OCR-extracted text for lesson generation');
    }

    // Run AI lesson pipeline
    console.log('[Lessons] Running AI lesson pipeline...');
    const lessonData = await generateLessonsFromText(extraction.fullText, pdfId, userId);

    // Persist to DB
    console.log('[Lessons] Saving to database...');
    const saved = await saveLessonSet(pdfId, userId, lessonData);

    console.log(`[Lessons] ✅ Done — ${lessonData.totalLessons} lessons generated\n`);

    return res.status(200).json({
      success: true,
      cached: false,
      message: `Generated ${lessonData.totalLessons} lessons successfully`,
      data: formatResponse(saved),
    });

  } catch (err) {
    console.error('[Lessons] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Lesson generation failed', message: err.message });
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

module.exports = { generateLessonsEndpoint, getLessonsEndpoint, deleteLessonsEndpoint, deepExplainEndpoint };