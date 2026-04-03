/**
 * LESSON AI SERVICE — Powered by GROQ (Llama-3.3-70b)
 * FIXED: Now creates highly granular segments.
 * Each lesson/segment = EXACTLY ONE concept/skill (no more multi-concept lessons).
 */

const Groq = require('groq-sdk');

let groq = null;
function getGroq() {
  if (!groq) {
    const keys = (process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) throw new Error('No GROQ_API_KEY provided');
    const key = keys[Math.floor(Math.random() * keys.length)];
    groq = new Groq({ apiKey: key });
  }
  return groq;
}

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
async function extractDocumentMeta(preview, fileName) {
  const response = await getGroq().chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 300,
    temperature: 0.3,
    messages: [{
      role: 'user',
      content: `You are an expert academic document analyst.
Return ONLY valid JSON:
{
  "title": "Clear, descriptive academic title",
  "overview": "2-3 sentence overview of what the document teaches"
}
EXCERPT:\n${preview.slice(0, 3500)}`
    }],
  });

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
async function generateLessonsForChunk(chunk, chunkIdx, totalChunks, docTitle = '') {
  const continuityNote = totalChunks > 1
    ? `\nThis is chunk ${chunkIdx + 1} of ${totalChunks}. Maintain continuity with previous chunks but do NOT repeat content.`
    : '';

  const response = await getGroq().chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: GROQ_TOKENS,
    temperature: 0.5,
    messages: [{
      role: 'user',
      content: `You are an expert educator who creates extremely granular learning segments.

Document: "${docTitle || 'Uploaded Academic PDF'}"
${continuityNote}

RULES (follow strictly):
1. Create as MANY lessons as needed.
2. EACH lesson must cover EXACTLY ONE single, atomic concept or skill.
3. If the text contains 5 distinct ideas → create 5 separate lessons.
4. Never combine multiple concepts into one lesson.
5. Cover every important idea — be generous with the number of lessons.

TITLE RULES:
- Use specific, concept-focused titles only.
- Never use generic titles like "Introduction", "Overview", "Summary", "Conclusion", "Background".

EXPLANATION RULES:
- Write as if you are directly teaching the student.
- Start straight into the concept. No meta-language ("This lesson explains...", "In this section...").
- 4–6 clear, natural sentences.

KEY POINTS:
- 3–5 concrete, memorable insights.

Return ONLY valid JSON:

{
  "lessons": [
    {
      "title": "Very specific concept title",
      "explanation": "Direct teaching text...",
      "key_points": ["Concrete insight 1", "Concrete insight 2"]
    }
  ]
}

TEXT TO PROCESS:
${chunk}`
    }],
  });

  let raw = response.choices[0].message.content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.lessons) ? parsed.lessons : [];
  } catch (e) {
    console.warn(`[LessonAI] Chunk ${chunkIdx} parse failed`);
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
async function generateLessonsFromText(fullText, fileName) {
  if (!fullText || fullText.trim().length < 100) {
    throw new Error('Insufficient text extracted from PDF.');
  }

  console.log('[LessonAI] Extracting document meta...');
  let meta = { title: fileName.replace(/\.pdf$/i, '').replace(/_/g, ' '), overview: '' };
  try {
    meta = await extractDocumentMeta(fullText, fileName);
  } catch (e) {
    console.warn('[LessonAI] Meta extraction failed:', e.message);
  }

  const chunks = chunkText(fullText);
  console.log(`[LessonAI] Split into ${chunks.length} chunks`);

  const allRawLessons = [];
  const CONCURRENCY = 3;

  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((chunk, bIdx) =>
        generateLessonsForChunk(chunk, i + bIdx, chunks.length, meta.title)
          .catch(err => {
            console.warn(`[LessonAI] Chunk ${i + bIdx} failed:`, err.message);
            return [];
          })
      )
    );
    results.forEach(r => allRawLessons.push(...r));
    console.log(`[LessonAI] Processed chunks ${i + 1}–${Math.min(i + CONCURRENCY, chunks.length)} / ${chunks.length}`);
  }

  const lessons = mergeLessons(allRawLessons);
  console.log(`[LessonAI] ✅ Generated ${lessons.length} granular lessons/segments`);

  if (lessons.length === 0) {
    throw new Error('Could not generate lessons. Try a text-based PDF.');
  }

  return {
    title: meta.title,
    overview: meta.overview,
    lessons,
    totalLessons: lessons.length
  };
}

// ─── DEEP EXPLAIN (unchanged, still works well) ───────────────────────────────
async function deepExplainLesson({ title, explanation, key_points, documentTitle }) {
  const response = await getGroq().chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 2048,
    temperature: 0.6,
    messages: [{
      role: 'user',
      content: `You are a friendly expert tutor.
Document: "${documentTitle || 'Uploaded PDF'}"
Lesson: "${title}"

Previous explanation: "${explanation}"
Key points: ${(key_points || []).map(p => `- ${p}`).join('\n') || 'None'}

Return ONLY valid JSON with richer explanation:

{
  "detailed_explanation": "Exactly 3 paragraphs separated by \\n\\n. Teach directly.",
  "examples": ["Relatable example 1.", "Relatable example 2."],
  "why_it_matters": "One punchy sentence.",
  "common_misconceptions": ["Students think X, but actually Y.", "Another common mistake."],
  "study_tips": ["Practical tip 1.", "Practical tip 2."]
}`
    }],
  });

  let raw = response.choices[0].message.content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    return JSON.parse(raw);
  } catch {
    return { detailed_explanation: explanation, examples: [], why_it_matters: "", common_misconceptions: [], study_tips: [] };
  }
}

module.exports = {
  generateLessonsFromText,
  deepExplainLesson
};