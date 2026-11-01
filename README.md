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

O profissional pode pedir cancelamento na área de assinatura. O responsável precisa cancelar a recorrência no PagBank e confirmar essa ação no painel administrativo. A confirmação mantém o acesso até seu vencimento e grava uma mensagem transacional na fila de e-mail; o worker tenta enviá-la automaticamente pelo Resend quando configurado. Enviar o pedido, bloquear o acesso ou sair da conta não interrompe a cobrança no gateway.

Após um cancelamento confirmado, voltar a assinar exige nova contratação e pagamento conferido. O administrador deve confirmar `nova_assinatura: true`; a CLI usa `--nova-assinatura`. Isso remove o estado de cancelamento anterior somente no registro dessa nova contratação. Veja os detalhes e os cuidados contra duplicidade em [PagBank](docs/PAGBANK.md).

## E-mail e privacidade

A recuperação de senha atende profissionais e administradores. Links valem 30 minutos, têm uso único e a redefinição revoga todas as sessões da conta. Sem configuração válida de e-mail, o endpoint informa indisponibilidade, sem simular envio.

O domínio de envio previsto é **tigertech.dev.br**, com remetente `Tiger Tech <nao-responda@tigertech.dev.br>` e contato `tigertechbr@outlook.com`. É necessário verificar o domínio no Resend e configurar `RESEND_API_KEY`, `RESEND_FROM` e `APP_URL` no servidor. O código e a documentação não comprovam que DNS ou envio de produção já estejam prontos. Consulte [E-mail e privacidade](docs/EMAIL-PRIVACIDADE.md).

Termos e política de privacidade possuem versão e aceite registrado. A área Privacidade permite exportar dados da própria conta e registrar pedidos de acesso, correção, exclusão ou outro direito. Ela permanece acessível à conta autenticada mesmo com assinatura expirada ou acesso profissional bloqueado. As respostas administrativas registram a análise: **não executam exclusão nem correção automaticamente**. O atendimento efetivo exige revisão das obrigações de conservação, das cópias de segurança e comunicação das providências ao titular.

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

Último estado operacional informado: a versão administrativa anterior estava ativa no Railway no commit de prefixo `434a`. Os novos fluxos descritos nesta fonte estão em integração e validação; a publicação deles e de um APK correspondente precisa ser conferida separadamente. O documento [Neon e Railway](docs/DEPLOY.md) contém registros históricos da implantação e da migração.

O Android usa Capacitor e a mesma conta individual. `npm run android:sync` compila a interface e sincroniza o projeto Android. `VITE_API_BASE_URL`, quando definido na compilação, escolhe o endereço público da API. As variáveis `VITE_` são públicas: não inclua nelas conexão de banco ou chave Resend. A existência de um APK anterior não comprova a inclusão desses novos fluxos nem teste em dispositivo físico.
