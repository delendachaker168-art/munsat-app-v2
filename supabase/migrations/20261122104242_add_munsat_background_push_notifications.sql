create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null default 'android' check (platform in ('android','ios')),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

alter table public.device_push_tokens enable row level security;
grant select, insert, update, delete on public.device_push_tokens to authenticated;

drop policy if exists device_push_tokens_select_own on public.device_push_tokens;
create policy device_push_tokens_select_own on public.device_push_tokens
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists device_push_tokens_insert_own on public.device_push_tokens;
create policy device_push_tokens_insert_own on public.device_push_tokens
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists device_push_tokens_update_own on public.device_push_tokens;
create policy device_push_tokens_update_own on public.device_push_tokens
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists device_push_tokens_delete_own on public.device_push_tokens;
create policy device_push_tokens_delete_own on public.device_push_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.dispatch_munsat_voice_push()
returns trigger
language plpgsql
security definer
set search_path = public, net, pg_catalog
as $function$
declare
  sender_uuid uuid;
  slot_no smallint;
  device record;
  slot_words text[] := array['واحد', 'اثنين', 'ثلاثة', 'أربعة', 'خمسة'];
begin
  if new.type <> 'new_voice_message' or new.message_id is null then
    return new;
  end if;

  select vm.sender_id
    into sender_uuid
    from public.voice_messages vm
   where vm.id = new.message_id
     and vm.recipient_id = new.user_id;

  if sender_uuid is null then
    return new;
  end if;

  select vs.slot_number
    into slot_no
    from public.voice_slots vs
   where vs.owner_id = new.user_id
     and vs.friend_id = sender_uuid
   order by vs.slot_number
   limit 1;

  if slot_no is null or slot_no < 1 or slot_no > 5 then
    return new;
  end if;

  for device in
    select d.expo_push_token
      from public.device_push_tokens d
     where d.user_id = new.user_id
  loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := jsonb_build_object(
        'to', device.expo_push_token,
        'sound', 'default',
        'title', 'منصت',
        'body', 'رسالة من ' || slot_words[slot_no],
        'priority', 'high',
        'channelId', 'voice-messages',
        'ttl', 259200,
        'data', jsonb_build_object(
          'type', 'new_voice_message',
          'messageId', new.message_id,
          'slotNumber', slot_no
        )
      ),
      params := '{}'::jsonb,
      headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  end loop;

  return new;
end;
$function$;

drop trigger if exists dispatch_munsat_voice_push on public.notifications;
create trigger dispatch_munsat_voice_push
  after insert on public.notifications
  for each row execute function public.dispatch_munsat_voice_push();
