-- QR Attendance - starter schema
-- Run this once in Supabase Dashboard > SQL Editor > New query.
-- It is only the bare minimum: two tables, no triggers, no stored procedures.

-- One row per student.
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_id text not null unique,
  full_name text not null,
  department text,
  year_of_study int,
  -- Whatever string you decide to put inside the QR code.
  qr_payload text,
  created_at timestamptz not null default now()
);

-- One row per student per class. The unique constraint stops a student
-- from being marked twice on the same day, and is what the app's "update"
-- button upserts against.
-- Watch out: `student_id` here is the uuid of the student, while
-- `student_id` on the students table is their college roll number.
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_date date not null default current_date,
  status text not null default 'present'
    check (status in ('present', 'absent', 'late')),
  scanned_at timestamptz not null default now(),
  unique (student_id, class_date)
);

-- Row Level Security is on by default for new tables.
-- The two policies below open both tables up completely, which is fine for a
-- demo. They are written as `for all` so that re-running the app's "update"
-- (upsert) calls is allowed. Tighten these up (and add auth) once you build
-- logins.
alter table public.students enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "Anyone can use students" on public.students;
create policy "Anyone can use students"
  on public.students
  for all
  using (true)
  with check (true);

drop policy if exists "Anyone can use attendance" on public.attendance;
create policy "Anyone can use attendance"
  on public.attendance
  for all
  using (true)
  with check (true);
