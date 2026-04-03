import { useState } from 'react';
import { generateQuiz, evaluateAnswer } from '../services/readerService';
import type { MicrotaskQuestion } from '../services/readerService';

const QUIZ_TYPES = [
  { id: 'multiple_choice', label: 'Multiple Choice', icon: '🔵' },
  { id: 'true_false', label: 'True / False', icon: '⚖️' },
  { id: 'identification', label: 'Identification', icon: '🔍' },
  { id: 'short_answer', label: 'Short Answer', icon: '✏️' },
  { id: 'essay', label: 'Essay', icon: '📝' },
];

interface QuizPanelProps {
  documentTitle: string;
  lessonTitle: string;
  lessonContent: string;
}

type PanelState = 'picker' | 'loading' | 'question' | 'result' | 'summary';

export default function QuizPanel({ documentTitle, lessonTitle, lessonContent }: QuizPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>('picker');
  const [quizType, setQuizType] = useState('multiple_choice');
  const [quizMode, setQuizMode] = useState<'quick' | 'custom'>('quick');
  const [quizCount, setQuizCount] = useState(3);
  const [questions, setQuestions] = useState<MicrotaskQuestion[]>([]);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; feedback: string; correctAnswer: string } | null>(null);
  const [askedQuestions, setAskedQuestions] = useState<string[]>([]);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [evaluating, setEvaluating] = useState(false);

  const currentQuestion = questions[questionIdx];

  const startQuiz = async () => {
    setPanelState('loading');
    setFeedback(null);
    setSelectedOption(null);
    setUserAnswer('');
    const count = quizMode === 'quick' ? 1 : quizCount;
    const result = await generateQuiz(lessonTitle, lessonContent, documentTitle, quizType, count, askedQuestions);
    if (result.success && result.tasks && result.tasks.length > 0) {
      // Dedup
      const seen = new Set(askedQuestions.map((q) => q.toLowerCase().trim()));
      const deduped = result.tasks.filter((t) => {
        const k = (t.question ?? '').toLowerCase().trim();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (deduped.length === 0) {
        setPanelState('summary');
        return;
      }
      setQuestions(deduped);
      setQuestionIdx(0);
      setAskedQuestions((prev) => [...prev, ...deduped.map((t) => t.question)]);
      setScore({ correct: 0, total: 0 });
      setPanelState('question');
    } else {
      setPanelState('picker');
    }
  };

  const submitAnswer = async () => {
    if (!currentQuestion) return;
    const answer =
      currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'true_false'
        ? selectedOption !== null
          ? currentQuestion.options[selectedOption]
          : ''
        : userAnswer.trim();
    if (!answer) return;

    setEvaluating(true);
    const result = await evaluateAnswer(
      currentQuestion.question,
      answer,
      currentQuestion.correctAnswer ?? currentQuestion.options?.[0] ?? '',
      currentQuestion.type
    );
    setEvaluating(false);
    setFeedback({
      isCorrect: result.isCorrect ?? false,
      feedback: result.feedback ?? '',
      correctAnswer: result.correctAnswer ?? '',
    });
    setScore((prev) => ({
      correct: prev.correct + (result.isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));
    setPanelState('result');
  };

  const nextQuestion = () => {
    if (questionIdx + 1 < questions.length) {
      setQuestionIdx((i) => i + 1);
      setFeedback(null);
      setSelectedOption(null);
      setUserAnswer('');
      setPanelState('question');
    } else {
      if (quizMode === 'quick') {
        // Quick quiz: infinite — generate next question
        setPanelState('picker');
      } else {
        setPanelState('summary');
      }
    }
  };

  if (panelState === 'picker') {
    return (
      <div className="p-4 space-y-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">📝 Set Up Your Quiz</h4>

        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2 uppercase tracking-wide">Question Type</p>
          <div className="flex flex-wrap gap-1.5">
            {QUIZ_TYPES.map((t) => (
              <button key={t.id} onClick={() => setQuizType(t.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${quizType === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2 uppercase tracking-wide">Quiz Mode</p>
          <div className="flex gap-2">
            {(['quick', 'custom'] as const).map((mode) => (
              <button key={mode} onClick={() => setQuizMode(mode)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-colors ${quizMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                {mode === 'quick' ? '⚡ Quick (infinite)' : '🎯 Custom'}
              </button>
            ))}
          </div>
          {quizMode === 'custom' && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Questions:</span>
              <input type="range" min={2} max={10} value={quizCount} onChange={(e) => setQuizCount(Number(e.target.value))}
                className="flex-1 accent-blue-600" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-4">{quizCount}</span>
            </div>
          )}
        </div>

        <button onClick={startQuiz}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors">
          {quizMode === 'quick' ? '⚡ Start Quick Quiz →' : `🎯 Start ${quizCount}-Question Quiz →`}
        </button>
      </div>
    );
  }

  if (panelState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400 dark:text-gray-500">Generating questions…</p>
      </div>
    );
  }

  if (panelState === 'summary') {
    const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
        <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">{pct}%</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{score.correct} / {score.total} correct</p>
        {pct >= 80 && <p className="text-sm font-medium text-green-600 dark:text-green-400">🎉 Great job!</p>}
        {pct < 50 && <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Keep practising! Try again below.</p>}
        <button onClick={() => { setAskedQuestions([]); setPanelState('picker'); setScore({ correct: 0, total: 0 }); }}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
          Try Again
        </button>
      </div>
    );
  }

  // Question view
  const isMC = currentQuestion?.type === 'multiple_choice' || currentQuestion?.type === 'true_false';
  const isTextAnswer = !isMC;
  const totalQ = questions.length;
  const pct = totalQ > 1 ? Math.round((questionIdx / totalQ) * 100) : 0;

  return (
    <div className="flex flex-col h-full p-4 gap-3 overflow-y-auto">
      {/* Progress bar */}
      {totalQ > 1 && (
        <div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Q {questionIdx + 1} / {totalQ}</p>
        </div>
      )}

      {/* Question */}
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
        {currentQuestion?.question}
      </p>

      {/* Options (MC / T-F) */}
      {isMC && panelState === 'question' && (
        <div className="space-y-2">
          {currentQuestion.options.map((opt, i) => (
            <button key={i} onClick={() => setSelectedOption(i)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${selectedOption === i ? 'bg-blue-600 text-white' : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
              <span className="font-semibold mr-2">
                {currentQuestion.type === 'true_false' ? (i === 0 ? 'T' : 'F') : String.fromCharCode(65 + i)}.
              </span>
              {opt.replace(/^[A-DFT]\.\s*/, '')}
            </button>
          ))}
        </div>
      )}

      {/* Text answer */}
      {isTextAnswer && panelState === 'question' && (
        <textarea
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Type your answer here…"
          rows={3}
          className="w-full resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      )}

      {/* Submit */}
      {panelState === 'question' && (
        <button onClick={submitAnswer} disabled={evaluating || (isMC ? selectedOption === null : !userAnswer.trim())}
          className="py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {evaluating ? 'Evaluating…' : 'Submit Answer'}
        </button>
      )}

      {/* Feedback */}
      {panelState === 'result' && feedback && (
        <div className={`rounded-xl p-3 text-sm ${feedback.isCorrect ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'}`}>
          <p className="font-semibold mb-1">{feedback.isCorrect ? '✅ Correct!' : '❌ Not quite'}</p>
          {feedback.feedback && <p className="text-xs">{feedback.feedback}</p>}
          {!feedback.isCorrect && feedback.correctAnswer && (
            <p className="text-xs mt-1">Correct answer: <span className="font-semibold">{feedback.correctAnswer}</span></p>
          )}
        </div>
      )}

      {/* Next */}
      {panelState === 'result' && (
        <button onClick={nextQuestion}
          className="py-2 bg-gray-800 dark:bg-gray-600 hover:bg-gray-900 dark:hover:bg-gray-500 text-white rounded-xl text-sm font-semibold transition-colors">
          {questionIdx + 1 < questions.length ? 'Next Question →' : quizMode === 'quick' ? 'Another Question →' : 'View Results'}
        </button>
      )}
    </div>
  );
}
