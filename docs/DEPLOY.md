# Neon e implantação existente no Railway

## Publicação validada em 03/11/2026

- Fonte em produção: `2d87f4fe6515fcafd01fa9229b9dc24f56180253`, branch `codex/saas-demandas`.
- Implantação Railway `b69fef62-cd49-44ae-b489-10e08b397420`: `SUCCESS`, no serviço e domínio existentes. A fonte está fixada nesse commit.
- Inclui **Excluir cadastro** em Minha conta e Privacidade, confirmação por modal, exclusão definitiva dos dados próprios do banco ativo e encerramento das sessões; inclui os atalhos de assinatura e o pedido de cancelamento mesmo com acesso profissional bloqueado.
- Os **34 testes** passaram em PostgreSQL temporário e a compilação web foi aprovada. A migração acrescenta somente a tabela de hashes das referências consumidas, sem remover dados existentes durante a publicação.
- Página e assets: HTTP `200`. O JavaScript `index-DnY7ixlX.js` e o CSS `index-WTZ9GHAS.css` publicados correspondem por SHA-256 ao build local.
- SHA-256 JavaScript: `e59ca40aca86e8183729fadc0616e7c3495fdab35add711bda6029643a5e23e2`; CSS: `77f047d296d399416c33537716705888526a78b65f8b628250ae1401d0c268d4`.
- A política pública retorna a versão `2026-11-03`. Sem autenticação, `GET /auth/me`, `GET /demandas`, `DELETE /privacidade/conta` e `POST /cobranca/cancelamento` retornam `401`. Nenhuma exclusão foi executada em conta real nesta conferência.
- O cancelamento da recorrência no PagBank continua dependendo da operação e confirmação do responsável. Excluir cadastro não cancela cobranças externas; o modal informa essa distinção.
- APK **1.6/code 8**: `SistemaDemandas-v1.6.apk`, **13.271.908 bytes**, SHA-256 `E50311EDDFB955FC0CE5FC0A29CD4432E9D72E3033B9F8A863445CB566CD617D`. Assinatura de produção igual à versão 1.5, alinhamento e oito assets web conferidos. A atualização permite instalação sobre a versão anterior; execução desta versão em aparelho ou emulador continua pendente.

O histórico abaixo registra versões anteriores. A entrega Android desta atualização é registrada separadamente em [ANDROID-RELEASE.md](ANDROID-RELEASE.md).

## Estado validado em 01/11/2026

- Fonte em produção: `2077f5ad584c7c6f3a4c9c9a9b31749cbc2ac77a`, branch `codex/saas-demandas`.
- Implantação Railway `e7880708-8376-4624-bcab-d9be3f4cf7ab`: `SUCCESS`. Acrescenta lixeira, exclusão individual, **Selecionar todas → Excluir tudo**, fontes maiores e ações espaçadas.
- Página, bundle `index-CQMr5ME8.js` e CSS `index-Q5nb2I0L.css`: HTTP 200; os dois assets correspondem por SHA-256 ao build local e ao pacote Android.
- A conferência de produção confirmou HTTP 401 na conta sem sessão válida e na lixeira sem autenticação. A migração aditiva criou o timestamp da lixeira sem marcar ou apagar demandas existentes. Nenhuma conta, demanda fictícia ou solicitação de e-mail foi criada nessa conferência.
- A leitura do Neon confirmou as 23 demandas do titular, nenhuma na lixeira, com o mesmo resumo de conteúdo anterior à publicação e a gratuidade permanente preservada. A administração continua em perfil separado.
- **30 testes passaram** em PostgreSQL temporário, cobrindo isolamento, restauração, esvaziamento seletivo e exclusão de todas as demandas próprias, além dos fluxos de acesso, cobrança e privacidade. A regressão da corrida entre login e redefinição também passou. As dependências não foram alteradas nesta versão.
- QA do navegador com dados sintéticos passou em 320, 390 e 1366 px: navegação lateral e móvel, botões individuais, seleção de todas, confirmações, cancelamento, restauração, esvaziamento, erro, carregamento e limites de largura. O navegador e o servidor de teste foram encerrados; os dados e artefatos locais foram descartados.
- APK release **1.5/code 7** gerado com ferramentas do Android Studio e a mesma chave de produção, com assinatura, manifesto e oito assets verificados. **Execução desta versão em dispositivo Android ainda pendente**; a entrega completa não está encerrada. Metadados e preservação da chave em [ANDROID-RELEASE.md](ANDROID-RELEASE.md).

As seções seguintes são o histórico da migração e das publicações anteriores. Os estados intermediários nelas não substituem o registro acima. Não repetir a migração ou a associação do legado.

## Estado da operação em 31/10/2026

**Publicação inicial e migração encerradas; versão administrativa em publicação.** As 23 demandas foram conferidas e associadas ao titular confirmado, e o bloqueio temporário da origem anterior foi removido. Confira o commit e a implantação ativos no Railway: os identificadores históricos abaixo não confirmam a publicação da nova área administrativa.

- Fonte da publicação inicial enviada ao repositório na branch `codex/saas-demandas`, commit `ce6ddfaa20ea1a2c693d6b38b29840b8b2807052`.
- Publicação inicial no Railway: implantação `26289388-8c75-4e0b-8e59-28b113b1f2a4` com estado `SUCCESS`, usando esse commit. A implantação anterior, identificada por `5e70e9ec`, foi removida. Esses identificadores são históricos e não fixam qual é a última versão ativa.
- Na conferência da publicação inicial, o domínio entregou `index-BGw8FM-g.js`, o mesmo bundle incluído no APK daquele momento. A página de login/cadastro com oferta de 30 dias foi observada no navegador de produção, sem envio de formulário nessa verificação.
- **23 demandas legadas** copiadas para o Neon, inicialmente sem dono. Resumo da conferência da cópia inicial: `0a3bd697a799fbef3d597148d0c4bb9636ad730ba9987983bb3e0a1c5dab7915`.
- Na conferência da cópia inicial havia 23 demandas na origem e 23 no destino, com o mesmo resumo de conteúdo, ainda sem usuários ou proprietário no destino. Nenhuma conexão da aplicação anterior foi observada naquela etapa.
- A associação posterior das 23 demandas ao titular correto já foi executada, após confirmação, e conferida por SQL e resumo de conteúdo. Não registrar nome, e-mail real ou credenciais do titular nesta documentação.
- O bloqueio temporário da origem foi removido e a operação de migração encerrou com sucesso. Não mantenha o banco anterior recebendo gravações como segundo banco do sistema.
- APK da publicação inicial: versão **1.3**, `versionCode 4`, gerado em `SistemaDemandas-v1.3.apk`, com compilação e assinatura verificadas. Uma nova compilação de manutenção está sendo preparada com os mesmos números de versão; sua conclusão não está confirmada neste registro. Não foi realizado teste em dispositivo Android físico.

### Manutenção posterior à publicação inicial

O commit `6e687e7` registra a atualização de Capacitor Android/Core/CLI para `8.4.3`, `body-parser` para `2.4` e `proxy-addr` para `2.0.8`. Ele e a publicação inicial são versões anteriores à nova área administrativa. Confira a implantação ativa no Railway para conhecer a fonte efetivamente publicada.

### Versão administrativa em andamento

A fonte atual acrescenta os papéis `profissional` e `admin`, a área **Pessoas assinantes**, controle de períodos pagos após conferência e bloqueio/desbloqueio de acesso, com os dados preservados. O cadastro público sempre cria um profissional; ser o primeiro cadastro ou usar determinado e-mail não concede administração.

As verificações locais passaram em **14 de 14 testes** e **26 de 26 verificações de sintaxe**. A publicação desta versão, das fontes maiores e do APK final ainda está em andamento; este registro não declara essas etapas concluídas. A mesma branch `codex/saas-demandas` é utilizada. Não repetir a cópia ou a atribuição das demandas legadas já concluída.

### Destino Neon

- Projeto Neon: `sistema-demandas`, ID `long-boat-14054777`, região AWS São Paulo.
- Banco: `sistema_demandas`, branch `main` (`br-wandering-cell-b6avr6tf`).
- Tabelas criadas: usuários, sessões, demandas, limites de autenticação e histórico de ativações.
- Conexão configurada em `.env.local`, ignorado pelo Git, com TLS `verify-full`.
- Nenhum dado fictício foi inserido nesse banco. Os testes usam PostgreSQL temporário separado.
- A configuração e o banco anteriores foram preservados para conferência e recuperação. Credenciais, conexões privadas e cópias de segurança não devem ser incluídas nesta documentação ou no Git.

O serviço existente é **sistema-demandas** no Railway, projeto **charming-commitment**, ambiente **production**. O endereço permanece [sistema-demandas-production.up.railway.app](https://sistema-demandas-production.up.railway.app). O repositório é `tiger-tech-br/sistema-demandas`; a origem anterior acompanhava `master`, enquanto a fonte SaaS foi enviada à branch indicada acima. Confira o commit efetivamente implantado no Railway.

### Registros legados já associados

O sistema anterior não tinha usuários. Por isso a cópia inicial preservou as demandas com `usuario_id = NULL`, sem permitir que o primeiro cadastro recebesse esses dados.

Depois do cadastro e da identificação confirmada do titular correto, os 23 registros foram associados explicitamente e conferidos. Essa operação está encerrada; não a repita nem altere a titularidade para uma conta administrativa ou de teste.

### Preparar o administrador da plataforma

O administrador não precisa contratar uma assinatura pessoal e não possui acesso às operações de demandas. Ele gerencia os profissionais cadastrados, seus planos, períodos pagos e bloqueios. As permissões são validadas pelo servidor.

Um operador autorizado pode promover uma conta existente que possua **zero demandas**:

```text
node scripts/promover-administrador.js --email pessoa@exemplo.com --confirmar
```

Confirme a identidade da conta e o banco correto antes de executar. A promoção preserva a senha e revoga as sessões, exigindo novo login com a mesma senha. O comando não cria conta, não muda a senha e não transfere dados. A conta do titular das demandas deve continuar como profissional.

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

Não resta pendência operacional da publicação inicial, da cópia ou da associação do legado. A versão administrativa tem seu próprio ciclo de publicação e verificação, ainda em andamento; confirme no Railway o commit ativo após a atualização. A conferência do APK inicial registrada aqui é de compilação e assinatura; não representa teste em dispositivo.

## Android

O projeto Capacitor utiliza `web/dist`. Execute `npm run android:sync` antes de compilar no Android Studio. Para apontar o APK para outro endereço de API, defina `VITE_API_BASE_URL` no ambiente de compilação e mantenha o endpoint de alertas nativo alinhado.

As URLs e variáveis `VITE_` são públicas no pacote web. A conexão PostgreSQL, credenciais bancárias e senhas ficam exclusivamente no servidor.
