# Rifa diária

Sistema de rifa com ciclo de 22 horas, 1000 números e sorteio auditável.
Frontend em HTML puro (GitHub Pages), backend em Supabase.

## Como funciona o ciclo

| Horário | O que acontece |
|---|---|
| 18:59 | O sistema gera a chave secreta do ciclo e publica só a impressão dela |
| 19:00 | Abrem as vendas |
| 16:59 (dia seguinte) | Fecham as vendas e a lista de compras é congelada |
| 17:00 | O número é calculado a partir da chave + rodada drand + lista |
| 17:00 às 18:59 | O organizador valida e paga o ganhador |
| 19:00 | Novo ciclo. Se ninguém acertou, o prêmio acumula |

O número não é escolhido por ninguém. Ele nasce de três dados travados em
momentos diferentes, e qualquer pessoa refaz a conta em `verificar.html`.

## Estrutura

```
.
├── index.html                      grade de vendas (público)
├── verificar.html                  conferência do sorteio (público)
├── admin.html                      painel do organizador (login)
├── config.js                       credenciais do Supabase
└── supabase/
    ├── migrations/
    │   ├── 01_schema.sql           tabelas, RLS, RPCs de venda
    │   ├── 02_grade_publica.sql    leitura da grade, realtime, consulta
    │   └── 03_admin.sql            autenticação e RPCs do painel
    └── functions/sorteio/index.ts  automação do commit, fechamento e sorteio
```

---

## Instalação

### 1. Criar o projeto no Supabase

Em [supabase.com](https://supabase.com), crie um projeto novo e anote a região
(escolha `South America (São Paulo)` para reduzir latência).

Em **Project Settings → API**, copie:

- **Project URL** → vai no `config.js`
- **anon public** → vai no `config.js`
- **service_role** → **não** vai no `config.js`. Só é usada mais adiante, nos jobs.

### 2. Rodar as migrations

No **SQL Editor**, cole e execute na ordem, um de cada vez:

1. `supabase/migrations/01_schema.sql`
2. `supabase/migrations/02_grade_publica.sql`
3. `supabase/migrations/03_admin.sql`

Se algum der erro, pare e resolva antes de seguir — os arquivos dependem uns dos outros.

### 3. Configurar os parâmetros da rifa

Ainda no SQL Editor, ajuste os valores para a realidade do organizador:

```sql
update config set valor = '200'    where chave = 'preco_centavos';           -- R$ 2,00 por número
update config set valor = '80000'  where chave = 'premio_inicial_centavos';  -- R$ 800,00
update config set valor = '200000' where chave = 'premio_teto_centavos';     -- teto de R$ 2.000,00
update config set valor = '15'     where chave = 'reserva_minutos';
update config set valor = 'chave@pix.com.br' where chave = 'pix_chave';
update config set valor = 'Nome do Recebedor' where chave = 'pix_nome';
update config set valor = '5537999999999'     where chave = 'whatsapp';      -- só dígitos, com DDI
```

**Confira o chain hash do drand antes de ir ao ar.** Abra
`https://api.drand.sh/chains`, escolha a chain que vai usar e confirme:

```sql
select valor from config where chave = 'drand_chain';
```

O mesmo valor precisa estar na constante `CHAIN` no topo do script de
`verificar.html`. Se os dois divergirem, a página de conferência acusa erro
mesmo com o sorteio correto.

### 4. Criar a conta do organizador

Em **Authentication → Users → Add user**, crie o usuário com e-mail e senha.
Copie o UUID gerado e autorize a conta:

```sql
insert into admins (user_id, nome)
values ('cole-o-uuid-aqui', 'Nome do organizador');
```

Sem essa linha o login funciona, mas todas as operações retornam
`Acesso restrito`. Conta criada não é conta autorizada.

### 5. Publicar a Edge Function

Com a [CLI do Supabase](https://supabase.com/docs/guides/cli) instalada:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy sorteio
```

A função lê `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do ambiente, que o
Supabase injeta automaticamente. Não precisa configurar nada.

Teste antes de agendar:

```bash
curl -X POST https://SEU_PROJECT_REF.supabase.co/functions/v1/sorteio \
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"acao":"commit"}'
```

Deve responder com o número do ciclo, o prêmio e a rodada drand fixada.

### 6. Agendar os três jobs

Guarde a service key no Vault, para não deixá-la escrita em texto puro:

```sql
select vault.create_secret('SUA_SERVICE_ROLE_KEY', 'service_key');
```

Agende os jobs. **Os horários são em UTC** e o Brasil está em UTC-3:

```sql
select cron.schedule('rifa-commit', '59 21 * * *', $$
  select net.http_post(
    url := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/sorteio',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_key')),
    body := '{"acao":"commit"}'::jsonb)
$$);

select cron.schedule('rifa-fechar',  '59 19 * * *', $$ /* mesmo bloco, acao: fechar  */ $$);
select cron.schedule('rifa-sortear', '0 20 * * *',  $$ /* mesmo bloco, acao: sortear */ $$);
select cron.schedule('rifa-expirar', '* * * * *',   $$ select expirar_reservas() $$);
```

Equivalência dos horários:

| Ação | Horário de Brasília | Cron (UTC) |
|---|---|---|
| commit | 18:59 | `59 21 * * *` |
| fechar | 16:59 | `59 19 * * *` |
| sortear | 17:00 | `0 20 * * *` |

Confira o agendamento com `select * from cron.job;`.

### 7. Publicar no GitHub Pages

```bash
git init
git add .
git commit -m "Sistema de rifa diária"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

No repositório, vá em **Settings → Pages** e aponte a Source para a branch
`main`, pasta `/ (root)`. Em poucos minutos o site sobe em
`https://SEU_USUARIO.github.io/SEU_REPO/`.

Antes do primeiro push, preencha o `config.js` com a URL e a anon key.

---

## Operação do dia a dia

O organizador usa só o `admin.html`:

- **Durante as vendas** — confirma os PIX que chegam, estende reservas de quem
  avisou que já pagou, cancela as que travaram
- **A partir das 17h** — o bloco do topo mostra o número sorteado e o ganhador,
  com botão de WhatsApp e registro do pagamento do prêmio
- **Se ninguém acertou** — o mesmo bloco avisa que o prêmio acumulou

Reservas não pagas voltam sozinhas para a grade depois do prazo configurado.

---

## Cuidados

**Não mexa em venda paga depois das 16:59.** O `vendas_hash` é publicado no
fechamento e faz parte da prova. Estornar uma venda paga depois disso quebra a
verificação pública do ciclo.

**A matemática do acúmulo.** Com 1000 números a R$ 2,00, a receita máxima é
R$ 2.000 por ciclo. Como cada número é único, vender os 1000 garante um
ganhador — o prêmio só acumula quando sobra número. Dobrar o prêmio estoura o
caixa no segundo acúmulo, por isso o padrão é somar 50% das vendas do ciclo,
com teto. O modo fica em `config.acumulo_modo` (`percentual` ou `dobrar`).

**Enquadramento legal.** Sorteio próprio com prêmio em dinheiro e periodicidade
diária depende de autorização da SECAP/Ministério da Fazenda. O sistema torna a
operação rastreável e auditável, o que é bom para a confiança de quem compra,
mas também a torna visível. Vale consultar um advogado antes de publicar.

**A anon key é pública, a service_role não.** A primeira vai no `config.js` e
está protegida por RLS. A segunda dá acesso irrestrito ao banco e só existe
dentro do Supabase.
