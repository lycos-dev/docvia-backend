/**
 * LESSON AI SERVICE — Powered by GROQ (Mixtral-8x7b)
 *
 * Uses the same GROQ_API_KEY already in your .env.
 * Pipeline:
 *  1. Receive full extracted PDF text
 *  2. Chunk text into ~10k char pieces
 *  3. For every chunk → call GROQ to generate structured lessons
 *  4. Merge all lessons, assign sequential IDs, return
 */

const Groq = require('groq-sdk');

let groq = null;
function getGroq() {
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groq;
}

const CHUNK_SIZE  = 10_000;
const MAX_CHUNKS  = 20;
const GROQ_MODEL  = 'llama-3.3-70b-versatile';
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
    model:       GROQ_MODEL,
    max_tokens:  256,
    temperature: 0.3,
    stream:      false,
    messages: [{
      role: 'user',
      content: `Given this document excerpt (filename: "${fileName}"), return ONLY valid JSON with no markdown fences:
{ "title": "descriptive document title", "overview": "2-sentence learning overview" }

EXCERPT:
${preview.slice(0, 3000)}`,
    }],
  });

  const raw = response.choices[0].message.content
    .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(raw);
}

// ─── LESSON GENERATION FOR ONE CHUNK ─────────────────────────────────────────

async function generateLessonsForChunk(chunkText, chunkIdx, totalChunks, docTitle = '') {
  const continuationNote = totalChunks > 1
    ? `\nThis is chunk ${chunkIdx + 1} of ${totalChunks} from the same document. Maintain continuity.`
    : '';

  const response = await getGroq().chat.completions.create({
    model:       GROQ_MODEL,
    max_tokens:  GROQ_TOKENS,
    temperature: 0.5,
    stream:      false,
    messages: [{
      role: 'user',
      content: `You are an expert educator and curriculum designer.${continuationNote}
Document: "${docTitle || 'Uploaded PDF'}"

Transform the following text into structured learning lessons.

REQUIREMENTS:
1. Break the content into multiple LESSONS (not document sections).
2. Each lesson must represent ONE clear, teachable concept or skill.
3. Cover EVERY important idea — do NOT skip or compress content.
4. If the content is rich, create MORE lessons.

STRICT RULES:
- NEVER create generic titles like "Introduction", "Overview", "Summary", or "Conclusion".
- Use concept-focused titles like "Understanding X", "How Y Works", "Applying Z in Practice".
- Each lesson must stand alone as something a student can study.
- Use a clear teaching tone in the explanation (3-6 sentences).
- Key points should be actionable takeaways, not just topic labels.

Return ONLY valid JSON with no markdown fences, no extra text:
{
  "lessons": [
    {
      "title": "Concept-focused lesson title",
      "explanation": "Clear 3-6 sentence teaching explanation.",
      "key_points": ["Specific takeaway 1", "Specific takeaway 2", "Specific takeaway 3"]
    }
  ]
}

TEXT TO PROCESS:
${chunkText}`,
    }],
  });

  const raw = response.choices[0].message.content
    .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.lessons) ? parsed.lessons : [];
}

// ─── MERGE & NORMALISE ────────────────────────────────────────────────────────

function mergeLessons(allLessons) {
  const genericTitles = /^(introduction|overview|summary|conclusion|background|preface|foreword|abstract)\b/i;
  return allLessons
    .filter(l => l.title && l.explanation)
    .filter(l => !genericTitles.test(l.title.trim()))
    .map((l, idx) => ({
      id:          idx + 1,
      title:       l.title.trim(),
      explanation: l.explanation.trim(),
      key_points:  Array.isArray(l.key_points) ? l.key_points.map(p => p.trim()) : [],
    }));
}

// ─── MAIN PIPELINE ────────────────────────────────────────────────────────────

async function generateLessonsFromText(fullText, fileName) {
  if (!fullText || fullText.trim().length < 30) {
    throw new Error('Insufficient text extracted from PDF.');
  }

  // 1. Extract document meta
  console.log('[LessonAI] Extracting document meta...');
  let meta = { title: fileName.replace(/\.pdf$/i, ''), overview: '' };
  try {
    meta = await extractDocumentMeta(fullText, fileName);
  } catch (e) {
    console.warn('[LessonAI] Meta extraction failed, using filename:', e.message);
  }

  // 2. Chunk the text
  const chunks = chunkText(fullText);
  console.log(`[LessonAI] ${chunks.length} chunks from ${fullText.length} chars`);

  // 3. Generate lessons per chunk (concurrency 3)
  const allRawLessons = [];
  const CONCURRENCY   = 3;

  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch   = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((chunk, batchIdx) =>
        generateLessonsForChunk(chunk, i + batchIdx, chunks.length, meta.title)
          .catch(err => {
            console.warn(`[LessonAI] Chunk ${i + batchIdx} failed:`, err.message);
            return [];
          })
      )
    );
    results.forEach(r => allRawLessons.push(...r));
    console.log(`[LessonAI] Processed chunks ${i + 1}–${Math.min(i + CONCURRENCY, chunks.length)} / ${chunks.length}`);
  }

  // 4. Merge and normalise
  const lessons = mergeLessons(allRawLessons);
  console.log(`[LessonAI] Final lesson count: ${lessons.length}`);

  if (lessons.length === 0) {
    throw new Error('AI could not extract any lessons from this document.');
  }

  return { title: meta.title, overview: meta.overview, lessons, totalLessons: lessons.length };
}

module.exports = { generateLessonsFromText, chunkText };