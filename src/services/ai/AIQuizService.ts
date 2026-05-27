import { Quiz, QuizQuestion } from '../../types';
import { logger } from '../logger/Logger';
import { getSupabaseUrl, isSupabaseConfigured } from '../storage/supabase/SupabaseClient';

const MAX_QUESTIONS = 3;
const MIN_SENTENCE_LENGTH = 20;

interface EdgeQuizResponse {
  questions?: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  }>;
}

class AIQuizService {
  async generateQuiz(text: string, pageNumber: number, documentId: string): Promise<Quiz> {
    const sourceText = text.trim();
    if (!sourceText) {
      return {
        id: `quiz-${documentId}-${pageNumber}`,
        documentId,
        pageNumber,
        questions: [],
      };
    }

    if (isSupabaseConfigured()) {
      const edgeQuiz = await this.generateViaEdgeFunction(sourceText, pageNumber, documentId);
      if (edgeQuiz) {
        return edgeQuiz;
      }
    }

    logger.info('AIQuizService using local heuristic quiz from page text');
    return this.generateRuleBasedQuiz(sourceText, pageNumber, documentId);
  }

  private resolveEdgeUrl(): string | null {
    const explicit = process.env.EXPO_PUBLIC_HF_QUIZ_EDGE_URL;
    if (explicit && !explicit.includes('your-project')) {
      return explicit;
    }

    const supabaseUrl = getSupabaseUrl();
    if (supabaseUrl && isSupabaseConfigured()) {
      return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/hf-quiz`;
    }

    return null;
  }

  scoreQuiz(quiz: Quiz, answers: number[]): number {
    if (answers.length !== quiz.questions.length || quiz.questions.length === 0) {
      return 0;
    }

    let correct = 0;
    for (let i = 0; i < quiz.questions.length; i++) {
      if (answers[i] === quiz.questions[i].correctAnswer) {
        correct++;
      }
    }

    return Math.round((correct / quiz.questions.length) * 100);
  }

  async generateSummary(text: string): Promise<string> {
    const edgeUrl = this.resolveEdgeUrl();
    if (edgeUrl && isSupabaseConfigured()) {
      try {
        const response = await fetch(edgeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'summary', text }),
        });

        if (response.ok) {
          const payload = (await response.json()) as { summary?: string };
          if (payload.summary) {
            return payload.summary;
          }
        }
      } catch (error) {
        logger.warn('AIQuizService summary edge call failed', { error: String(error) });
      }
    }

    const sentences = text.split(/[.!?]+/).filter((sentence) => sentence.trim().length > 0);
    return sentences.slice(0, 3).join('. ').trim() + '.';
  }

  private async generateViaEdgeFunction(
    text: string,
    pageNumber: number,
    documentId: string
  ): Promise<Quiz | null> {
    const edgeUrl = this.resolveEdgeUrl();
    if (!edgeUrl) {
      return null;
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (anonKey) {
        headers.Authorization = `Bearer ${anonKey}`;
      }

      const response = await fetch(edgeUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode: 'quiz',
          text,
          pageNumber,
          documentId,
          maxQuestions: MAX_QUESTIONS,
        }),
      });

      if (!response.ok) {
        logger.warn('AIQuizService edge function returned error', { status: response.status });
        return null;
      }

      const payload = (await response.json()) as EdgeQuizResponse;
      if (!payload.questions || payload.questions.length === 0) {
        return null;
      }

      const questions: QuizQuestion[] = payload.questions.slice(0, MAX_QUESTIONS).map(
        (item, index) => ({
          id: `q-edge-${index}`,
          question: item.question,
          options: item.options,
          correctAnswer: item.correctAnswer,
          explanation: item.explanation,
        })
      );

      logger.info('AIQuizService quiz generated via edge function', {
        questionCount: questions.length,
      });

      return {
        id: `quiz-${documentId}-${pageNumber}`,
        documentId,
        pageNumber,
        questions,
      };
    } catch (error) {
      logger.warn('AIQuizService edge function unavailable', { error: String(error) });
      return null;
    }
  }

  private generateRuleBasedQuiz(
    text: string,
    pageNumber: number,
    documentId: string
  ): Quiz {
    const sentences = text.split(/[.!?]+/).filter((sentence) => sentence.trim().length > 0);
    const questions: QuizQuestion[] = [];

    for (let i = 0; i < Math.min(MAX_QUESTIONS, sentences.length); i++) {
      const sentence = sentences[i].trim();
      if (sentence.length < MIN_SENTENCE_LENGTH) {
        continue;
      }

      const words = sentence.split(/\s+/);
      const keyWord = words[Math.floor(words.length / 2)] ?? 'topic';

      questions.push({
        id: `q-${i}`,
        question: `What is mentioned about "${keyWord}" in this passage?`,
        options: [
          sentence.substring(0, 50) + '...',
          'It is not mentioned.',
          'It is the main topic.',
          'It is a minor detail.',
        ],
        correctAnswer: 0,
        explanation: `The passage states: "${sentence.substring(0, 100)}..."`,
      });
    }

    return {
      id: `quiz-${documentId}-${pageNumber}`,
      documentId,
      pageNumber,
      questions,
    };
  }
}

export default new AIQuizService();
