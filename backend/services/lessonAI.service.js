/**
 * LESSON AI SERVICE — Powered by GROQ (Llama-3.3-70b)
 * Groq client is instantiated per-request using the user's own API key.
 */

const Groq = require('groq-sdk');

const CHUNK_SIZE  = 10_000;
const MAX_CHUNKS  = 20;
const GROQ_MODEL  = 'llama-3.3-70b-versatile';
const GROQ_TOKENS = 4096;

/** Returns a Groq client using the user's key, falling back to the env key. */
function getGroq(apiKey) {
  return new Groq({ apiKey: apiKey || process.env.GROQ_API_KEY });
}

// ─── TEXT CHUNKING ────────────────────────────────────────────────────────────

function chunkText(text, chunkSize = CHUNK_SIZE) {
  const chunks = [];
  let remaining = text.trim();
  while (remaining.length > 0 && chunks.length < MAX_CHUNKS) {
    if (remaining.length <= chunkSize) { chunks.push(remaining.trim()); break; }
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

async function extractDocumentMeta(preview, fileName, apiKey) {
  const response = await getGroq(apiKey).chat.completions.create({
    model: GROQ_MODEL, max_tokens: 256, temperature: 0.3, stream: false,
    messages: [{
      role: 'user',
      content: `Given this document excerpt (filename: "${fileName}"), return ONLY valid JSON with no markdown:\n{ "title": "descriptive document title", "overview": "2-sentence learning overview" }\n\nEXCERPT:\n${preview.slice(0, 3000)}`,
    }],
  });
  const raw = response.choices[0].message.content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  return JSON.parse(raw);
}

// ─── LESSON GENERATION ────────────────────────────────────────────────────────

async function generateLessonsForChunk(chunk, chunkIdx, totalChunks, docTitle = '', apiKey) {
  const note = totalChunks > 1 ? `\nThis is chunk ${chunkIdx + 1} of ${totalChunks}. Maintain continuity.` : '';

  const response = await getGroq(apiKey).chat.completions.create({
    model: GROQ_MODEL, max_tokens: GROQ_TOKENS, temperature: 0.5, stream: false,
    messages: [{
      role: 'user',
      content: `You are an expert educator and curriculum designer.${note}
Document: "${docTitle || 'Uploaded PDF'}"

Transform the following text into structured learning lessons.

REQUIREMENTS:
1. Break the content into multiple LESSONS (not document sections).
2. Each lesson must represent ONE clear, teachable concept or skill.
3. Cover EVERY important idea — do NOT skip or compress content.
4. If the content is rich, create MORE lessons.

STRICT RULES FOR TITLES:
- NEVER use generic titles like "Introduction", "Overview", "Summary", or "Conclusion".
- Use concept-focused titles: "Understanding X", "How Y Works", "Applying Z in Practice".

STRICT RULES FOR THE EXPLANATION FIELD:
- Write as if you are DIRECTLY TEACHING the student — not describing what the lesson covers.
- NEVER use meta-language like "This lesson covers...", "In this section...", "This lesson explains...", "This topic discusses...".
- Dive straight into the concept: what it IS, then how or why it works, then its consequences or context.
- Use 4-5 natural, confident sentences. Each sentence must add a new detail, cause, or insight.
- Write at the level of a smart high school student — clear, direct, and human.

STRICT RULES FOR KEY POINTS:
- Each key point must be a concrete, standalone fact or insight a student can remember.
- Avoid vague labels. Bad: "Key factors of X". Good: "X happened because of Y, which led to Z."

Return ONLY valid JSON with no markdown fences, no extra text:
{
  "lessons": [
    {
      "title": "Concept-focused lesson title",
      "explanation": "Direct teaching of the concept — no meta-language, no vague summaries.",
      "key_points": ["Concrete fact or insight 1", "Concrete fact or insight 2", "Concrete fact or insight 3"]
    }
  ]
}

TEXT TO PROCESS:\n${chunk}`,
    }],
  });

  const raw = response.choices[0].message.content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
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

async function generateLessonsFromText(fullText, fileName, apiKey) {
  if (!fullText || fullText.trim().length < 30) {
    throw new Error('Insufficient text extracted from PDF.');
  }

  console.log('[LessonAI] Extracting document meta...');
  let meta = { title: fileName.replace(/\.pdf$/i, ''), overview: '' };
  try { meta = await extractDocumentMeta(fullText, fileName, apiKey); }
  catch (e) { console.warn('[LessonAI] Meta extraction failed, using filename:', e.message); }

  const chunks = chunkText(fullText);
  console.log(`[LessonAI] ${chunks.length} chunks from ${fullText.length} chars`);

  const allRawLessons = [];
  const CONCURRENCY   = 3;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch   = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((chunk, bIdx) =>
        generateLessonsForChunk(chunk, i + bIdx, chunks.length, meta.title, apiKey)
          .catch(err => { console.warn(`[LessonAI] Chunk ${i + bIdx} failed:`, err.message); return []; })
      )
    );
    results.forEach(r => allRawLessons.push(...r));
    console.log(`[LessonAI] Processed chunks ${i + 1}–${Math.min(i + CONCURRENCY, chunks.length)} / ${chunks.length}`);
  }

  const lessons = mergeLessons(allRawLessons);
  console.log(`[LessonAI] Final lesson count: ${lessons.length}`);
  if (lessons.length === 0) throw new Error('AI could not extract any lessons from this document.');

  return { title: meta.title, overview: meta.overview, lessons, totalLessons: lessons.length };
}

// ─── DEEP EXPLANATION ─────────────────────────────────────────────────────────

async function deepExplainLesson({ title, explanation, key_points, documentTitle }, apiKey) {
  const response = await getGroq(apiKey).chat.completions.create({
    model: GROQ_MODEL, max_tokens: 2048, temperature: 0.6, stream: false,
    messages: [{
      role: 'user',
      content: `You are a friendly, expert tutor helping a student understand a lesson more deeply.

Document: "${documentTitle || 'Uploaded PDF'}"
Lesson: "${title}"
What they already know: "${explanation}"
Key points covered: ${(key_points || []).map(p => `- ${p}`).join('\n')}

Expand this into a richer explanation — but keep it READABLE and DIGESTIBLE.

RULES:
- detailed_explanation: Write EXACTLY 3 short paragraphs, separated by \\n\\n. Each paragraph is 2-3 sentences. Cover: (1) what it is, (2) how or why it works, (3) its real-world significance. Teach directly — NEVER start with "In this explanation..." or "This lesson...".
- examples: 2 short, concrete, relatable real-world examples. One sentence each. Make them feel real.
- why_it_matters: One punchy sentence. Why should a student care about this right now?
- common_misconceptions: 2 entries. One sentence each — state what students wrongly believe, then correct it in the same sentence.
- study_tips: 2 practical, action-oriented tips for remembering or using this concept. One sentence each.

Return ONLY valid JSON, no markdown fences:
{
  "detailed_explanation": "Paragraph 1.\\n\\nParagraph 2.\\n\\nParagraph 3.",
  "examples": ["Example 1.", "Example 2."],
  "why_it_matters": "One direct sentence.",
  "common_misconceptions": ["Students think X, but actually Y.", "Students think A, but actually B."],
  "study_tips": ["Tip 1.", "Tip 2."]
}`,
    }],
  });

  const raw = response.choices[0].message.content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  return JSON.parse(raw);
}

module.exports = { generateLessonsFromText, deepExplainLesson, chunkText };