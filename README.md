# Sistema de Demandas — SaaS individual

Cada pessoa cria uma conta e acessa somente suas demandas. O cadastro inicia **30 dias gratuitos**, contados no servidor. Os planos são **R$ 35 por mês** ou **R$ 350 por ano em uma única cobrança anual**.

## Executar

Requer Node.js 22 a 24 e PostgreSQL. A interface usa **React, TypeScript, Vite, Sass e Lucide**, seguindo a base visual do PetCore. A API mantém Node.js, Express e PostgreSQL. Os campos e as regras das demandas permanecem os mesmos.

Instale as dependências com `npm ci`, configure o ambiente usando `.env.example` como referência e execute `npm run dev`. A interface abre em `http://localhost:5173`, com a API na porta 4000. `npm run build` verifica os tipos e gera `web/dist`, servido por `npm start` em produção.

A configuração local dá prioridade a `.env.local`, depois `.env`, preservando as variáveis já definidas no ambiente. A conexão do novo Neon foi salva apenas em `.env.local`, ignorado pelo Git; o `.env` anterior foi preservado. Veja [Neon e Railway](docs/DEPLOY.md).

O sistema cria e atualiza as tabelas ao primeiro acesso à API que depende do banco. Faça backup antes de publicar essa versão sobre um banco existente. Nenhum comando administrativo é executado automaticamente.

Na hospedagem com HTTPS, configure `NODE_ENV=production` para cookies seguros. Configure `TRUST_PROXY_HOPS` de acordo com a quantidade real de proxies confiáveis da hospedagem; isso determina o endereço usado pelo limite de tentativas de login. `DATABASE_SSL=false` destina-se ao PostgreSQL local; o Neon usa conexão TLS verificada.

## Acesso e pagamento

1. A pessoa se cadastra com nome, e-mail e senha, sem informar cartão para iniciar o teste.
2. Durante 30 dias completos, usa o sistema gratuitamente.
3. Ao terminar o acesso, suas demandas continuam salvas e o sistema oferece os planos configurados.
4. O botão de assinatura leva ao **PagBank**, onde a pessoa informa o cartão e autoriza a recorrência mensal ou anual. O aplicativo não coleta nem armazena dados do cartão.
5. O responsável confere cada pagamento no painel PagBank e registra o período pago. A cobrança recorrente é feita pelo PagBank; a liberação e cada renovação de acesso neste fluxo CPF exigem conferência administrativa.

Consulte [a configuração dos links e as limitações da conta CPF](docs/PAGBANK.md). Os botões de contratação permanecem indisponíveis enquanto os links reais não estiverem configurados. O retorno da página de pagamento nunca ativa uma assinatura.

Após verificar no painel o pagamento efetivamente aprovado, sua identificação, o valor e o período, registre uma referência única da transação:

```text
node scripts/ativar-assinatura.js --email pessoa@exemplo.com --plano mensal --referencia ID_PAGAMENTO --confirmar
```

Para o anual, use `--plano anual`. O acesso é prorrogado em um mês ou ano de calendário, preservando o período de acesso que já existir. Repetir a mesma referência não concede outro período. O comando exige acesso administrativo ao servidor e deve usar o banco correto; ele não consulta o PagBank nem substitui a conferência.

## Demandas anteriores à versão SaaS

As demandas existentes são preservadas sem dono e ficam invisíveis às novas contas até a atribuição explícita ao titular correto. Nenhum cadastro público recebe esses dados automaticamente.

Cadastre a conta de destino e revise a quantidade de registros antes de atribuí-los:

```text
node scripts/atribuir-legado.js --email titular@exemplo.com
node scripts/atribuir-legado.js --email titular@exemplo.com --confirmar --quantidade QUANTIDADE_REVISADA
```

Esse procedimento atribui **todos** os registros sem dono à conta indicada. Se o legado pertencer a várias pessoas, separe os registros antes de utilizar esse comando. As antigas chaves de `localStorage` do navegador foram preservadas, mas a importação automática foi removida para evitar enviar registros à conta errada.

## Verificação

`npm test` usa o executor de testes do Node e inicia um PostgreSQL temporário, isolado do banco do aplicativo, para validar autenticação, isolamento entre contas, vencimento do teste e ativação administrativa. Não carrega o `.env` do projeto. O PostgreSQL temporário é encerrado ao final.

No Windows, o caminho padrão dos binários é `C:\Program Files\PostgreSQL\18\bin`. Em outra instalação, configure `POSTGRES_BIN`; em outros sistemas, os executáveis podem estar no `PATH`.

## Android

O aplicativo Android continua com **Capacitor** e usa a mesma conta individual, com sessão nativa para seus alertas. `npm run android:sync` compila a interface em `web/dist` e sincroniza o projeto Android. A abertura nativa usa fundo branco, inclusive no modo escuro.

É necessário publicar o novo servidor e gerar uma nova versão do APK para disponibilizar essas mudanças. A API Android usa `VITE_API_BASE_URL` quando configurado, com o endereço atual do Railway como padrão. O APK anterior não consegue consultar a API protegida sem a nova autenticação.

Esta entrega prepara a base local de contas e assinaturas. Os links reais, a publicação do servidor, a atribuição do legado e a distribuição do novo APK são etapas de operação; nenhuma cobrança ou alteração no PagBank foi executada durante o desenvolvimento.
