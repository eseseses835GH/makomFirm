// Public Supabase settings. Both values are safe to commit: the anon /
// publishable key only grants what Row Level Security allows (read-only for
// visitors). NEVER put the service-role / secret key here.
//
// Supabase Dashboard -> Project Settings -> API (or "API Keys"):
export const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR-ANON-OR-PUBLISHABLE-KEY';

// Logging in with username "dana" signs in the Supabase user
// "dana@tagidmaze.com". Must match the email you created in the dashboard.
export const USERNAME_EMAIL_DOMAIN = 'tagidmaze.com';

export const COVER_BUCKET = 'book-covers';
