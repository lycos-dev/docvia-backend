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
    temperature: 0.42,
    messages: [{
      role: 'user',
      content: `You are an expert educator who creates granular, highly specific learning segments. Every explanation must read like a mini-lecture: concrete, exam-ready, and faithful to the source.

Document: "${docTitle || 'Uploaded Academic PDF'}"
${continuityNote}

RULES (follow strictly):
1. Create as MANY lessons as needed.
2. EACH lesson must cover EXACTLY ONE atomic concept, claim, event, or skill drawn from the text.
3. If the passage contains several distinct ideas, split them into separate lessons — do not merge.
4. Never invent facts, names, dates, or quotes that are not supported by the TEXT TO PROCESS below. If something is unclear in the source, say what the text actually states and what is ambiguous.

TITLE RULES:
- Specific and descriptive (include the topic, actor, or tension when possible).
- Never use generic titles: "Introduction", "Overview", "Summary", "Conclusion", "Background", "Key Points".

EXPLANATION — STRUCTURE AND DEPTH (critical):
- Write ONLY in third-person explanatory voice (no "In this lesson we will…", no "This section discusses…").
- Minimum length: **at least 8 full sentences** per lesson unless the source excerpt is genuinely too short to justify that.
- Format the explanation as **three paragraphs separated by \\n\\n** (blank line between paragraphs):

  PARAGRAPH 1 — Open with the **precise claim or idea** this lesson covers. Then add 2–4 sentences that unpack it using **concrete details from the text**: names of people, institutions, dates, definitions, causal links (because/therefore), or quoted or closely paraphrased phrases. If the text uses technical terms, define them as the document does.

  PARAGRAPH 2 — Explain **how this idea is argued or evidenced** in the passage: reasoning steps, examples, comparisons, or narrative sequence **as given in the source**. Name the evidence type (e.g. historical example, statistic, author’s rhetorical move) when the text provides it.

  PARAGRAPH 3 — State **one or two implications**: what follows from this idea in the document’s line of thought, what it contrasts with, or what question it leaves open — still grounded in the text, not generic life advice.

- BANNED (do not use vague filler): standalone phrases like "very important", "many people believe", "it is interesting to note", "plays a significant role", "various aspects", "in today’s world" **unless** immediately followed by specific content from the text.

KEY POINTS:
- 4–6 bullet-ready strings; each must be a **complete, specific claim** (not a label). Prefer "who did what / why it matters" over "understanding the concept".

Return ONLY valid JSON:

{
  "lessons": [
    {
      "title": "Very specific concept title",
      "explanation": "Paragraph one sentences…\\n\\nParagraph two sentences…\\n\\nParagraph three sentences…",
      "key_points": ["Specific claim 1", "Specific claim 2"]
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

// ─── DEEP EXPLAIN — multi-section, segment-grounded tutor content ───────────────
async function deepExplainLesson({ title, explanation, key_points, documentTitle }) {
  const response = await getGroq().chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 3072,
    temperature: 0.55,
    messages: [{
      role: 'user',
      content: `You are a friendly expert tutor. Ground EVERYTHING in this lesson segment only — do not invent facts not supported by the text below.

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