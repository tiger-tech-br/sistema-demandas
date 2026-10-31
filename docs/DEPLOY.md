# Neon e implantação existente no Railway

## Estado preparado

- Projeto Neon: `sistema-demandas`, ID `long-boat-14054777`, região AWS São Paulo.
- Banco: `sistema_demandas`, branch `main` (`br-wandering-cell-b6avr6tf`).
- Tabelas criadas: usuários, sessões, demandas, limites de autenticação e histórico de ativações.
- Conexão configurada em `.env.local`, ignorado pelo Git, com TLS `verify-full`.
- Nenhum dado fictício foi inserido nesse banco. Os testes usam PostgreSQL temporário separado.
- A configuração e o banco anteriores foram preservados. As demandas de produção ainda não foram copiadas para o Neon.

O serviço existente é **sistema-demandas** no Railway, projeto **charming-commitment**, ambiente **production**. Domínio verificado: https://sistema-demandas-production.up.railway.app . Ele acompanha o repositório `tiger-tech-br/sistema-demandas`, branch `master`.

Esta preparação não publicou a nova versão e não alterou variáveis do serviço remoto.

## Antes de trocar o banco em produção

1. Faça backup do PostgreSQL atual do Railway e revise a quantidade de demandas existentes.
2. Copie os registros existentes para o Neon com os mesmos campos e identificadores, preservando datas e conclusões. O destino deve ser revisado para evitar duplicação. Guarde o banco anterior até confirmar a migração.
3. Cadastre a conta do titular correto e atribua somente os registros que lhe pertencem. O comando `scripts/atribuir-legado.js` atribui **todos os registros sem dono** e exige revisão da quantidade; não o utilize para um legado de várias pessoas sem separar os registros antes.
4. Configure `DATABASE_URL` do serviço existente com a conexão Neon. Use o valor privado obtido no painel ou na configuração local, sem incluí-lo no Git ou no aplicativo Android. `.env.local` não é enviado para a hospedagem.
5. Mantenha `NODE_ENV=production` e configure `TRUST_PROXY_HOPS` de acordo com o proxy confiável da implantação. Para a configuração com um proxy, use `1`.
6. Configure `PAGBANK_LINK_MENSAL` e `PAGBANK_LINK_ANUAL` com os dois links reais conferidos no painel.
7. O Railway deve executar `npm run build` e depois `npm start`; `railway.json` declara esses comandos.
8. Confira login, conta individual, registros migrados, vencimentos e assinatura. Distribua o novo APK somente após publicar a API compatível.

## Android

O projeto Capacitor utiliza `web/dist`. Execute `npm run android:sync` antes de compilar no Android Studio. Para apontar o APK para outro endereço de API, defina `VITE_API_BASE_URL` no ambiente de compilação e mantenha o endpoint de alertas nativo alinhado.

As URLs e variáveis `VITE_` são públicas no pacote web. A conexão PostgreSQL, credenciais bancárias e senhas ficam exclusivamente no servidor.
