const KEY = (documentId: string) => `docvia-lesson-content-visited:${documentId}`;

function readSet(documentId: string): Set<string> {
  if (!documentId) return new Set();
  try {
    const raw = localStorage.getItem(KEY(documentId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown[];
    return new Set(arr.map((id) => String(id)));
  } catch {
    return new Set();
  }
}

/** Call when the reader has loaded a lesson (user is viewing lesson content). */
export function markLessonContentVisited(
  documentId: string,
  lessonId: string,
): void {
  if (!documentId || !lessonId) return;
  const s = readSet(documentId);
  s.add(String(lessonId));
  localStorage.setItem(KEY(documentId), JSON.stringify([...s]));
  window.dispatchEvent(new CustomEvent("docvia-lesson-content-visited"));
}

export function hasVisitedLessonContent(
  documentId: string,
  lessonId: string,
): boolean {
  if (!documentId || !lessonId) return false;
  return readSet(documentId).has(String(lessonId));
}

export function getVisitedLessonIds(documentId: string): Set<string> {
  return readSet(documentId);
}
