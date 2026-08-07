// ============================================================
// Credenciais do projeto Supabase.
//
// Estes dois valores sao PUBLICOS por natureza. A anon key nao da
// acesso a nada sozinha: quem protege os dados sao as policies de RLS
// e as RPCs com verificacao de is_admin().
//
// NUNCA coloque a service_role key aqui. Ela ignora RLS e da acesso
// total ao banco. Ela vive apenas nas variaveis de ambiente da
// Edge Function, dentro do Supabase.
// ============================================================
window.RIFA_CONFIG = {
  SUPABASE_URL:  https://nlypguvfwgbhwlkkmmtb.supabase.co/rest/v1/
  SUPABASE_ANON: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5seXBndXZmd2diaHdsa2ttbXRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwNTkzNTUsImV4cCI6MjEwMTYzNTM1NX0.w5nQUSkPHyhmshpHITUqe0Gj8NcG-gMvso0-O9sgDG8
};
