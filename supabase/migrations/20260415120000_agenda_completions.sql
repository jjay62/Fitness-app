create table if not exists public.agenda_completions (
  user_id uuid not null references auth.users (id) on delete cascade,
  ymd text not null,
  status text not null check (status in ('done', 'skipped')),
  updated_at timestamptz not null default now(),
  primary key (user_id, ymd)
);

create index if not exists agenda_completions_user_id_idx on public.agenda_completions (user_id);

alter table public.agenda_completions enable row level security;

create policy "Users read own agenda completions"
  on public.agenda_completions
  for select
  using (auth.uid() = user_id);

create policy "Users insert own agenda completions"
  on public.agenda_completions
  for insert
  with check (auth.uid() = user_id);

create policy "Users update own agenda completions"
  on public.agenda_completions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own agenda completions"
  on public.agenda_completions
  for delete
  using (auth.uid() = user_id);
