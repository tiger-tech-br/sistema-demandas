# Neon e implantação existente no Railway

## Estado da operação em 31/10/2026

**Publicação inicial e migração encerradas.** A verificação HTTP inicial passou, as 23 demandas foram conferidas e o bloqueio temporário da origem anterior foi removido. Atualizações de manutenção seguem na mesma branch; confira o commit e a implantação ativos no Railway para identificar a versão que está atendendo o domínio.

- Fonte da publicação inicial enviada ao repositório na branch `codex/saas-demandas`, commit `ce6ddfaa20ea1a2c693d6b38b29840b8b2807052`.
- Publicação inicial no Railway: implantação `26289388-8c75-4e0b-8e59-28b113b1f2a4` com estado `SUCCESS`, usando esse commit. A implantação anterior, identificada por `5e70e9ec`, foi removida. Esses identificadores são históricos e não fixam qual é a última versão ativa.
- Na conferência da publicação inicial, o domínio entregou `index-BGw8FM-g.js`, o mesmo bundle incluído no APK daquele momento. A página de login/cadastro com oferta de 30 dias foi observada no navegador de produção, sem envio de formulário nessa verificação.
- **23 demandas legadas** copiadas para o Neon e conferidas, todas com `usuario_id = NULL`. Resumo de conferência: `0a3bd697a799fbef3d597148d0c4bb9636ad730ba9987983bb3e0a1c5dab7915`.
- Conferência final: 23 demandas na origem e 23 no destino, com o mesmo resumo de conteúdo; 23 registros sem dono e nenhum usuário criado no destino. Nenhuma conexão da aplicação anterior foi observada durante essa conferência.
- O bloqueio temporário da origem foi removido e a operação de migração encerrou com sucesso. Não mantenha o banco anterior recebendo gravações como segundo banco do sistema.
- APK da publicação inicial: versão **1.3**, `versionCode 4`, gerado em `SistemaDemandas-v1.3.apk`, com compilação e assinatura verificadas. Uma nova compilação de manutenção está sendo preparada com os mesmos números de versão; sua conclusão não está confirmada neste registro. Não foi realizado teste em dispositivo Android físico.

### Manutenção posterior à publicação inicial

Estão em preparação atualizações das dependências Capacitor Android/Core/CLI para `8.4.3`, `body-parser` para `2.4` e `proxy-addr` para `2.0.8`, com nova rodada de testes e nova compilação do APK. Este registro não confirma que essas correções já tenham sido publicadas nem que o novo APK esteja concluído. A manutenção utiliza a mesma branch `codex/saas-demandas` e não prevê uma nova migração de banco.

### Destino Neon

- Projeto Neon: `sistema-demandas`, ID `long-boat-14054777`, região AWS São Paulo.
- Banco: `sistema_demandas`, branch `main` (`br-wandering-cell-b6avr6tf`).
- Tabelas criadas: usuários, sessões, demandas, limites de autenticação e histórico de ativações.
- Conexão configurada em `.env.local`, ignorado pelo Git, com TLS `verify-full`.
- Nenhum dado fictício foi inserido nesse banco. Os testes usam PostgreSQL temporário separado.
- A configuração e o banco anteriores foram preservados para conferência e recuperação. Credenciais, conexões privadas e cópias de segurança não devem ser incluídas nesta documentação ou no Git.

O serviço existente é **sistema-demandas** no Railway, projeto **charming-commitment**, ambiente **production**. O endereço permanece [sistema-demandas-production.up.railway.app](https://sistema-demandas-production.up.railway.app). O repositório é `tiger-tech-br/sistema-demandas`; a origem anterior acompanhava `master`, enquanto a fonte SaaS foi enviada à branch indicada acima. Confira o commit efetivamente implantado no Railway.

### Registros legados e primeira conta

O sistema anterior não tinha usuários. As 23 demandas devem permanecer com `usuario_id = NULL`: ficam preservadas e invisíveis aos cadastros públicos. Nenhum primeiro cadastro assume esses dados automaticamente.

O titular precisa criar uma **nova conta** na versão SaaS. A associação do legado fica para uma operação administrativa posterior, quando o e-mail correto e a quantidade de registros tiverem sido confirmados. Não execute a atribuição durante a migração sem essa identificação.

## Procedimento e verificações da troca

1. Faça backup do PostgreSQL atual do Railway e revise a quantidade de demandas existentes.
2. Copie os registros existentes para o Neon com os mesmos campos e identificadores, preservando datas e conclusões. O destino deve ser revisado para evitar duplicação. Guarde o banco anterior até confirmar a migração.
3. Preserve o legado sem dono durante a troca. Depois da publicação validada, peça o novo cadastro do titular e confirme seu e-mail antes de programar a associação. O comando `scripts/atribuir-legado.js` atribui **todos os registros sem dono** e exige revisão da quantidade; não o utilize para um legado de várias pessoas sem separar os registros antes.
4. Configure `DATABASE_URL` do serviço existente com a conexão Neon. Use o valor privado obtido no painel ou na configuração local, sem incluí-lo no Git ou no aplicativo Android. `.env.local` não é enviado para a hospedagem.
5. Mantenha `NODE_ENV=production` e configure `TRUST_PROXY_HOPS` de acordo com o proxy confiável da implantação. Para a configuração com um proxy, use `1`. O endereço da aplicação é o mesmo domínio Railway, com HTTPS; `APP_URL` pode registrar esse endereço na configuração operacional.
6. Configure `PAGBANK_LINK_MENSAL` e `PAGBANK_LINK_ANUAL` somente com os dois links recorrentes reais conferidos no painel, conforme [a operação de pagamentos](PAGBANK.md). A liberação do acesso continua dependendo de conferência administrativa.
7. O Railway deve executar `npm run build` e depois `npm start`; `railway.json` declara esses comandos.
8. Confira a conclusão do deploy, a página inicial e os assets. O healthcheck `/` verifica a entrega da interface; sozinho não confirma a conexão com o banco.
9. Valide cadastro/login, sessão no HTTPS, isolamento entre contas, criação e conclusão de demanda, aviso de vencimento e assinatura. Confira as 23 demandas no destino administrativo sem atribuí-las a uma conta de teste.
10. Distribua o novo APK somente depois de validar a API compatível. Preserve o banco anterior e a cópia de segurança até encerrar a conferência. Se a troca for abandonada, avalie a reversão e a liberação da origem antes de permitir novas gravações; não mantenha dois bancos recebendo alterações sem conciliação.

### Encerramento da publicação inicial

- [x] Confirmar implantação ativa no domínio e commit esperado.
- [x] Conferir as 23 demandas copiadas e o proprietário nulo preservado.
- [x] Conferir a tela de acesso em produção e o bundle compatível com o APK 1.3.
- [x] Encerrar a verificação HTTP final.
- [x] Confirmar a liberação controlada da origem anterior após a conferência de leitura.

Resultados observados na conferência da publicação inicial:

- Página inicial e assets React: HTTP `200`.
- `GET /planos`: HTTP `200`, teste de 30 dias, mensal de 3.500 centavos e anual de 35.000 centavos.
- `GET /auth/me` e `GET /demandas` sem sessão: HTTP `401`, conforme esperado.
- Login com credenciais inválidas: HTTP `401`, confirmando o atendimento da rota com acesso ao banco, sem criar usuários.
- Migração encerrada com código de saída `0`; liberação da origem confirmada e arquivo de controle temporário ausente.

Não resta pendência operacional da publicação inicial ou da migração. A manutenção posterior tem seu próprio ciclo de verificação e publicação; confirme no Railway o commit ativo após cada atualização. O novo cadastro/e-mail do titular e a associação administrativa do legado permanecem uma etapa futura, separada da cópia já concluída. A conferência do APK inicial registrada aqui é de compilação e assinatura; não representa teste em dispositivo.

## Android

O projeto Capacitor utiliza `web/dist`. Execute `npm run android:sync` antes de compilar no Android Studio. Para apontar o APK para outro endereço de API, defina `VITE_API_BASE_URL` no ambiente de compilação e mantenha o endpoint de alertas nativo alinhado.

As URLs e variáveis `VITE_` são públicas no pacote web. A conexão PostgreSQL, credenciais bancárias e senhas ficam exclusivamente no servidor.
