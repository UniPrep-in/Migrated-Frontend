alter table public.profiles
  add column if not exists plan_id text,
  add column if not exists payment_status text,
  add column if not exists purchased_at timestamptz,
  add column if not exists razorpay_payment_id text,
  add column if not exists razorpay_order_id text;

create table if not exists public.payment_config (
  key text primary key,
  value_number numeric,
  updated_at timestamptz not null default now()
);

alter table public.payment_config enable row level security;

insert into public.payment_config (key, value_number)
values ('single_mock_price_paise', 900)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
