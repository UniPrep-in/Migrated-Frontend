create table if not exists public.guidance_requests (
  id uuid not null default gen_random_uuid(),
  name text not null,
  phone text not null,
  consent_given boolean not null,
  user_id uuid null,
  submission_count integer not null default 1,
  status text not null default 'new',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint guidance_requests_pkey primary key (id),
  constraint guidance_requests_phone_key unique (phone),
  constraint guidance_requests_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null,
  constraint guidance_requests_name_check check (char_length(btrim(name)) between 2 and 80),
  constraint guidance_requests_phone_check check (phone ~ '^[6-9][0-9]{9}$'),
  constraint guidance_requests_consent_check check (consent_given = true),
  constraint guidance_requests_status_check check (
    status = any (array['new'::text, 'contacted'::text, 'closed'::text])
  )
);

create index if not exists guidance_requests_updated_at_idx
  on public.guidance_requests using btree (updated_at desc);

-- RLS on with no anon/authenticated write policies: the public can only write
-- through submit_guidance_request() below, and can never read the table.
alter table public.guidance_requests enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guidance_requests'
      and policyname = 'Admins can view guidance requests'
  ) then
    create policy "Admins can view guidance requests"
    on public.guidance_requests
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.is_admin = true
      )
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guidance_requests'
      and policyname = 'Admins can update guidance requests'
  ) then
    create policy "Admins can update guidance requests"
    on public.guidance_requests
    for update
    to authenticated
    using (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.is_admin = true
      )
    )
    with check (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.is_admin = true
      )
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guidance_requests'
      and policyname = 'Admins can delete guidance requests'
  ) then
    create policy "Admins can delete guidance requests"
    on public.guidance_requests
    for delete
    to authenticated
    using (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.is_admin = true
      )
    );
  end if;
end
$$;

-- Public entry point. Same phone number => the existing row is updated with the
-- latest name, bumped submission_count and reset to 'new' so it's followed up again.
create or replace function public.submit_guidance_request(
  p_name text,
  p_phone text,
  p_consent boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
begin
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Please enter a valid name' using errcode = '22023';
  end if;

  if v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Please enter a valid 10-digit phone number' using errcode = '22023';
  end if;

  if p_consent is distinct from true then
    raise exception 'Consent is required' using errcode = '22023';
  end if;

  insert into public.guidance_requests (name, phone, consent_given, user_id)
  values (v_name, v_phone, true, auth.uid())
  on conflict (phone) do update
    set name = excluded.name,
        consent_given = true,
        user_id = coalesce(excluded.user_id, guidance_requests.user_id),
        submission_count = guidance_requests.submission_count + 1,
        status = 'new',
        updated_at = now();
end;
$$;

revoke all on function public.submit_guidance_request(text, text, boolean) from public;
grant execute on function public.submit_guidance_request(text, text, boolean) to anon, authenticated;
