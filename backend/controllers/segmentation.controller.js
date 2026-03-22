/**
 * GROQ SEGMENTATION CONTROLLER
 * AI-Powered Document Segmentation + Per-Segment Content Storage + Chat
 *
 * Change log (Step 1):
 * - Groq now returns startPage/endPage per segment instead of just metadata
 * - After Groq responds, we slice the extracted text by page range locally
 * - Each segment now includes `content` (the actual PDF text for that section)
 * - content is stored inside segments_json in the DB — no schema change needed
 */

const Groq = require('groq-sdk');
const pdfjs = require('pdfjs-dist');
const { supabase } = require('../config/supabase');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── PDF TEXT EXTRACTION ───────────────────────────────────────────────────────

/**
 * Extracts text from a PDF buffer page-by-page.
 * Returns { pages: [{ pageNum, text }], fullText, pageCount }
 */
async function extractPDFText(pdfBuffer) {
  try {
    pdfjs.GlobalWorkerOptions.workerSrc =
      require('pdfjs-dist/legacy/build/pdf.worker.min.js');

    const pdf = await pdfjs.getDocument({ data: pdfBuffer }).promise;
    const pageCount = pdf.numPages;
    const pages = [];
    let fullText = '';

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      pages.push({ pageNum: i, text: pageText });
      fullText += `\n[PAGE ${i}]\n${pageText}`;
    }

    return { pages, fullText, pageCount, extractedAt: new Date().toISOString() };
  } catch (error) {
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

// ─── SLICE CONTENT BY PAGE RANGE ─────────────────────────────────────────────

/**
 * Given the pages array, returns combined text for pages startPage..endPage (inclusive).
 */
function sliceContentByPages(pages, startPage, endPage) {
  const start = Math.max(1, startPage);
  const end   = Math.min(pages.length, endPage);
  return pages
    .filter(p => p.pageNum >= start && p.pageNum <= end)
    .map(p => p.text.trim())
    .filter(Boolean)
    .join('\n\n');
}

// ─── GROQ SEGMENTATION ────────────────────────────────────────────────────────

/**
 * Asks Groq to analyse the document and return segment boundaries (startPage, endPage).
 * We deliberately keep the Groq output small — just metadata + page ranges.
 * The actual content is sliced locally from the extracted pages.
 */
async function segmentWithGroq(extractedText, pages, fileName) {
  // Send a representative preview to Groq (first 12 000 chars is enough to understand structure)
  const preview = extractedText.length > 12000
    ? extractedText.substring(0, 12000) + '\n... (truncated)'
    : extractedText;

  const pageCount = pages.length;

  console.log(`[Groq] Segmenting: ${fileName} (${pageCount} pages, ${preview.length} chars preview)`);

  const message = await groq.chat.completions.create({
    messages: [
      {
        role: 'user',
        content: `You are an expert educational content analyst. Analyse this academic document and divide it into 4–8 logical learning segments. Each segment should cover a coherent topic from the document.

DOCUMENT NAME: "${fileName}"
TOTAL PAGES: ${pageCount}

DOCUMENT PREVIEW (with [PAGE N] markers):
${preview}

INSTRUCTIONS:
- Identify 4–8 logical segments in reading order
- Each segment maps to a contiguous range of pages (startPage to endPage, 1-indexed)
- Segments must be non-overlapping and together must cover pages 1 to ${pageCount}
- The last segment's endPage must equal ${pageCount}
- Difficulty: "beginner" | "intermediate" | "advanced"
- Return ONLY valid JSON — no markdown, no code fences, no extra text

JSON FORMAT:
{
  "title": "Document/course title",
  "overview": "2–3 sentence summary of what the learner will achieve",
  "segments": [
    {
      "id": 1,
      "title": "Segment title",
      "description": "What the learner will understand after this segment",
      "keyPoints": ["Point 1", "Point 2", "Point 3"],
      "learningObjectives": ["By the end, you will...", "You will understand..."],
      "difficulty": "beginner",
      "estimatedTime": "5–10 minutes",
      "startPage": 1,
      "endPage": 3
    }
  ],
  "totalSegments": 4,
  "estimatedTotalTime": "45–60 minutes"
}`,
      },
    ],
    model: 'llama-3.3-70b-versatile',
    max_tokens: 2048,
    temperature: 0.5,
    stream: false,
  });

  const raw = message.choices[0].message.content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const segmentData = JSON.parse(raw);
  console.log(`[Groq] Got ${segmentData.segments.length} segment boundaries`);
  return segmentData;
}

// ─── ATTACH ACTUAL CONTENT TO SEGMENTS ───────────────────────────────────────

/**
 * Takes the Groq-generated segment metadata and attaches the real page text
 * by slicing the pages array according to startPage / endPage.
 */
function attachContent(segmentData, pages) {
  const pageCount = pages.length;

  segmentData.segments = segmentData.segments.map((seg, idx) => {
    // Fallback: if Groq didn't return page ranges, distribute pages evenly
    let startPage = seg.startPage;
    let endPage   = seg.endPage;

    if (!startPage || !endPage) {
      const perSegment = Math.ceil(pageCount / segmentData.segments.length);
      startPage = idx * perSegment + 1;
      endPage   = Math.min((idx + 1) * perSegment, pageCount);
    }

    const content = sliceContentByPages(pages, startPage, endPage);

    return {
      ...seg,
      startPage,
      endPage,
      // `content` is the raw extracted text the user will read in the lesson view
      content: content || `Content for pages ${startPage}–${endPage} could not be extracted.`,
    };
  });

  return segmentData;
}

// ─── FALLBACK SEGMENTATION ────────────────────────────────────────────────────

function fallbackSegmentation(fileName, pages) {
  console.log('[Fallback] Using fallback segmentation');
  const pageCount = pages ? pages.length : 1;
  const perSeg    = Math.ceil(pageCount / 4);

  const makeSegment = (id, title, description, difficulty, startPage, endPage) => ({
    id,
    title,
    description,
    keyPoints:          ['Key information', 'Important concepts', 'Examples'],
    learningObjectives: ['Understand the content in this section'],
    difficulty,
    estimatedTime:      '10–15 minutes',
    startPage,
    endPage,
    content: pages ? sliceContentByPages(pages, startPage, endPage) : 'Content unavailable.',
  });

  return {
    title:              fileName.replace(/\.pdf$/i, ''),
    overview:           'Document divided into sections for guided learning.',
    segments: [
      makeSegment(1, 'Introduction & Overview',  'Get familiar with the document structure and main topics.', 'beginner',     1,                  perSeg),
      makeSegment(2, 'Core Concepts',            'Learn the main information and foundational concepts.',      'intermediate', perSeg + 1,         perSeg * 2),
      makeSegment(3, 'Advanced Topics',          'Explore deeper topics and complex ideas.',                   'advanced',     perSeg * 2 + 1,     perSeg * 3),
      makeSegment(4, 'Summary & Review',         'Consolidate and review what you have learned.',              'intermediate', perSeg * 3 + 1,     pageCount),
    ],
    totalSegments:      4,
    estimatedTotalTime: '50–80 minutes',
    isUsingFallback:    true,
  };
}

// ─── DATABASE HELPERS ────────────────────────────────────────────────────────

async function saveSegmentsToDB(pdfId, userId, segmentData) {
  console.log(`[Database] Saving segments for ${pdfId}`);

  const { data, error } = await supabase
    .from('document_segments')
    .insert([{
      pdf_id:               pdfId,
      user_id:              userId,
      title:                segmentData.title,
      overview:             segmentData.overview,
      segments_json:        JSON.stringify(segmentData.segments),
      total_segments:       segmentData.totalSegments,
      estimated_total_time: segmentData.estimatedTotalTime,
      segmentation_method:  segmentData.isUsingFallback ? 'fallback' : 'groq',
      created_at:           new Date().toISOString(),
      updated_at:           new Date().toISOString(),
    }])
    .select();

  if (error) throw new Error(`Database save failed: ${error.message}`);
  console.log('[Database] Segments saved successfully');
  return data[0];
}

async function getExistingSegments(pdfId, userId) {
  try {
    const { data, error } = await supabase
      .from('document_segments')
      .select('*')
      .eq('pdf_id', pdfId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    console.warn('[Cache] Error fetching segments:', error.message);
    return null;
  }
}

// ─── ENDPOINT: SEGMENT PDF ────────────────────────────────────────────────────

async function segmentPDFEndpoint(req, res) {
  try {
    const { pdfId, userId } = req.body;

    if (!pdfId || !userId) {
      return res.status(400).json({
        success: false,
        error:   'Missing required fields',
        required: ['pdfId', 'userId'],
      });
    }

    console.log(`\n[Segmentation] Starting for ${pdfId}`);

    // Return cached result if it exists
    const existing = await getExistingSegments(pdfId, userId);
    if (existing) {
      console.log('[Cache] Returning cached segmentation');
      return res.status(200).json({
        success: true,
        message: 'Using cached segmentation (instant)',
        cached:  true,
        data: {
          id:             existing.id,
          title:          existing.title,
          overview:       existing.overview,
          segments:       JSON.parse(existing.segments_json),
          totalSegments:  existing.total_segments,
          estimatedTime:  existing.estimated_total_time,
          method:         existing.segmentation_method,
          createdAt:      existing.created_at,
        },
      });
    }

    // Download PDF from Supabase Storage
    console.log('[Storage] Downloading PDF...');
    const { data: pdfData, error: downloadError } = await supabase
      .storage
      .from('academic-pdfs')
      .download(`pdfs/${pdfId}`);

    if (downloadError) {
      return res.status(500).json({
        success: false,
        error:   'Failed to download PDF',
        details: downloadError.message,
      });
    }

    // Extract text page-by-page
    console.log('[PDF] Extracting text...');
    let extraction;
    try {
      extraction = await extractPDFText(Buffer.from(pdfData));
      console.log(`[PDF] ${extraction.pageCount} pages, ${extraction.fullText.length} chars`);
    } catch (extractError) {
      console.warn('[PDF] Extraction failed, using fallback');
      const fallback = fallbackSegmentation(pdfId, null);
      const saved    = await saveSegmentsToDB(pdfId, userId, fallback);
      return res.status(200).json({
        success:  true,
        message:  'Segmented with fallback (text extraction failed)',
        data: { ...fallback, id: saved.id },
      });
    }

    // Ask Groq for segment boundaries
    console.log('[AI] Requesting segment boundaries from Groq...');
    let segmentData;
    try {
      segmentData = await segmentWithGroq(extraction.fullText, extraction.pages, pdfId);
    } catch (groqError) {
      console.warn('[AI] Groq failed, using fallback:', groqError.message);
      segmentData = fallbackSegmentation(pdfId, extraction.pages);
    }

    // Attach actual page content to each segment
    if (!segmentData.isUsingFallback) {
      segmentData = attachContent(segmentData, extraction.pages);
    }

    // Save to DB
    console.log('[Database] Saving...');
    const saved = await saveSegmentsToDB(pdfId, userId, segmentData);

    console.log('[Success] Segmentation complete\n');
    res.status(200).json({
      success: true,
      message: 'Document segmented successfully',
      cached:  false,
      data: {
        id:             saved.id,
        title:          segmentData.title,
        overview:       segmentData.overview,
        segments:       segmentData.segments,
        totalSegments:  segmentData.totalSegments,
        estimatedTime:  segmentData.estimatedTotalTime,
        method:         segmentData.isUsingFallback ? 'fallback' : 'groq',
        createdAt:      saved.created_at,
      },
    });

  } catch (error) {
    console.error('[Error] Segmentation:', error.message);
    res.status(500).json({ success: false, error: 'Segmentation failed', message: error.message });
  }
}

// ─── ENDPOINT: GET SEGMENTS ───────────────────────────────────────────────────

async function getSegmentsEndpoint(req, res) {
  try {
    const { pdfId } = req.params;
    const userId    = req.user?.id;

    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const existing = await getExistingSegments(pdfId, userId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error:   'Segmentation not found',
        message: 'This PDF has not been segmented yet',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id:             existing.id,
        pdfId:          existing.pdf_id,
        title:          existing.title,
        overview:       existing.overview,
        segments:       JSON.parse(existing.segments_json),
        totalSegments:  existing.total_segments,
        estimatedTime:  existing.estimated_total_time,
        method:         existing.segmentation_method,
        createdAt:      existing.created_at,
        updatedAt:      existing.updated_at,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve segments', message: error.message });
  }
}

// ─── ENDPOINT: DELETE SEGMENTS ───────────────────────────────────────────────

async function deleteSegmentsEndpoint(req, res) {
  try {
    const { pdfId } = req.params;
    const userId    = req.user?.id;

    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { error } = await supabase
      .from('document_segments')
      .delete()
      .eq('pdf_id', pdfId)
      .eq('user_id', userId);

    if (error && error.code !== 'PGRST116') throw error;
    res.status(200).json({ success: true, message: 'Segmentation deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete segments', message: error.message });
  }
}

// ─── ENDPOINT: AI CHAT (per-segment support) ─────────────────────────────────

/**
 * POST /api/pdf/chat
 * Body: { question, segmentTitle, segmentContent, documentTitle }
 *
 * The segment's actual content is now passed as context so the AI can answer
 * questions grounded in the real text — not just metadata.
 */
async function chatWithSegmentEndpoint(req, res) {
  try {
    const { question, segmentTitle, segmentContent, documentTitle } = req.body;

    if (!question || !segmentTitle) {
      return res.status(400).json({
        success:  false,
        error:    'Missing required fields',
        required: ['question', 'segmentTitle'],
      });
    }

    console.log(`[Chat] "${segmentTitle}": ${question.substring(0, 80)}`);

    const message = await groq.chat.completions.create({
      messages: [
        {
          role:    'system',
          content: `You are a friendly AI tutor helping a student study "${documentTitle || 'this document'}".

The student is currently on the segment: "${segmentTitle}"

SEGMENT CONTENT (the actual text the student is reading):
${segmentContent ? segmentContent.substring(0, 4000) : 'No content available.'}

Your role:
- Answer questions clearly and concisely based on the segment content above
- If asked for examples, draw them from the actual text when possible
- If asked to quiz the student, generate 2–3 questions based on the content
- Keep answers under 300 words unless more detail is genuinely needed
- Be encouraging and supportive`,
        },
        {
          role:    'user',
          content: question,
        },
      ],
      model:       'llama-3.3-70b-versatile',
      max_tokens:  600,
      temperature: 0.7,
      stream:      false,
    });

    res.status(200).json({
      success: true,
      answer:  message.choices[0].message.content,
    });
  } catch (error) {
    console.error('[Chat] Error:', error.message);
    res.status(500).json({ success: false, error: 'Chat failed', message: error.message });
  }
}

// ─── ENDPOINT: GENERATE MICRO-TASK ───────────────────────────────────────────

/**
 * POST /api/pdf/microtask/generate
 * Body: { segmentTitle, segmentContent, documentTitle, taskType? }
 *
 * Generates a single micro-task (quiz question) for a segment.
 * taskType: 'multiple_choice' | 'short_answer' | 'auto' (default: auto)
 *
 * Returns a structured task object the frontend renders directly.
 * The correct answer / model answer is included so the frontend can do
 * lightweight self-evaluation — the evaluate endpoint handles deeper feedback.
 */
async function generateMicrotaskEndpoint(req, res) {
  try {
    const {
      segmentTitle, segmentContent, documentTitle,
      taskType = 'auto', count = 1, previousQuestions = [],
    } = req.body;

    if (!segmentTitle || !segmentContent) {
      return res.status(400).json({
        success: false, error: 'Missing required fields',
        required: ['segmentTitle', 'segmentContent'],
      });
    }

    const safeCount = Math.min(Math.max(parseInt(count) || 1, 1), 10);
    console.log(`[Microtask] Generating ${safeCount} task(s) for "${segmentTitle}" (type: ${taskType})`);

    const content  = segmentContent.substring(0, 4000);
    const avoidStr = previousQuestions.length
      ? `\nDo NOT repeat or closely resemble these already-asked questions:\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
      : '';

    const angles = [
      'cause and effect','compare and contrast','definition and application',
      'chronology or sequence','significance or impact','critical analysis',
      'real-world connection','misconception correction',
    ];
    const angle = angles[Math.floor(Math.random() * angles.length)];

    const message = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert educational assessment designer creating quiz questions for a student studying "${documentTitle || 'a document'}".

RULES:
- Base every question entirely on the provided content.
- Test genuine understanding, not word-for-word recall.
- Focus your questions around the angle: "${angle}".${avoidStr}
- multiple_choice: exactly 4 options, only one correct, options must be meaningfully different.
- short_answer: model answer is 1-2 concise sentences.
- If taskType is "auto", mix multiple_choice and short_answer across questions.
- For each question include a HINT: a 1-sentence nudge that helps the student think in the right direction WITHOUT giving away the answer.
- Return ONLY valid JSON — no markdown fences, no extra text.

Return an array of exactly ${safeCount} question object(s):
[
  {
    "type": "multiple_choice",
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correctIndex": 0,
    "explanation": "Why the correct answer is right.",
    "hint": "One-sentence nudge without giving away the answer."
  }
]
OR for short_answer objects inside the same array:
  {
    "type": "short_answer",
    "question": "...",
    "modelAnswer": "Ideal 1-2 sentence answer.",
    "keyTerms": ["term1", "term2"],
    "hint": "One-sentence nudge without giving away the answer."
  }`,
        },
        {
          role: 'user',
          content: `Segment: "${segmentTitle}"\nTask type: ${taskType}\nCount: ${safeCount}\n\nContent:\n${content}`,
        },
      ],
      model:       'llama-3.3-70b-versatile',
      max_tokens:  safeCount * 450,
      temperature: 0.92,
      stream:      false,
    });

    const raw   = message.choices[0].message.content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    const tasks = JSON.parse(raw);
    const arr   = Array.isArray(tasks) ? tasks : [tasks];

    console.log(`[Microtask] Generated ${arr.length} task(s)`);
    res.status(200).json({ success: true, tasks: arr });

  } catch (error) {
    console.error('[Microtask] Generate error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to generate task', message: error.message });
  }
}

// ─── ENDPOINT: EVALUATE MICRO-TASK ANSWER ────────────────────────────────────

/**
 * POST /api/pdf/microtask/evaluate
 * Body: { task, userAnswer, segmentTitle, segmentContent }
 *
 * For multiple_choice: evaluates against correctIndex (no AI needed, done locally).
 * For short_answer: sends to Groq to score and give feedback.
 *
 * Returns { correct: bool, score: 0-100, feedback: string, explanation: string }
 */
async function evaluateMicrotaskEndpoint(req, res) {
  try {
    const { task, userAnswer, segmentTitle, segmentContent } = req.body;

    if (!task || userAnswer === undefined || userAnswer === null) {
      return res.status(400).json({
        success:  false,
        error:    'Missing required fields',
        required: ['task', 'userAnswer'],
      });
    }

    console.log(`[Microtask] Evaluating ${task.type} answer for "${segmentTitle}"`);

    // ── Multiple choice: evaluate locally, no Groq call needed ──
    if (task.type === 'multiple_choice') {
      const correct = Number(userAnswer) === Number(task.correctIndex);
      return res.status(200).json({
        success:     true,
        correct,
        score:       correct ? 100 : 0,
        feedback:    correct
          ? '✅ Correct! Well done.'
          : `❌ Not quite. The correct answer was: ${task.options[task.correctIndex]}`,
        explanation: task.explanation || '',
      });
    }

    // ── Short answer: ask Groq to evaluate ──
    const content = (segmentContent || '').substring(0, 2000);

    const message = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a fair and encouraging teacher evaluating a student's short-answer response.

Evaluate based on:
1. Whether the core concept is correct (most important)
2. Whether key terms are used appropriately
3. Clarity of explanation

Be encouraging but honest. Keep feedback to 2-3 sentences.

Return ONLY valid JSON:
{
  "correct": true or false,
  "score": 0-100,
  "feedback": "Your encouraging but honest 2-3 sentence feedback",
  "highlight": "The strongest part of their answer (1 phrase)",
  "improve": "One specific thing they could add or correct (1 sentence, or null if score >= 85)"
}`,
        },
        {
          role: 'user',
          content: `Segment: "${segmentTitle}"
Question: ${task.question}
Model answer: ${task.modelAnswer}
Key terms expected: ${(task.keyTerms || []).join(', ')}
Student's answer: "${userAnswer}"

Reference content:
${content}`,
        },
      ],
      model:       'llama-3.3-70b-versatile',
      max_tokens:  300,
      temperature: 0.4,
      stream:      false,
    });

    const raw    = message.choices[0].message.content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    const result = JSON.parse(raw);

    console.log(`[Microtask] Score: ${result.score}`);

    res.status(200).json({
      success:     true,
      correct:     result.correct,
      score:       result.score,
      feedback:    result.feedback,
      highlight:   result.highlight || null,
      improve:     result.improve   || null,
      explanation: task.modelAnswer || '',
    });

  } catch (error) {
    console.error('[Microtask] Evaluate error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to evaluate answer', message: error.message });
  }
}

module.exports = {
  segmentPDFEndpoint,
  getSegmentsEndpoint,
  deleteSegmentsEndpoint,
  chatWithSegmentEndpoint,
  generateMicrotaskEndpoint,
  evaluateMicrotaskEndpoint,
  // Exported for unit testing
  extractPDFText,
  segmentWithGroq,
  attachContent,
  sliceContentByPages,
  saveSegmentsToDB,
  getExistingSegments,
  fallbackSegmentation,
};