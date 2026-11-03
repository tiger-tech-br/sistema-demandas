# Sistema de Demandas — SaaS individual

Cada profissional cria uma conta e acessa somente suas demandas. No primeiro acesso, a tela apresenta três opções: **Free por 30 dias**, **Mensal de R$ 35,00** e **Anual de R$ 350,00 em uma cobrança por ano**. A administração da plataforma usa uma área separada de **Pessoas assinantes**.

## Executar

Requer Node.js 22 a 24 e PostgreSQL. A interface usa React, TypeScript, Vite, Sass e Lucide; a API usa Node.js, Express e PostgreSQL.

Instale as dependências com `npm ci`, configure o ambiente usando `.env.example` como referência e execute `npm run dev`. A interface abre em `http://localhost:5173`, com a API na porta 4000. `npm run build` verifica os tipos e gera `web/dist`, servido por `npm start` em produção.

A configuração local dá prioridade a `.env.local`, depois `.env`, preservando variáveis já definidas no ambiente. Os arquivos locais com credenciais são ignorados pelo Git e não configuram automaticamente a hospedagem. Veja [Neon e Railway](docs/DEPLOY.md).

O sistema cria e atualiza as tabelas ao primeiro acesso à API que depende do banco. `npm run db:migrate` permite executar a migração explicitamente. Faça backup antes de aplicar uma versão sobre um banco existente. Comandos administrativos não são executados automaticamente.

Na hospedagem com HTTPS, use `NODE_ENV=production` para cookies seguros e ajuste `TRUST_PROXY_HOPS` à quantidade real de proxies confiáveis. `DATABASE_SSL=false` destina-se ao PostgreSQL local. A conexão do banco e as chaves de serviço ficam exclusivamente no servidor.

## Primeiro acesso e períodos de acesso

O cadastro profissional inicia um único teste de **720 horas a partir do horário registrado no servidor**. Escolher o card Free não reinicia o prazo e não solicita cartão. Mensal e Anual podem ser escolhidos já no primeiro acesso ou durante o teste; o usuário é avisado de que a primeira cobrança ocorre ao concluir o pagamento no PagBank.

O teste local não é transferido para o gateway nem reiniciado ao clicar em um plano. A escolha de um card e o retorno da página de pagamento não confirmam uma assinatura. Depois de conferir o pagamento, o administrador registra o período pago, preservando o tempo de acesso que já existir.

Ao terminar o acesso gratuito ou pago, o servidor bloqueia as operações de demandas e a interface oferece a contratação elegível. A conta e os dados permanecem salvos; informações da conta e recursos de privacidade continuam disponíveis. Uma assinatura recorrente já registrada, ainda sem cancelamento confirmado, impede abrir outra contratação mesmo que o período local esteja expirado: é necessário conferir a renovação ou concluir o cancelamento anterior para evitar cobranças paralelas.

## Profissional e administrador

O cadastro público cria sempre um profissional. Não existe escolha de papel no formulário nem privilégio automático por e-mail ou ordem de cadastro.

O profissional gerencia suas demandas e sua assinatura. O administrador consulta pessoas, planos e períodos de acesso, registra pagamentos conferidos, confirma cancelamentos, bloqueia ou desbloqueia acesso e responde solicitações de privacidade. Seu painel não oferece operações nem listagem geral de demandas. Administradores não contratam assinatura pessoal.

Um operador autorizado do servidor pode promover uma conta existente sem demandas:

```text
node scripts/promover-administrador.js --email pessoa@exemplo.com --confirmar
```

Confirme a identidade e o banco de destino antes de executar. A promoção preserva a senha, revoga as sessões e exige novo login. Ela não cria conta nem transfere demandas.

## Lixeira de demandas

O botão **Excluir** move a demanda para a lixeira, após confirmação. Ela sai da lista principal, dos totais e dos lembretes, mantendo seus dados para restauração. Em **Lixeira**, **Restaurar** devolve a demanda à lista original.

Em **Minhas demandas**, marcar **Selecionar todas** habilita **Excluir tudo**. A confirmação informa que todos os registros da lista principal serão movidos para a lixeira, inclusive os concluídos e os que não aparecem nos filtros aplicados. Essa operação não apaga os registros definitivamente.

**Esvaziar lixeira** pede uma nova confirmação e apaga definitivamente somente as demandas excluídas da própria conta. Demandas ativas e registros de outras contas são preservados. Não há limpeza automática por prazo. A exportação da área Privacidade inclui os registros que ainda estão na lixeira e sua data de exclusão.

O painel do cliente usa fontes maiores e adapta a lista e as ações para telas de celular. Login e administração mantêm sua apresentação própria.

## Gratuidade permanente autorizada

O card Free oferece o teste de 30 dias. Uma gratuidade permanente é uma concessão operacional separada, registrada por comando privilegiado e auditada com um administrador existente e ativo:

```text
node scripts/conceder-acesso-permanente.js --email pessoa@exemplo.com --administrador admin@exemplo.com --confirmar
```

A pessoa deve possuir uma conta profissional. Se houver assinatura paga registrada, seu cancelamento no PagBank e a confirmação no sistema devem ser concluídos antes da concessão. O comando não cancela cobranças no gateway. A gratuidade mantém os dados e a senha, elimina a exigência de contratação e não dispensa o aceite dos termos nem reverte um bloqueio administrativo.

## Pagamentos e cancelamento

A cobrança recorrente ocorre no PagBank. **A ativação e cada renovação de acesso ainda dependem de conferência administrativa do pagamento.** A aplicação não recebe dados do cartão e não libera acesso por retorno do navegador. Configure os links reais conforme [PagBank](docs/PAGBANK.md).

Após conferir titular, valor, plano e aprovação no gateway, use **Pessoas assinantes → Gerenciar → Registrar pagamento conferido** e informe a referência única da transação. Registrar o pagamento concede acesso, sem efetuar uma cobrança. Como alternativa no servidor:

```text
node scripts/ativar-assinatura.js --email pessoa@exemplo.com --plano mensal --referencia ID_PAGAMENTO --confirmar
```

Use `--plano anual` para o anual. Cada referência só pode conceder um período. O registro soma um mês ou ano de calendário ao período de acesso preservado.

O profissional pode pedir cancelamento na área de assinatura, também acessível pelo atalho **Cancelar assinatura** em **Minha conta**. O responsável precisa cancelar a recorrência no PagBank e confirmar essa ação no painel administrativo. A confirmação mantém o acesso até seu vencimento e grava uma mensagem transacional na fila de e-mail; o worker tenta enviá-la automaticamente pelo Resend quando configurado. Enviar o pedido, bloquear o acesso ou sair da conta não interrompe a cobrança no gateway.

Após um cancelamento confirmado, voltar a assinar exige nova contratação e pagamento conferido. O administrador deve confirmar `nova_assinatura: true`; a CLI usa `--nova-assinatura`. Isso remove o estado de cancelamento anterior somente no registro dessa nova contratação. Veja os detalhes e os cuidados contra duplicidade em [PagBank](docs/PAGBANK.md).

## E-mail e privacidade

A recuperação de senha atende profissionais e administradores. Links valem 30 minutos, têm uso único e a redefinição revoga todas as sessões da conta. Sem configuração válida de e-mail, o endpoint informa indisponibilidade, sem simular envio.

O domínio de envio é **tigertech.dev.br**, com remetente `Tiger Tech <nao-responda@tigertech.dev.br>` e contato `tigertechbr@outlook.com`. Em 01/11/2026, as variáveis de produção foram configuradas e o recebimento de um e-mail real de recuperação foi confirmado pelo responsável. Consulte [E-mail e privacidade](docs/EMAIL-PRIVACIDADE.md).

Termos e política de privacidade possuem versão e aceite registrado. A área Privacidade permite exportar dados da própria conta e registrar pedidos de acesso, correção, exclusão ou outro direito. Ela permanece acessível à conta autenticada mesmo com assinatura expirada ou acesso profissional bloqueado. As respostas administrativas registram a análise e não executam correção nem exclusão automaticamente.

**Excluir cadastro**, em **Minha conta** e **Privacidade**, abre um único modal de confirmação. Se não houver cobrança a encerrar, apaga definitivamente os dados próprios do banco ativo e encerra o acesso. Se houver assinatura sem cancelamento confirmado ou contratação iniciada pelo aplicativo ainda em conferência, registra a exclusão pendente e o pedido de cancelamento, preservando a conta, as sessões e os dados até a conferência no PagBank. Uma assinatura expirada localmente continua exigindo essa conferência.

O administrador encontra o filtro **Exclusão pendente** em **Pessoas assinantes**. Primeiro encerra a recorrência no PagBank ou confere que a contratação não gerou cobrança ativa; depois registra a referência e a confirmação no sistema. Se houver pedido de exclusão, essa confirmação apaga automaticamente a conta na mesma transação, sem exigir outro clique do cliente. Novas contratações e ativações ficam bloqueadas enquanto a exclusão estiver pendente. Sem pedido de exclusão, cancelar a assinatura continua preservando o acesso pelo período pago.

A remoção apaga demandas ativas e na lixeira, sessões, links de recuperação, solicitações, ativações e notificações da própria conta. Uma falha reverte a operação inteira e preserva dados alheios. Contas administrativas continuam usando o atendimento de privacidade. Somente hashes das referências de pagamento consumidas permanecem, sem nome, e-mail ou vínculo com a conta. O aplicativo não envia uma ordem automática de cancelamento nem executa estorno no PagBank; a conferência do responsável é indispensável. A exclusão do banco ativo não elimina cópias de segurança, e-mails já enviados nem registros dos fornecedores. Contratações por links usados fora do aplicativo podem exigir identificação manual pelo responsável.

## Demandas anteriores à versão SaaS

As 23 demandas legadas já foram associadas ao titular confirmado. O cadastro público nunca recebe dados antigos automaticamente; não repita essa associação.

Para uma futura importação de outros registros sem dono, revise o destino e a quantidade antes de usar:

```text
node scripts/atribuir-legado.js --email titular@exemplo.com
node scripts/atribuir-legado.js --email titular@exemplo.com --confirmar --quantidade QUANTIDADE_REVISADA
```

O procedimento atribui todos os registros sem dono à conta indicada. Se pertencerem a várias pessoas, separe-os antes. A importação automática do antigo armazenamento do navegador foi removida.

## Verificação, publicação e Android

`npm test` usa o executor do Node e PostgreSQL temporário separado do banco da aplicação, sem carregar o `.env` do projeto. A suíte cobre autenticação, isolamento, perfis, acesso, cobrança, recuperação e privacidade. No Windows, o caminho padrão dos binários é `C:\Program Files\PostgreSQL\18\bin`; em outra instalação, configure `POSTGRES_BIN`, ou disponibilize os executáveis no `PATH`.

Estado validado em 03/11/2026: site publicado no commit `e784a920a655a3b688e4ff8f03e46f8c01924f4f`, implantação Railway `ea11d197-244d-4909-b733-56cb45bdba2c` com sucesso. Os assets publicados correspondem por SHA-256 ao build local e ao APK 1.7. Os **39 testes** passaram em PostgreSQL temporário, incluindo espera pelo encerramento da cobrança, exclusão após a confirmação administrativa, checkout sem ativação registrada, recontratação após cancelamento, bloqueios durante a espera e rollback, além dos cenários anteriores. A política pública retorna `2026-11-03.1`; as rotas privadas recusaram acesso sem sessão. Nenhuma exclusão foi executada em conta real na conferência de publicação. O QA do Chrome em 320, 390 e 1366 px registrado no histórico corresponde à versão anterior de 01/11/2026.

O APK release **1.7**, código **9**, foi compilado, assinado e conferido com as ferramentas do Android Studio, incluindo assinatura, alinhamento, pacote, bloqueios de backup e HTTP e igualdade dos oito assets web. Ele usa a mesma assinatura das versões anteriores e permite atualização sem desinstalação. Arquivo: `SistemaDemandas-v1.7.apk`; SHA-256: `4E8F6400A2AAA0FDA12B95210BEC48700157335035FF8B46804FEE8D6278B58F`. O teste desta versão em dispositivo Android ainda está pendente. Veja [a entrega Android e sua chave de assinatura](docs/ANDROID-RELEASE.md) e [o registro de publicação](docs/DEPLOY.md).

O Android usa Capacitor e a mesma conta individual. `npm run android:sync` compila a interface e sincroniza o projeto Android. `VITE_API_BASE_URL`, quando definido na compilação, escolhe o endereço público da API. As variáveis `VITE_` são públicas: não inclua nelas conexão de banco ou chave Resend. A existência de um APK anterior não comprova a inclusão desses novos fluxos nem teste em dispositivo físico.
