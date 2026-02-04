create table if not exists tasks (
  id text primary key,
  title text not null,
  date date not null,
  notes text,
  completed boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists tasks_date_idx on tasks (date);
create index if not exists tasks_completed_idx on tasks (completed);
create index if not exists tasks_date_completed_idx on tasks (date, completed);

create table if not exists later (
  id text primary key,
  title text not null,
  notes text,
  created_at timestamptz default now()
);

-- Seed (optional)
-- insert into tasks (id, title, date, notes, completed) values
-- ('seed-1', 'Sample Task', current_date, null, false);
