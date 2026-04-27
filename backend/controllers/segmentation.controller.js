/**
 * GROQ SEGMENTATION CONTROLLER
 * AI-Powered Document Segmentation + Per-Segment Content Storage + Chat
 * Uses makeGroqCall() so every request automatically cycles through all
 * available API keys when one hits a 429 rate-limit.
 */

const Groq = require('groq-sdk');
const { supabase } = require('../config/supabase');
const { makeGroqCall } = require('../services/groqkeymanager.service');
const { extractPDFTextWithOCR } = require('../services/groq-ocr.service');

function getGroq(apiKey) {
  return new Groq({ apiKey });
}

// ─── PDF TEXT EXTRACTION ───────────────────────────────────────────────────────
//
// Delegates to groq-ocr.service which tries pdf-parse first, then falls back
// to Groq vision OCR (free tier) for image-based / scanned PDFs.

async function extractPDFText(pdfBuffer, userId) {
  return extractPDFTextWithOCR(pdfBuffer, userId, '[Segmentation]');
}
// ─── SLICE CONTENT BY PAGE RANGE ─────────────────────────────────────────────

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

async function segmentWithGroq(extractedText, pages, fileName, userId) {
  const preview = extractedText.length > 12000
    ? extractedText.substring(0, 12000) + '\n... (truncated)'
    : extractedText;

  const pageCount = pages.length;
  console.log(`[Groq] Segmenting: ${fileName} (${pageCount} pages, ${preview.length} chars preview)`);

  const message = await makeGroqCall(userId, key =>
    getGroq(key).chat.completions.create({
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
- Titles and descriptions must be based on the ACTUAL academic content in the document — never reference OCR quality, page numbers, or text readability
- If a segment's content is unclear, infer a meaningful title from the document name and surrounding context
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
    })
  );

  const raw = message.choices[0].message.content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const segmentData = JSON.parse(raw);
  console.log(`[Groq] Got ${segmentData.segments.length} segment boundaries`);
  return segmentData;
}

// ─── ATTACH ACTUAL CONTENT TO SEGMENTS ───────────────────────────────────────

function attachContent(segmentData, pages) {
  const pageCount = pages.length;

  segmentData.segments = segmentData.segments.map((seg, idx) => {
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
    id, title, description,
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
      makeSegment(1, 'Introduction & Overview',  'Get familiar with the document structure and main topics.', 'beginner',     1,              perSeg),
      makeSegment(2, 'Core Concepts',            'Learn the main information and foundational concepts.',      'intermediate', perSeg + 1,     perSeg * 2),
      makeSegment(3, 'Advanced Topics',          'Explore deeper topics and complex ideas.',                   'advanced',     perSeg * 2 + 1, perSeg * 3),
      makeSegment(4, 'Summary & Review',         'Consolidate and review what you have learned.',              'intermediate', perSeg * 3 + 1, pageCount),
    ],
    totalSegments:      4,
    estimatedTotalTime: '50–80 minutes',
    isUsingFallback:    true,
  };
}

// ─── DATABASE HELPERS ─────────────────────────────────────────────────────────

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
      return res.status(400).json({ success: false, error: 'Missing required fields', required: ['pdfId', 'userId'] });
    }

    console.log(`\n[Segmentation] Starting for ${pdfId}`);

    const existing = await getExistingSegments(pdfId, userId);
    if (existing) {
      console.log('[Cache] Returning cached segmentation');
      return res.status(200).json({
        success: true,
        message: 'Using cached segmentation (instant)',
        cached:  true,
        data: {
          id:            existing.id,
          title:         existing.title,
          overview:      existing.overview,
          segments:      JSON.parse(existing.segments_json),
          totalSegments: existing.total_segments,
          estimatedTime: existing.estimated_total_time,
          method:        existing.segmentation_method,
          createdAt:     existing.created_at,
        },
      });
    }

    // Download PDF from Supabase Storage
    console.log('[Storage] Downloading PDF...');
    const { data: pdfData, error: downloadError } = await supabase
      .storage
      .from('academic-pdfs')
      .download(`pdfs/${userId}/${pdfId}`);

    if (downloadError) {
      return res.status(500).json({ success: false, error: 'Failed to download PDF', details: downloadError.message });
    }

    // Extract text
    console.log('[PDF] Extracting text...');
    let extraction;
    try {
      extraction = await extractPDFText(Buffer.from(await pdfData.arrayBuffer()), userId);
      console.log(`[PDF] ${extraction.pageCount} pages, ${extraction.fullText.length} chars${extraction.usedOCR ? ' (via Groq OCR)' : ''}`);
    } catch (extractError) {
      console.warn('[PDF] Extraction failed, using fallback');
      const fallback = fallbackSegmentation(pdfId, null);
      const saved    = await saveSegmentsToDB(pdfId, userId, fallback);
      return res.status(200).json({ success: true, message: 'Segmented with fallback (text extraction failed)', data: { ...fallback, id: saved.id } });
    }

    // Ask Groq for segment boundaries — makeGroqCall handles key cycling on 429
    console.log('[AI] Requesting segment boundaries from Groq...');
    let segmentData;
    try {
      segmentData = await segmentWithGroq(extraction.fullText, extraction.pages, pdfId, userId);
    } catch (groqError) {
      console.warn('[AI] Groq failed, using fallback:', groqError.message);
      segmentData = fallbackSegmentation(pdfId, extraction.pages);
    }

    if (!segmentData.isUsingFallback) {
      segmentData = attachContent(segmentData, extraction.pages);
    }

    console.log('[Database] Saving...');
    const saved = await saveSegmentsToDB(pdfId, userId, segmentData);

    console.log('[Success] Segmentation complete\n');
    res.status(200).json({
      success: true,
      message: 'Document segmented successfully',
      cached:  false,
      data: {
        id:            saved.id,
        title:         segmentData.title,
        overview:      segmentData.overview,
        segments:      segmentData.segments,
        totalSegments: segmentData.totalSegments,
        estimatedTime: segmentData.estimatedTotalTime,
        method:        segmentData.isUsingFallback ? 'fallback' : 'groq',
        createdAt:     saved.created_at,
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
      return res.status(404).json({ success: false, error: 'Segmentation not found', message: 'This PDF has not been segmented yet' });
    }

    res.status(200).json({
      success: true,
      data: {
        id:            existing.id,
        pdfId:         existing.pdf_id,
        title:         existing.title,
        overview:      existing.overview,
        segments:      JSON.parse(existing.segments_json),
        totalSegments: existing.total_segments,
        estimatedTime: existing.estimated_total_time,
        method:        existing.segmentation_method,
        createdAt:     existing.created_at,
        updatedAt:     existing.updated_at,
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

// ─── ENDPOINT: AI CHAT ───────────────────────────────────────────────────────

async function chatWithSegmentEndpoint(req, res) {
  try {
    const { question, segmentTitle, segmentContent, documentTitle, userId } = req.body;

    if (!question || !segmentTitle) {
      return res.status(400).json({ success: false, error: 'Missing required fields', required: ['question', 'segmentTitle'] });
    }

    console.log(`[Chat] "${segmentTitle}": ${question.substring(0, 80)}`);

    const message = await makeGroqCall(userId, key =>
      getGroq(key).chat.completions.create({
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
          { role: 'user', content: question },
        ],
        model:       'llama-3.3-70b-versatile',
        max_tokens:  600,
        temperature: 0.7,
        stream:      false,
      })
    );

    res.status(200).json({ success: true, answer: message.choices[0].message.content });
  } catch (error) {
    console.error('[Chat] Error:', error.message);
    res.status(500).json({ success: false, error: 'Chat failed', message: error.message });
  }
}

// ─── ENDPOINT: GENERATE MICRO-TASK ───────────────────────────────────────────

async function generateMicrotaskEndpoint(req, res) {
  try {
    const {
      segmentTitle, segmentContent, documentTitle,
      taskType = 'auto', count = 1, previousQuestions = [], userId,
    } = req.body;

    if (!segmentTitle || !segmentContent) {
      return res.status(400).json({ success: false, error: 'Missing required fields', required: ['segmentTitle', 'segmentContent'] });
    }

    const safeCount = Math.min(Math.max(parseInt(count) || 1, 1), 10);
    console.log(`[Microtask] Generating ${safeCount} task(s) for "${segmentTitle}" (type: ${taskType})`);

    const content  = segmentContent.substring(0, 4000);
    const allAsked = Array.isArray(previousQuestions) ? previousQuestions : [];
    const avoidStr = allAsked.length
      ? `\nSTRICTLY FORBIDDEN — do NOT ask any of these questions again (not even a rephrased version):\n${allAsked.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
      : '';

    const angles = [
      'cause and effect','compare and contrast','definition and application',
      'chronology or sequence','significance or impact','critical analysis',
      'real-world connection','misconception correction',
    ];
    const angle = angles[Math.floor(Math.random() * angles.length)];

    const message = await makeGroqCall(userId, key =>
      getGroq(key).chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are an expert educational assessment designer creating quiz questions for a student studying "${documentTitle || 'a document'}".

RULES:
- Base every question entirely on the provided content.
- Test genuine understanding, not word-for-word recall.
- Focus your questions around the angle: "${angle}".${avoidStr}
QUESTION TYPE RULES based on taskType:
- "multiple_choice": 4 options (A-D), exactly one correct, options must be meaningfully different.
- "true_false": statement that is clearly true or false; options always ["True", "False"]; correctIndex 0 or 1.
- "identification": a "fill in the blank" or "name the term" question; short modelAnswer (1 key term or phrase).
- "essay": an open-ended analytical question; modelAnswer is a 3-4 sentence ideal response covering main points.
- If taskType is "auto", choose the best format for each question based on the content.
- For each question include a HINT: a 1-sentence nudge that helps the student think in the right direction WITHOUT giving away the answer.
- Every question in your response MUST be completely unique — different question text, different concept angle.
- Return ONLY valid JSON — no markdown fences, no extra text.

Return an array of exactly ${safeCount} question object(s).
For multiple_choice or true_false:
[{"type":"multiple_choice","question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correctIndex":0,"explanation":"Why correct.","hint":"Nudge."}]
For identification:
[{"type":"identification","question":"...","modelAnswer":"Key term or phrase.","keyTerms":["term"],"hint":"Nudge."}]
For essay:
[{"type":"essay","question":"...","modelAnswer":"3-4 sentence ideal response.","keyTerms":["term1","term2"],"hint":"Nudge."}]`,
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
      })
    );

    const raw   = message.choices[0].message.content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    const tasks = JSON.parse(raw);
    let arr     = Array.isArray(tasks) ? tasks : [tasks];

    const seenQuestions = new Set(allAsked.map(q => q.toLowerCase().trim()));
    arr = arr.filter(t => {
      const key = (t.question || '').toLowerCase().trim();
      if (!key || seenQuestions.has(key)) return false;
      seenQuestions.add(key);
      return true;
    });

    console.log(`[Microtask] Generated ${arr.length} unique task(s)`);
    res.status(200).json({ success: true, tasks: arr });

  } catch (error) {
    console.error('[Microtask] Generate error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to generate task', message: error.message });
  }
}

// ─── ENDPOINT: EVALUATE MICRO-TASK ANSWER ────────────────────────────────────

async function evaluateMicrotaskEndpoint(req, res) {
  try {
    const { task, userAnswer, segmentTitle, segmentContent, userId } = req.body;

    if (!task || userAnswer === undefined || userAnswer === null) {
      return res.status(400).json({ success: false, error: 'Missing required fields', required: ['task', 'userAnswer'] });
    }

    console.log(`[Microtask] Evaluating ${task.type} answer for "${segmentTitle}"`);

    // Multiple choice & True/False: evaluate locally, then use AI to explain why
    if (task.type === 'multiple_choice' || task.type === 'true_false') {
      const correct = Number(userAnswer) === Number(task.correctIndex);
      const correctOptionText = task.options[task.correctIndex];
      const chosenOptionText  = task.options[Number(userAnswer)];
      const content = (segmentContent || '').substring(0, 1500);

      let explanation = task.explanation || '';
      try {
        const explainMsg = await makeGroqCall(userId, key =>
          getGroq(key).chat.completions.create({
            messages: [
              {
                role: 'system',
                content: `You are a concise, encouraging teacher. Always explain WHY the correct answer is right in 2-3 sentences, grounded in the lesson content.`,
              },
              {
                role: 'user',
                content: `Question: ${task.question}
Correct answer: ${correctOptionText}
${!correct ? `Student chose: ${chosenOptionText}` : ''}
Lesson context: ${content}

Briefly explain why "${correctOptionText}" is the correct answer.`,
              },
            ],
            model:       'llama-3.3-70b-versatile',
            max_tokens:  150,
            temperature: 0.4,
            stream:      false,
          })
        );
        explanation = explainMsg.choices[0].message.content.trim();
      } catch (e) {
        // fallback to static explanation if AI call fails
        explanation = task.explanation || '';
      }

      return res.status(200).json({
        success:     true,
        correct,
        isCorrect:   correct,
        score:       correct ? 100 : 0,
        feedback:    correct
          ? `✅ Correct! ${explanation}`
          : `❌ Not quite. The correct answer was: ${correctOptionText}. ${explanation}`,
        correctAnswer: correctOptionText,
        explanation,
      });
    }

    const content = (segmentContent || '').substring(0, 2000);

    const message = await makeGroqCall(userId, key =>
      getGroq(key).chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a fair and encouraging teacher evaluating a student's short-answer response.

Evaluate based on:
1. Whether the core concept is correct (most important)
2. Whether key terms are used appropriately
3. Clarity of explanation

Always explain WHY the correct answer is what it is — not just whether the student got it right or wrong. Be encouraging but honest. Keep feedback to 2-3 sentences.

Return ONLY valid JSON:
{
  "correct": true or false,
  "score": 0-100,
  "feedback": "Your 2-3 sentence feedback that explains WHY the correct answer is correct, and what the student got right or wrong",
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
      })
    );

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
  extractPDFText,
  segmentWithGroq,
  attachContent,
  sliceContentByPages,
  saveSegmentsToDB,
  getExistingSegments,
  fallbackSegmentation,
};