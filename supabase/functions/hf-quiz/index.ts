import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const HF_API_URL =
  'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';
const MAX_TEXT_CHARS = 4000;
const DEFAULT_MAX_QUESTIONS = 3;

interface QuizQuestionPayload {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface RequestBody {
  mode?: 'quiz' | 'summary';
  text?: string;
  pageNumber?: number;
  documentId?: string;
  maxQuestions?: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildQuizPrompt(text: string, maxQuestions: number): string {
  return `[INST] You are a reading comprehension tutor. Read the passage below and create exactly ${maxQuestions} multiple-choice questions.

Return ONLY valid JSON in this shape (no markdown):
{"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"..."}]}

Rules:
- Questions must be answerable from the passage only
- Each question has exactly 4 options
- correctAnswer is the 0-based index of the correct option
- Use clear, age-appropriate language

Passage:
${text.slice(0, MAX_TEXT_CHARS)}
[/INST]`;
}

function buildSummaryPrompt(text: string): string {
  return `[INST] Summarize the following passage in 2-3 sentences for a student reader. Return plain text only, no markdown.

${text.slice(0, MAX_TEXT_CHARS)}
[/INST]`;
}

function parseQuizJson(raw: string): QuizQuestionPayload[] {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return [];
  }

  const parsed = JSON.parse(jsonMatch[0]) as { questions?: QuizQuestionPayload[] };
  if (!Array.isArray(parsed.questions)) {
    return [];
  }

  return parsed.questions
    .filter(
      (q) =>
        typeof q.question === 'string' &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        typeof q.correctAnswer === 'number'
    )
    .map((q) => ({
      question: q.question.trim(),
      options: q.options.map(String).slice(0, 4),
      correctAnswer: Math.min(Math.max(0, q.correctAnswer), q.options.length - 1),
      explanation: q.explanation?.trim(),
    }));
}

function heuristicQuiz(text: string, maxQuestions: number): QuizQuestionPayload[] {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);

  return sentences.slice(0, maxQuestions).map((sentence, index) => {
    const words = sentence.split(/\s+/);
    const keyWord = words[Math.floor(words.length / 2)] ?? 'topic';
    return {
      question: `What does the passage say about "${keyWord}"?`,
      options: [
        sentence.slice(0, 60) + (sentence.length > 60 ? '…' : ''),
        'It is not mentioned in the passage.',
        'It is unrelated to the main idea.',
        'It contradicts other details.',
      ],
      correctAnswer: 0,
      explanation: `From the passage: "${sentence.slice(0, 100)}…"`,
    };
  });
}

async function callHuggingFace(prompt: string, hfToken: string): Promise<string> {
  const response = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hfToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 1024,
        temperature: 0.3,
        return_full_text: false,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`HuggingFace API error ${response.status}: ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as Array<{ generated_text?: string }> | { generated_text?: string };
  if (Array.isArray(payload)) {
    return payload[0]?.generated_text ?? '';
  }
  return payload.generated_text ?? '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const text = (body.text ?? '').trim();
  if (!text) {
    return jsonResponse({ error: 'text is required' }, 400);
  }

  const mode = body.mode ?? 'quiz';
  const maxQuestions = Math.min(Math.max(body.maxQuestions ?? DEFAULT_MAX_QUESTIONS, 1), 5);
  const hfToken = Deno.env.get('HUGGINGFACE_API_KEY');

  try {
    if (mode === 'summary') {
      if (hfToken) {
        const summary = await callHuggingFace(buildSummaryPrompt(text), hfToken);
        if (summary.trim()) {
          return jsonResponse({ summary: summary.trim() });
        }
      }
      const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      return jsonResponse({ summary: sentences.slice(0, 3).join('. ').trim() + '.' });
    }

    if (hfToken) {
      try {
        const generated = await callHuggingFace(buildQuizPrompt(text, maxQuestions), hfToken);
        const questions = parseQuizJson(generated);
        if (questions.length > 0) {
          return jsonResponse({ questions: questions.slice(0, maxQuestions), source: 'huggingface' });
        }
      } catch (error) {
        console.error('HF quiz generation failed, using heuristic fallback', error);
      }
    }

    const questions = heuristicQuiz(text, maxQuestions);
    return jsonResponse({ questions, source: 'heuristic' });
  } catch (error) {
    console.error('hf-quiz error', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
});
