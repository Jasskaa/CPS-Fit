export type Role = 'admin' | 'trainer' | 'member'
export type MemberStatus = 'pending' | 'active' | 'paused' | 'inactive'
export type Level = 'beginner' | 'intermediate' | 'advanced'
export type SetKind = 'normal' | 'warmup' | 'dropset' | 'superset'

export interface Profile {
  id: string
  role: Role
  full_name: string
  email: string | null
  locale: 'ca' | 'es'
  units: 'kg' | 'lb'
  theme: 'light' | 'dark' | 'system'
  status: MemberStatus
  consent_at: string | null
  created_at: string
}

export interface MemberDetails {
  member_id: string
  goal: string | null
  level: Level
  days_per_week: number | null
  limitations: string | null
  trainer_notes: string | null
  shares_photos: boolean
  joined_at: string
}

export interface Exercise {
  id: string
  slug: string
  name_ca: string
  name_es: string
  primary_muscle: string
  secondary_muscles: string[]
  equipment: string
  description_ca: string | null
  description_es: string | null
  tips_ca: string | null
  tips_es: string | null
  mistakes_ca: string | null
  mistakes_es: string | null
  media_url: string | null
  level: Level
  tags: string[]
  is_timed: boolean
}

export interface Routine {
  id: string
  owner_id: string | null
  created_by: string
  name: string
  description: string | null
  goal: string | null
  is_template: boolean
  duration_weeks: number | null
  version: number
  parent_id: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

export interface RoutineExercise {
  id: string
  day_id: string
  exercise_id: string
  position: number
  sets: number
  reps_min: number | null
  reps_max: number | null
  duration_sec: number | null
  target_weight: number | null
  rest_sec: number
  rpe: number | null
  set_type: SetKind
  superset_group: number | null
  notes: string | null
  exercise?: Exercise
}

export interface RoutineDay {
  id: string
  routine_id: string
  position: number
  name: string
  exercises: RoutineExercise[]
}

export interface RoutineFull extends Routine {
  days: RoutineDay[]
}

export interface Assignment {
  id: string
  member_id: string
  routine_id: string
  assigned_by: string
  start_date: string
  end_date: string | null
  status: 'active' | 'completed' | 'cancelled'
}

export interface WorkoutSession {
  id: string
  member_id: string
  routine_id: string | null
  day_id: string | null
  day_name: string | null
  started_at: string
  ended_at: string | null
  notes: string | null
}

export interface WorkoutSet {
  id: string
  session_id: string
  exercise_id: string
  set_index: number
  set_type: SetKind
  weight: number | null
  reps: number | null
  duration_sec: number | null
  rpe: number | null
  completed: boolean
}

export interface Announcement {
  id: string
  title_ca: string
  title_es: string | null
  body_ca: string | null
  body_es: string | null
  starts_at: string
  ends_at: string | null
  pinned: boolean
}

export interface CommentRow {
  id: string
  member_id: string
  author_id: string
  routine_id: string | null
  routine_exercise_id: string | null
  parent_id: string | null
  body: string
  resolved: boolean
  created_at: string
}

export interface Measurement {
  id: string
  member_id: string
  measured_at: string
  weight_kg: number | null
  body_fat_pct: number | null
  waist_cm: number | null
  chest_cm: number | null
  hip_cm: number | null
  arm_cm: number | null
  thigh_cm: number | null
}
