export const SCHEDULE_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export type ScheduleDay = (typeof SCHEDULE_DAYS)[number];

export const SCHEDULE_CATEGORIES = [
  "school",
  "study",
  "music",
  "exercise",
  "routine",
  "meals",
  "free",
  "sleep",
  "commute",
] as const;

export type ScheduleCategory = (typeof SCHEDULE_CATEGORIES)[number];

export type ScheduleEvent = {
  id: string;
  day: ScheduleDay;
  startMinute: number | null;
  endMinute: number | null;
  title: string;
  detail?: string;
  category: ScheduleCategory;
  flexible?: boolean;
};

export type SchoolPeriod = {
  id: string;
  day: ScheduleDay;
  period: string;
  timeWindow: string;
  subjectEt: string;
  note: string;
};

export type RoutineItem = {
  id: string;
  section: "morning" | "evening" | "fitness";
  day?: ScheduleDay;
  timeWindow: string;
  title: string;
  details: string;
  category: ScheduleCategory;
};

export type StudyPlan = {
  id: string;
  day: ScheduleDay;
  window: string;
  maxHours: number;
  actualHours: number | null;
  focus: string;
  difficulty: string;
  status: string;
};

export type WeeklyMetric = {
  id: string;
  label: string;
  hours: number;
  detail: string;
};

export type ScheduleData = {
  version: string;
  editorVersion?: 1;
  hiddenEventIds?: string[];
  title: string;
  subtitle: string;
  timeZone: "Europe/Tallinn";
  events: ScheduleEvent[];
  schoolPeriods: SchoolPeriod[];
  routines: RoutineItem[];
  studyPlans: StudyPlan[];
  metrics: WeeklyMetric[];
};
