-- Users table (handled by Supabase Auth)

-- People table
create table people (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  role text,
  relationship_type text not null, -- 'direct_report', 'manager', 'stakeholder', 'peer'
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Messages table
create table messages (
  id uuid default gen_random_uuid() primary key,
  person_id text not null, -- Changed from uuid to text to allow 'general'
  content text not null,
  is_user boolean not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS policies
alter table people enable row level security;
alter table messages enable row level security;

-- Policies
create policy "Users can view their own people" on people
  for select using (auth.uid() = user_id);

create policy "Users can insert their own people" on people
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own people" on people
  for update using (auth.uid() = user_id);

create policy "Users can delete their own people" on people
  for delete using (auth.uid() = user_id);

create policy "Users can view messages for their people" on messages
  for select using (
    person_id = 'general' OR
    exists (
      select 1 from people 
      where people.id::text = messages.person_id 
      and people.user_id = auth.uid()
    )
  );

create policy "Users can insert messages for their people" on messages
  for insert with check (
    person_id = 'general' OR
    exists (
      select 1 from people 
      where people.id::text = messages.person_id 
      and people.user_id = auth.uid()
    )
  );

