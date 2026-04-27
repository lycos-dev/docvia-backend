/**
 * LESSON AI SERVICE — Powered by Google Gemini 2.0 Flash
 *
 * Drop-in replacement for lessonAI.service.js (previously Groq/Llama).
 *
 * KEY IMPROVEMENTS OVER GROQ VERSION
 * ────────────────────────────────────
 * • 1M token context window — larger documents can be sent in fewer chunks,
 *   reducing the number of API calls and improving lesson continuity.
 * • Generous free-tier rate limits — no more "all keys exhausted" errors
 *   with a single key, let alone multiple.
 * • Better instruction-following for structured JSON output.
 * • No SDK version incompatibilities with vision content blocks.
 *
 * Exports: generateLessonsFromText, deepExplainLesson
 * (same signatures as the original — controllers need zero changes)
 */

'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { makeGeminiCall, getUserKeyIndex } = require('./geminikeymanager.service');

const GEMINI_MODELS = ['gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];
const MAX_OUTPUT_TOKENS  = 6000;
// Larger chunks thanks to Gemini's bigger context window
const CHUNK_SIZE         = 12_000;
const MAX_CHUNKS         = 20;
const MAX_LESSONS_PER_CHUNK = 6;

// ─── Helper: call Gemini and get text back ────────────────────────────────────

async function callGemini(key, prompt, maxTokens = MAX_OUTPUT_TOKENS, temperature = 0.4) {
  for (const modelName of GEMINI_MODELS) {
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
          responseMimeType: 'application/json', // ask Gemini to return valid JSON directly
        },
      });

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err) {
      const status = err?.status ?? 0;
      if ((status === 503 || status === 429) && modelName !== GEMINI_MODELS[GEMINI_MODELS.length - 1]) {
        console.warn(`[LessonAI] ⚠️  ${modelName} unavailable, trying next...`);
        continue;
      }
      throw err;
    }
  }
}

// ─── TEXT CHUNKING ────────────────────────────────────────────────────────────

function chunkText(text, chunkSize = CHUNK_SIZE) {
  const chunks = [];
  let remaining = text.trim();
  while (remaining.length > 0 && chunks.length < MAX_CHUNKS) {
    if (remaining.length <= chunkSize) {
      chunks.push(remaining.trim());
      break;
    }
    let cut = remaining.lastIndexOf('\n\n', chunkSize);
    if (cut < chunkSize * 0.6) cut = remaining.lastIndexOf('\n', chunkSize);
    if (cut < chunkSize * 0.4) cut = remaining.lastIndexOf(' ', chunkSize);
    if (cut <= 0) cut = chunkSize;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  return chunks.filter(c => c.length > 50);
}

// ─── DOCUMENT META ────────────────────────────────────────────────────────────

async function extractDocumentMeta(preview, fileName, userId, resolvedKeyIndex) {
  const prompt = `You are an expert academic document analyst.
Return ONLY valid JSON (no markdown fences, no preamble):
{
  "title": "Clear, descriptive academic title",
  "overview": "2-3 sentence overview of what the document teaches"
}
EXCERPT:
${preview.slice(0, 6000)}`;

  try {
    const raw = await makeGeminiCall(
      userId,
      key => callGemini(key, prompt, 400, 0.3),
      resolvedKeyIndex,
    );
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return {
      title:    fileName.replace(/\.pdf$/i, '').replace(/_/g, ' '),
      overview: 'Academic document with detailed concepts.',
    };
  }
}

// ─── LESSON GENERATION PER CHUNK ─────────────────────────────────────────────

async function generateLessonsForChunk(chunk, chunkIdx, totalChunks, docTitle, userId, resolvedKeyIndex) {
  const continuityNote = totalChunks > 1
    ? `\nThis is chunk ${chunkIdx + 1} of ${totalChunks}. Maintain continuity but do NOT repeat content from previous chunks.`
    : '';

  const prompt = `You are an expert educator who creates granular, highly specific learning segments. Every explanation must read like a mini-lecture: concrete, exam-ready, and faithful to the source.

Document: "${docTitle || 'Uploaded Academic PDF'}"
${continuityNote}

RULES (follow strictly):
1. Create AT MOST ${MAX_LESSONS_PER_CHUNK} lessons for this chunk.
2. EACH lesson must cover EXACTLY ONE atomic concept, claim, event, or skill drawn from the text.
3. If the passage contains several distinct ideas, split them into separate lessons — do not merge.
4. Never invent facts, names, dates, or quotes not in the TEXT TO PROCESS below.

TITLE RULES:
- Specific and descriptive (include the topic, actor, or tension when possible).
- Never use generic titles: "Introduction", "Overview", "Summary", "Conclusion", "Background", "Key Points".
- Never reference OCR quality, readability, page numbers, or text extraction.

EXPLANATION — STRUCTURE AND DEPTH (critical):
- Write ONLY in third-person explanatory voice (no "In this lesson we will…").
- Minimum length: at least 8 full sentences per lesson unless the source is genuinely too short.
- Format as three paragraphs separated by \\n\\n:

  PARAGRAPH 1 — Open with the precise claim or idea this lesson covers. Add 2–4 sentences unpacking it with concrete details from the text: names, institutions, dates, definitions, causal links, or closely paraphrased phrases. If the text uses technical terms, define them as the document does.

  PARAGRAPH 2 — Explain how this idea is argued or evidenced in the passage: reasoning steps, examples, comparisons, or narrative sequence as given in the source. Name the evidence type when the text provides it.

  PARAGRAPH 3 — State one or two implications: what follows from this idea in the document's line of thought, what it contrasts with, or what question it leaves open — still grounded in the text, not generic life advice.

- BANNED filler (do not use unless followed by specific content): "very important", "many people believe", "it is interesting to note", "plays a significant role", "various aspects", "in today's world".

KEY POINTS:
- 4–6 strings; each must be a complete, specific claim (not a label). Prefer "who did what / why it matters".

Return ONLY valid JSON (no markdown fences):

{
  "lessons": [
    {
      "title": "Very specific concept title",
      "explanation": "Paragraph one…\\n\\nParagraph two…\\n\\nParagraph three…",
      "key_points": ["Specific claim 1", "Specific claim 2"]
    }
  ]
}

TEXT TO PROCESS:
${chunk}`;

  const raw = await makeGeminiCall(
    userId,
    key => callGemini(key, prompt, MAX_OUTPUT_TOKENS, 0.42),
    resolvedKeyIndex,
  );

  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed.lessons) ? parsed.lessons : [];
  } catch (e) {
    console.warn(`[LessonAI] Chunk ${chunkIdx} parse failed, attempting recovery...`);

    // Recovery attempt 1: find a JSON array
    const arrMatch = clean.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        const recovered = JSON.parse(arrMatch[0]);
        if (Array.isArray(recovered) && recovered.length > 0) {
          console.log(`[LessonAI] Chunk ${chunkIdx} recovered ${recovered.length} lessons from array`);
          return recovered;
        }
      } catch {}
    }

    // Recovery attempt 2: find "lessons" key
    const lessonsMatch = clean.match(/"lessons"\s*:\s*\[[\s\S]*\]/);
    if (lessonsMatch) {
      try {
        const obj = JSON.parse(`{${lessonsMatch[0]}}`);
        if (Array.isArray(obj.lessons) && obj.lessons.length > 0) {
          console.log(`[LessonAI] Chunk ${chunkIdx} recovered ${obj.lessons.length} lessons from field`);
          return obj.lessons;
        }
      } catch {}
    }

    console.warn(`[LessonAI] Chunk ${chunkIdx} could not be recovered. Preview: ${clean.slice(0, 200)}`);
    return [];
  }
}

// ─── MERGE & FILTER ───────────────────────────────────────────────────────────

function mergeLessons(allRawLessons) {
  const genericRegex = /^(introduction|overview|summary|conclusion|background|preface|foreword|abstract|key points|review)\b/i;

  return allRawLessons
    .filter(l => l.title && l.explanation)
    .filter(l => !genericRegex.test(l.title.trim().toLowerCase()))
    .map((l, idx) => ({
      id:          idx + 1,
      title:       l.title.trim(),
      explanation: l.explanation.trim(),
      key_points:  Array.isArray(l.key_points)
        ? l.key_points.map(p => p.trim()).filter(Boolean)
        : [],
    }));
}

// ─── MAIN PIPELINE ────────────────────────────────────────────────────────────

async function generateLessonsFromText(fullText, pdfId, userId) {
  if (!fullText || fullText.trim().length < 100) {
    throw new Error('Insufficient text extracted from PDF.');
  }

  // Resolve the user's starting key index ONCE for the entire pipeline.
  const resolvedKeyIndex = await getUserKeyIndex(userId);
  console.log(`[LessonAI] Using key index ${resolvedKeyIndex} for user ${userId}`);

  console.log('[LessonAI] Extracting document meta...');
  let meta = { title: pdfId.replace(/\.pdf$/i, '').replace(/_/g, ' '), overview: '' };
  try {
    meta = await extractDocumentMeta(fullText, pdfId, userId, resolvedKeyIndex);
  } catch (e) {
    console.warn('[LessonAI] Meta extraction failed:', e.message);
  }

  const chunks = chunkText(fullText);
  console.log(`[LessonAI] Split into ${chunks.length} chunks (chunk size: ${CHUNK_SIZE} chars)`);

  const allRawLessons = [];

  for (let i = 0; i < chunks.length; i++) {
    try {
      const lessons = await generateLessonsForChunk(
        chunks[i],
        i,
        chunks.length,
        meta.title,
        userId,
        resolvedKeyIndex,
      );
      allRawLessons.push(...lessons);
      console.log(`[LessonAI] Processed chunk ${i + 1} / ${chunks.length} (${lessons.length} lessons)`);
    } catch (err) {
      console.warn(`[LessonAI] Chunk ${i + 1} failed after cycling all keys: ${err.message}`);
    }
  }

  const lessons = mergeLessons(allRawLessons);
  console.log(`[LessonAI] ✅ Generated ${lessons.length} granular lessons`);

  if (lessons.length === 0) {
    const textPreview = fullText.slice(0, 500).replace(/\s+/g, ' ');
    throw new Error(
      `Lesson generation produced no results. ` +
      `(Extracted ${fullText.length} chars from ${chunks.length} chunk(s)). ` +
      `This may be due to: (1) PDF text extraction issues, (2) API rate limits, ` +
      `(3) Content too complex for current AI model. ` +
      `Text preview: "${textPreview}..."`
    );
  }

  return {
    title:        meta.title,
    overview:     meta.overview,
    lessons,
    totalLessons: lessons.length,
  };
}

// ─── DEEP EXPLAIN ─────────────────────────────────────────────────────────────

async function deepExplainLesson({ title, explanation, key_points, documentTitle, userId = '' }) {
  const prompt = `You are a friendly expert tutor. Ground EVERYTHING in this lesson segment only — do not invent facts not in the text below.

Document: "${documentTitle || 'Uploaded PDF'}"
Lesson segment title: "${title}"

Segment explanation (primary source):
"""${explanation}"""

Key points from the segment:
${(key_points || []).map(p => `- ${p}`).join('\n') || 'None'}

Return ONLY valid JSON (no markdown fences). Each string field must be substantive (multiple sentences where asked).

{
  "detailed_explanation": "4–6 short paragraphs separated by \\n\\n. Teach directly: unpack the segment step by step.",
  "conceptual_breakdown": "2–3 paragraphs: define terms, actors, and logic used in this segment.",
  "context_and_debates": "2–3 paragraphs: different viewpoints, tensions, or historical/academic angles implied by THIS segment (stay faithful to the text).",
  "connections": "1–2 paragraphs: how this segment links to earlier/later ideas in the same document theme (infer only if reasonable from the segment).",
  "examples": ["Concrete example 1 tied to the segment.", "Concrete example 2 tied to the segment.", "Optional third example."],
  "why_it_matters": "2–4 sentences on why this segment matters for understanding the document.",
  "common_misconceptions": ["Misconception vs correction 1.", "Misconception vs correction 2.", "Optional third."],
  "study_tips": ["Practical tip 1.", "Practical tip 2.", "Practical tip 3."]
}`;

  try {
    const raw   = await makeGeminiCall(userId, key => callGemini(key, prompt, 4096, 0.55));
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return {
      detailed_explanation:    explanation,
      conceptual_breakdown:    '',
      context_and_debates:     '',
      connections:             '',
      examples:                [],
      why_it_matters:          '',
      common_misconceptions:   [],
      study_tips:              [],
    };
  }
}

module.exports = {
  generateLessonsFromText,
  deepExplainLesson,
};