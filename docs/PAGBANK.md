# Cobrança com PagBank Pessoa Física

O produto oferece 30 dias gratuitos a partir do cadastro, plano mensal de **R$ 35** e plano anual de **R$ 350 em uma cobrança por ano**. O período gratuito é controlado pelo servidor; o pagamento só fica disponível depois de seus 30 dias completos.

## O que a conta CPF permite

A [documentação atual de pagamentos recorrentes do PagBank](https://developer.pagbank.com.br/docs/pagamentos-recorrentes) informa que contas Pessoa Física devem usar **Link de Pagamento Recorrente**. A API de recorrência exige conta Pessoa Jurídica aprovada no onboarding do produto.

O link permite ao PagBank cobrar automaticamente o cartão do assinante na frequência escolhida. Isso **não equivale à liberação ou renovação automática da conta neste sistema**: o fluxo CPF por link não fornece aqui uma integração autenticada para consultar cada pagamento. Até uma integração elegível ser implementada, é necessário conferir os pagamentos no PagBank e registrar o período de acesso pela área administrativa ou pelo comando de assinatura. O sistema nunca concede acesso por clique no link, retorno do navegador, e-mail enviado pelo cliente ou notificação não verificada.

## Criar os dois links

Use sua conta PagBank no computador. Conforme a [ajuda oficial sobre criação de planos](https://faq.pagbank.com.br/duvida/como-criar-um-plano-de-pagamento-recorrente/119):

1. Acesse **Venda online / Vendas → Link de Pagamento → Criar novo link**.
2. Crie **Sistema de Demandas — Mensal**, valor **R$ 35,00**, e habilite **Cobrança recorrente** com frequência **Mensal**.
3. Crie **Sistema de Demandas — Anual**, valor **R$ 350,00**, com frequência **Anual**. Não configure doze parcelas mensais.
4. Escolha recorrência contínua, se deseja renovação até cancelamento, e copie os links gerados. Confira o valor e a frequência na página de pagamento antes de divulgá-los.

O [guia atual de Checkout](https://developer.pagbank.com.br/docs/checkout) informa que a primeira cobrança acontece ao concluir o pagamento. Esta implementação, portanto, não apresenta contratação durante o teste e não depende de um trial configurado no PagBank. Não acrescente outros 30 dias gratuitos no link, pois o teste já é concedido pelo aplicativo.

## Configuração do servidor

Links públicos conferidos no checkout em 31/10/2026:

| Plano | Valor e recorrência | Link |
| --- | --- | --- |
| Mensal | R$ 35,00, cobrança mensal contínua no cartão | https://pag.ae/82ixDFWsJ |
| Anual | R$ 350,00, cobrança anual contínua no cartão | https://pag.ae/82ixDhLCJ |

Os dois links estão configurados no `.env.local` do projeto, com a conexão do Neon preservada. Na implantação, configure as mesmas variáveis no serviço Railway; o arquivo local não é enviado ao servidor. Nenhuma compra foi concluída durante a conferência.

Defina no ambiente de hospedagem, ou no `.env` local ignorado pelo Git:

```dotenv
PAGBANK_LINK_MENSAL=https://pag.ae/SEU_LINK_MENSAL
PAGBANK_LINK_ANUAL=https://pag.ae/SEU_LINK_ANUAL
```

Substitua pelos links reais; os exemplos não criam planos. Não é necessário token ou senha bancária para esse fluxo. Nunca envie credenciais bancárias pelo chat ou ao navegador.

São aceitos links HTTPS nos hosts exatos `pag.ae`, `pagamento.pagbank.com.br` e `pagseguro.uol.com.br`, sem usuário/senha, porta não padrão ou fragmento. URLs inválidas ficam indisponíveis. O aplicativo não consegue verificar o preço contido no link sem a API: essa conferência no painel é responsabilidade do operador.

## Endpoints implementados

- `GET /cobranca/status`: exige sessão e informa a disponibilidade dos links, o modo `link_recorrente` e `confirmacao_automatica: false`. Não expõe credenciais.
- `POST /cobranca/checkout` com `{"plano":"mensal"}` ou `{"plano":"anual"}`: exige sessão e acesso expirado; retorna a URL previamente configurada. Retorna `409` durante o teste ou uma assinatura ativa, `400` para plano inválido e `503` se o link não estiver configurado.

Essas rotas de contratação pertencem ao profissional. A conta administrativa não contrata assinatura pessoal.

Na versão administrativa em preparação para publicação:

- `GET /admin/pessoas` e `GET /admin/pessoas/:id`: listam profissionais e seus períodos de acesso, com histórico de ativações no detalhe; não expõem as demandas.
- `POST /admin/pessoas/:id/assinatura` com `{"plano":"mensal","referencia":"ID_PAGAMENTO"}`: registra o pagamento já conferido, usando o valor definido pelo servidor. A mesma referência para a mesma pessoa e plano não acrescenta outro período; reutilização para outra pessoa ou plano é recusada.
- `PATCH /admin/pessoas/:id/acesso` com `{"bloqueado":true}` ou `false`: bloqueia ou desbloqueia o uso das demandas, preservando a conta e os registros. Não cancela a cobrança recorrente.

Todas as rotas `/admin` exigem sessão de administrador autorizada pelo servidor. O cadastro público nunca cria esse papel. A promoção depende do operador e do comando documentado em [Neon e Railway](DEPLOY.md).

O cliente escolhe apenas o identificador do plano, nunca o valor ou a URL de destino. O cliente deve usar no pagamento o e-mail de sua conta; o operador ainda precisa confirmar a identidade e a transação no painel antes de conceder acesso.

## Operação e próxima etapa

Confira a assinatura e o pagamento no [Painel de Recorrência](https://assinaturas.pagbank.com.br/login). Cancelamentos e alterações da cobrança são feitos nesse painel; sair da conta no aplicativo não cancela o pagamento recorrente.

Depois de conferir no PagBank o pagamento aprovado, seu valor, o plano e a identidade correta, abra **Pessoas assinantes → Gerenciar → Registrar pagamento conferido**. Selecione mensal de R$ 35 ou anual de R$ 350, informe a referência da transação e marque que a conferência foi realizada.

**Registrar o pagamento no sistema não cobra o cartão:** apenas concede ou renova o período de acesso e registra o histórico. Não utilize a operação como substituto da aprovação real no PagBank. A nova interface administrativa ainda está em publicação neste registro.

Como alternativa administrativa, execute no servidor:

```powershell
node scripts/ativar-assinatura.js --email EMAIL_DA_CONTA --plano mensal --referencia ID_DO_PAGAMENTO --confirmar
```

Use `--plano anual` para o pagamento anual de R$ 350. A referência deve ser o identificador único da transação efetivamente paga; o mesmo pagamento não pode liberar dois períodos. Cada renovação exige a conferência da nova transação e sua referência própria. O registro preserva o teste gratuito e o tempo de acesso já existente; não corta dias já disponíveis. O comando permanece restrito ao operador do servidor; a interface equivalente é exclusiva de administradores autorizados e não é uma ação pública do profissional.

Para automatizar também a liberação e a renovação do acesso, será necessário obter a elegibilidade de integração oferecida pelo PagBank para conta PJ e implementar conciliação de pagamentos e notificações autenticadas. A [documentação de autenticidade de notificações](https://developer.pagbank.com.br/reference/validacao-de-autenticidade) exige conferir a assinatura sobre o corpo original antes de atualizar recursos. Essa etapa não foi simulada no fluxo CPF.

Documentação consultada em 31/10/2026. Nenhuma conta, plano real ou cobrança foi criado por esta implementação.
