-- El monitor solo puede ver las fotos de progreso de un socio si este las comparte (member_details.shares_photos).
create policy "staff reads shared photos" on storage.objects for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and private.manages(((storage.foldername(name))[1])::uuid)
    and exists (
      select 1 from public.member_details d
      where d.member_id = ((storage.foldername(name))[1])::uuid and d.shares_photos
    )
  );
