-- The signed-URL client is live on the production EAS channel.
-- Disable anonymous public reads for all new profile images.
update storage.buckets
set public = false
where id = 'profile-images';
