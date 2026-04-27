/**
 * LESSON AI SERVICE — Powered by GROQ (Llama-3.3-70b)
 * FIXED: Now creates highly granular segments.
 * Each lesson/segment = EXACTLY ONE concept/skill (no more multi-concept lessons).
 * IMPROVED: Uses makeGroqCall() for automatic key rotation on token limits.
 *
 * FIX: getUserKeyIndex is now resolved ONCE at the start of generateLessonsFromText
 * and passed as resolvedKeyIndex to every makeGroqCall throughout the pipeline.
 * Previously, every chunk called getUserKeyIndex internally (a DB round-trip each time),
 * adding latency and occasionally triggering spurious rate-limit appearances.
 */

const Groq = require('groq-sdk');
const { makeGroqCall, getUserKeyIndex } = require('./groqkeymanager.service');

const CHUNK_SIZE = 10_000;
const MAX_CHUNKS = 20;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_TOKENS = 4096;

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
  const response = await makeGroqCall(
    userId,
    key =>
      new Groq({ apiKey: key }).chat.completions.create({
        model: GROQ_MODEL,
        max_tokens: 300,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: `You are an expert academic document analyst.\nReturn ONLY valid JSON:\n{\n  "title": "Clear, descriptive academic title",\n  "overview": "2-3 sentence overview of what the document teaches"\n}\nEXCERPT:\n${preview.slice(0, 3500)}`
        }],
      }),
    resolvedKeyIndex,
  );

  let raw = response.choices[0].message.content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    return JSON.parse(raw);
  } catch {
    return {
      title: fileName.replace(/\.pdf$/i, '').replace(/_/g, ' '),
      overview: 'Academic document with detailed concepts.'
    };
  }
}

// ─── LESSON GENERATION PER CHUNK (NOW HIGHLY GRANULAR) ───────────────────────
async function generateLessonsForChunk(chunk, chunkIdx, totalChunks, docTitle = '', userId = '', resolvedKeyIndex) {
  const continuityNote = totalChunks > 1
    ? `\nThis is chunk ${chunkIdx + 1} of ${totalChunks}. Maintain continuity with previous chunks but do NOT repeat content.`
    : '';

  const response = await makeGroqCall(
    userId,
    key =>
      new Groq({ apiKey: key }).chat.completions.create({
        model: GROQ_MODEL,
        max_tokens: GROQ_TOKENS,
        temperature: 0.42,
        messages: [{
          role: 'user',
          content: `You are an expert educator who creates granular, highly specific learning segments. Every explanation must read like a mini-lecture: concrete, exam-ready, and faithful to the source.\n\nDocument: "${docTitle || 'Uploaded Academic PDF'}"\n${continuityNote}\n\nRULES (follow strictly):\n1. Create as MANY lessons as needed.\n2. EACH lesson must cover EXACTLY ONE atomic concept, claim, event, or skill drawn from the text.\n3. If the passage contains several distinct ideas, split them into separate lessons — do not merge.\n4. Never invent facts, names, dates, or quotes that are not supported by the TEXT TO PROCESS below. If something is unclear in the source, say what the text actually states and what is ambiguous.\n\nTITLE RULES:\n- Specific and descriptive (include the topic, actor, or tension when possible).\n- Never use generic titles: "Introduction", "Overview", "Summary", "Conclusion", "Background", "Key Points".\n- Never reference OCR quality, readability, page numbers, or text extraction in titles or explanations.\n\nEXPLANATION — STRUCTURE AND DEPTH (critical):\n- Write ONLY in third-person explanatory voice (no "In this lesson we will…", no "This section discusses…").\n- Minimum length: **at least 8 full sentences** per lesson unless the source excerpt is genuinely too short to justify that.\n- Format the explanation as **three paragraphs separated by \\n\\n** (blank line between paragraphs):\n\n  PARAGRAPH 1 — Open with the **precise claim or idea** this lesson covers. Then add 2–4 sentences that unpack it using **concrete details from the text**: names of people, institutions, dates, definitions, causal links (because/therefore), or quoted or closely paraphrased phrases. If the text uses technical terms, define them as the document does.\n\n  PARAGRAPH 2 — Explain **how this idea is argued or evidenced** in the passage: reasoning steps, examples, comparisons, or narrative sequence **as given in the source**. Name the evidence type (e.g. historical example, statistic, author's rhetorical move) when the text provides it.\n\n  PARAGRAPH 3 — State **one or two implications**: what follows from this idea in the document's line of thought, what it contrasts with, or what question it leaves open — still grounded in the text, not generic life advice.\n\n- BANNED (do not use vague filler): standalone phrases like "very important", "many people believe", "it is interesting to note", "plays a significant role", "various aspects", "in today's world" **unless** immediately followed by specific content from the text.\n\nKEY POINTS:\n- 4–6 bullet-ready strings; each must be a **complete, specific claim** (not a label). Prefer "who did what / why it matters" over "understanding the concept".\n\nReturn ONLY valid JSON:\n\n{\n  "lessons": [\n    {\n      "title": "Very specific concept title",\n      "explanation": "Paragraph one sentences…\\n\\nParagraph two sentences…\\n\\nParagraph three sentences…",\n      "key_points": ["Specific claim 1", "Specific claim 2"]\n    }\n  ]\n}\n\nTEXT TO PROCESS:\n${chunk}`
        }],
      }),
    resolvedKeyIndex,
  );

  let raw = response.choices[0].message.content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.lessons) ? parsed.lessons : [];
  } catch (e) {
    console.warn(`[LessonAI] Chunk ${chunkIdx} parse failed, attempting recovery...`);

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const recovered = JSON.parse(jsonMatch[0]);
        if (Array.isArray(recovered) && recovered.length > 0) {
          console.log(`[LessonAI] Chunk ${chunkIdx} recovered ${recovered.length} lessons from partial JSON`);
          return recovered;
        }
      } catch {}
    }

    const lessonsMatch = raw.match(/\"lessons\"\s*:\s*\[[\s\S]*\]/);
    if (lessonsMatch) {
      try {
        const obj = JSON.parse(`{${lessonsMatch[0]}}`);
        if (Array.isArray(obj.lessons) && obj.lessons.length > 0) {
          console.log(`[LessonAI] Chunk ${chunkIdx} recovered ${obj.lessons.length} lessons from lessons field`);
          return obj.lessons;
        }
      } catch {}
    }

    console.warn(`[LessonAI] Chunk ${chunkIdx} could not be recovered. Raw response preview: ${raw.slice(0, 200)}`);
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
      id: idx + 1,
      title: l.title.trim(),
      explanation: l.explanation.trim(),
      key_points: Array.isArray(l.key_points)
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
  // This avoids N DB round-trips (one per chunk call) and ensures all chunk
  // calls start cycling from the same key, keeping rotation consistent.
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
  console.log(`[LessonAI] Split into ${chunks.length} chunks`);

  const allRawLessons = [];

  // Process one chunk at a time so makeGroqCall can cycle through ALL keys
  // before moving to the next chunk. Concurrent processing would hammer keys
  // simultaneously and leave none available for subsequent chunks.
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
      // All keys were cycled and still failed for this chunk — skip it, keep going
      console.warn(`[LessonAI] Chunk ${i + 1} failed after cycling all keys: ${err.message}`);
    }
  }

  const lessons = mergeLessons(allRawLessons);
  console.log(`[LessonAI] ✅ Generated ${lessons.length} granular lessons/segments`);

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
    title: meta.title,
    overview: meta.overview,
    lessons,
    totalLessons: lessons.length
  };
}

// ─── DEEP EXPLAIN — multi-section, segment-grounded tutor content ───────────────
async function deepExplainLesson({ title, explanation, key_points, documentTitle, userId = '' }) {
  const response = await makeGroqCall(userId, key =>
    new Groq({ apiKey: key }).chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 3072,
      temperature: 0.55,
      messages: [{
        role: 'user',
        content: `You are a friendly expert tutor. Ground EVERYTHING in this lesson segment only — do not invent facts not supported by the text below.\n\nDocument: "${documentTitle || 'Uploaded PDF'}"\nLesson segment title: "${title}"\n\nSegment explanation (primary source):\n"""${explanation}"""\n\nKey points from the segment:\n${(key_points || []).map(p => `- ${p}`).join('\n') || 'None'}\n\nReturn ONLY valid JSON (no markdown fences). Each string field must be substantive (multiple sentences where asked).\n\n{\n  "detailed_explanation": "4–6 short paragraphs separated by \\n\\n. Teach directly: unpack the segment step by step.",\n  "conceptual_breakdown": "2–3 paragraphs: define terms, actors, and logic used in this segment.",\n  "context_and_debates": "2–3 paragraphs: different viewpoints, tensions, or historical/academic angles implied by THIS segment (stay faithful to the text).",\n  "connections": "1–2 paragraphs: how this segment links to earlier/later ideas in the same document theme (infer only if reasonable from the segment).",\n  "examples": ["Concrete example 1 tied to the segment.", "Concrete example 2 tied to the segment.", "Optional third example."],\n  "why_it_matters": "2–4 sentences on why this segment matters for understanding the document.",\n  "common_misconceptions": ["Misconception vs correction 1.", "Misconception vs correction 2.", "Optional third."],\n  "study_tips": ["Practical tip 1.", "Practical tip 2.", "Practical tip 3."]\n}`
      }],
    })
  );

  let raw = response.choices[0].message.content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    return JSON.parse(raw);
  } catch {
    return {
      detailed_explanation: explanation,
      conceptual_breakdown: '',
      context_and_debates: '',
      connections: '',
      examples: [],
      why_it_matters: '',
      common_misconceptions: [],
      study_tips: [],
    };
  }
}

module.exports = {
  generateLessonsFromText,
  deepExplainLesson
};