export type LessonType =
  | 'phonemic'
  | 'syllable'
  | 'word-matching'
  | 'comprehension'
  | 'h-pattern'
  | 'fluency'
  | 'vocabulary';

export interface CurriculumLesson {
  id: string;
  moduleId: string;
  moduleTitle: string;
  moduleOrder: number;
  lessonOrder: number;
  type: LessonType;
  title: string;
  description: string;
  duration: number; // minutes
  objectives: string[];
}

export interface CurriculumModule {
  id: string;
  title: string;
  description: string;
  order: number;
  targetHours: number;
  lessons: CurriculumLesson[];
}

const LESSON_TYPES: LessonType[] = [
  'phonemic',
  'syllable',
  'word-matching',
  'h-pattern',
  'fluency',
  'vocabulary',
  'comprehension',
];

const MODULE_DEFINITIONS = [
  { id: 'm1', title: 'Foundations', description: 'Letter sounds, phonemic awareness, and early decoding', hours: 5 },
  { id: 'm2', title: 'Phonemic Skills', description: 'Blending, segmenting, and manipulating sounds', hours: 5 },
  { id: 'm3', title: 'Syllables & Decoding', description: 'Syllable patterns and multisyllabic words', hours: 5 },
  { id: 'm4', title: 'Word Recognition', description: 'Sight words, morphology, and word families', hours: 5 },
  { id: 'm5', title: 'Reading Fluency', description: 'Pacing, expression, and H-pattern tracking', hours: 5 },
  { id: 'm6', title: 'Comprehension', description: 'Main idea, inference, and vocabulary in context', hours: 5 },
];

function buildLessonsForModule(
  module: (typeof MODULE_DEFINITIONS)[number],
  moduleOrder: number
): CurriculumLesson[] {
  const lessonsPerModule = 10;
  const minutesPerLesson = (module.hours * 60) / lessonsPerModule;

  return Array.from({ length: lessonsPerModule }, (_, index) => {
    const lessonOrder = index + 1;
    const type = LESSON_TYPES[index % LESSON_TYPES.length];
    return {
      id: `${module.id}-l${lessonOrder}`,
      moduleId: module.id,
      moduleTitle: module.title,
      moduleOrder,
      lessonOrder,
      type,
      title: `${module.title} · Lesson ${lessonOrder}`,
      description: `${module.description} — activity ${lessonOrder} of ${lessonsPerModule}`,
      duration: minutesPerLesson,
      objectives: [
        `Practice ${type.replace('-', ' ')} skills`,
        `Build toward ${module.title.toLowerCase()} mastery`,
      ],
    };
  });
}

export const CURRICULUM_MODULES: CurriculumModule[] = MODULE_DEFINITIONS.map((mod, index) => {
  const lessons = buildLessonsForModule(mod, index + 1);
  return {
    id: mod.id,
    title: mod.title,
    description: mod.description,
    order: index + 1,
    targetHours: mod.hours,
    lessons,
  };
});

export const CURRICULUM_LESSONS: CurriculumLesson[] = CURRICULUM_MODULES.flatMap((m) => m.lessons);

export const CURRICULUM_TOTAL_MINUTES = CURRICULUM_LESSONS.reduce((sum, l) => sum + l.duration, 0);
export const CURRICULUM_TOTAL_HOURS = CURRICULUM_TOTAL_MINUTES / 60;
