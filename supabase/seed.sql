-- Seed: configuration defaults only. No leads, assessments or other personal data are seeded.
-- Run with: supabase db reset   (local)   or paste into the SQL editor (hosted).

update public.app_settings set
  business_name = 'VibeSec',
  services = '[
    {"slug":"application-security-audit","title":"Application security audit","description":"Manual review of your web application''s authentication, authorisation, data handling and business logic."},
    {"slug":"supabase-security-review","title":"Supabase database security review","description":"Review of your Supabase project configuration, exposed tables, storage buckets and edge functions."},
    {"slug":"rls-policy-review","title":"RLS policy review","description":"Line-by-line review of PostgreSQL Row Level Security policies to verify that users can only reach their own data."},
    {"slug":"api-security-assessment","title":"API security assessment","description":"Authorised testing of your API endpoints for authentication, authorisation and input-handling weaknesses."},
    {"slug":"auth-review","title":"Authentication and authorisation review","description":"Review of sign-up, login, session management, password reset and role-based access controls."},
    {"slug":"payment-security-review","title":"Payment security review","description":"Review of checkout flows, payment webhooks and subscription logic (Stripe and similar)."},
    {"slug":"vulnerability-remediation","title":"Vulnerability remediation","description":"Hands-on fixes for identified issues, with re-testing to confirm they are resolved."},
    {"slug":"production-hardening","title":"Production security hardening","description":"Security headers, secrets management, logging, rate limiting and deployment configuration."},
    {"slug":"security-maintenance","title":"Ongoing security maintenance","description":"Regular reviews and support as your application and team grow."}
  ]'::jsonb
where id = 1;

-- To grant admin access after creating a user in Supabase Auth (Dashboard → Authentication → Users):
-- update public.profiles set role = 'admin' where lower(email) = lower('you@yourcompany.com');
