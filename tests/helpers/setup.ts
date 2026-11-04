// Ensure tests never depend on real credentials or external services.
process.env.NEXT_PUBLIC_SITE_URL = "https://health.vibesec.test";
delete process.env.RESEND_API_KEY;
delete process.env.TURNSTILE_SECRET_KEY;
delete process.env.UPSTASH_REDIS_REST_URL;
