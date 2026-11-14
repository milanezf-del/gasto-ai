# Banco de Dados (Cloudflare D1)

Este diretório contém a definição das tabelas do **Gastô** para o **Cloudflare D1** (SQLite gerenciado).

## Como aplicar o `schema.sql` pelo painel do Cloudflare

1. Acesse o painel do **Cloudflare** (`dash.cloudflare.com`) e faça login na sua conta.
2. No menu lateral esquerdo, entre em **Workers & Pages** e clique em **D1 SQL Database** (ou **Storage & Databases > D1**).
3. Selecione o banco de dados criado para o projeto **Gastô** (ou clique em **Create** para criar um novo banco).
4. Dentro do banco escolhido, abra a aba **Console**.
5. Abra o arquivo `db/schema.sql` deste repositório, copie todo o conteúdo e cole na caixa de comandos SQL do Console.
6. Clique em **Execute** para rodar os comandos.

> **Dica:** Como todas as tabelas e índices usam `IF NOT EXISTS`, você pode rodar o script novamente com segurança sem apagar dados já salvos.

## Como conferir se deu certo

Ainda na aba **Console** do D1, execute o comando abaixo para listar todas as tabelas criadas:

```sql
SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;
```

Você deverá ver as 8 tabelas do sistema: `ai_usage`, `budgets`, `expenses`, `images`, `login_attempts`, `merchant_rules`, `sessions` e `users`.
