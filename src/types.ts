export type QuestionType = 'Multiple Choice' | 'Fill-in-the-blank';

export type Question = {
  id: string;
  question?: string;
  chQuestion?: string;
  questionType: QuestionType;
  options: string[];
  chOptions: string[];
  answer: string;
  image?: string; // e.g. "images/xxx.jpg"
};

export type QuizView = 'start' | 'quiz' | 'result';

