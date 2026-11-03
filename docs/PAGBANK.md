# Cobrança recorrente com PagBank

O primeiro acesso oferece três cards: **Free por 30 dias**, **Mensal de R$ 35,00** e **Anual de R$ 350,00 em uma cobrança por ano**. É possível contratar um plano pago imediatamente, inclusive durante o teste. O aplicativo informa que a primeira cobrança acontece ao concluir o pagamento no gateway; escolher o plano não agenda a cobrança para depois dos 30 dias.

O teste é local, começa no cadastro e não reinicia com a escolha de um card. Não acrescente outro período gratuito ao link do PagBank sem revisar a oferta e a operação inteira. O registro de um pagamento aprovado preserva o tempo de acesso já disponível e acrescenta um mês ou ano de calendário.

## Modalidade utilizada

Este projeto utiliza Link de Pagamento Recorrente. A [documentação oficial de recorrência](https://developer.pagbank.com.br/docs/pagamentos-recorrentes) orienta clientes Pessoa Física a utilizar esses links; a API exige Pessoa Jurídica aprovada no onboarding.

O PagBank realiza as cobranças recorrentes. O aplicativo continua sem conciliação automática de pagamentos: cada ativação ou renovação depende de conferência e registro pelo administrador. Clique, retorno do navegador, mensagem do cliente e notificação não autenticada não concedem acesso.

A [documentação de Checkout](https://developer.pagbank.com.br/docs/checkout) descreve a primeira cobrança na conclusão do pagamento e a criação da recorrência para cobranças futuras. O teste de 30 dias concedido pelo aplicativo não altera esse comportamento do gateway.

## Links e ambiente

Crie ou revise no painel os links mensal de R$ 35,00 e anual de R$ 350,00, com as respectivas frequências. O anual é uma cobrança por ano; não o configure como doze parcelas mensais. Consulte a [orientação oficial para links recorrentes](https://developer.pagbank.com.br/docs/pagamentos-recorrentes) e confira valores, frequência e continuidade antes de oferecer os links.

Links públicos registrados na conferência anterior de 31/10/2026:

| Plano | Valor e frequência | Link |
| --- | --- | --- |
| Mensal | R$ 35,00 por mês | [Checkout mensal](https://pag.ae/82ixDFWsJ) |
| Anual | R$ 350,00 por ano | [Checkout anual](https://pag.ae/82ixDhLCJ) |

Essa conferência histórica não substitui a revisão dos links no momento da operação. Nenhuma compra precisa ser realizada para conferir a configuração exibida.

Configure no ambiente do servidor:

```dotenv
PAGBANK_LINK_MENSAL=https://pag.ae/SEU_LINK_MENSAL
PAGBANK_LINK_ANUAL=https://pag.ae/SEU_LINK_ANUAL
```

Os exemplos não criam planos. Variáveis em `.env.local` são locais e não atualizam o Railway. O fluxo por link não exige token bancário no aplicativo; credenciais do painel não devem ser colocadas no navegador, no código ou em conversas.

O validador aceita somente HTTPS nos hosts exatos `pag.ae`, `pagamento.pagbank.com.br` e `pagseguro.uol.com.br`, com caminho de checkout e sem usuário, senha, porta ou fragmento. Link ausente ou inválido desabilita a contratação correspondente. A aplicação não consulta o preço do link: o operador deve conferir o valor no painel.

## Operação do profissional

- `GET /cobranca/status` informa links disponíveis, `confirmacao_automatica: false` e `pode_assinar`, conforme o estado da conta.
- `POST /cobranca/boas-vindas`, com `{"escolha":"teste"}`, `mensal` ou `anual`, registra que a apresentação inicial foi vista. Não altera o teste nem confirma pagamento.
- `POST /cobranca/checkout`, com `{"plano":"mensal"}` ou `{"plano":"anual"}`, retorna um link configurado quando a contratação é elegível. Um profissional em teste pode contratar. Plano inválido retorna `400`; link indisponível, `503`.
- `POST /cobranca/cancelamento` registra o pedido e mantém seu estado pendente até a confirmação administrativa. Repetir o pedido preserva o mesmo cancelamento.

Essas rotas exigem autenticação profissional. Administradores não contratam plano pessoal; contas com gratuidade permanente também não precisam contratar.

Uma assinatura paga já registrada impede outra contratação enquanto seu cancelamento não estiver confirmado, mesmo com o período local expirado. O endpoint retorna `409` com `RENOVACAO_EM_CONFERENCIA`: o responsável deve conferir o pagamento da renovação ou resolver o cancelamento antes de permitir outra recorrência. A expiração local não comprova que o mandato de cobrança no PagBank acabou.

Ao expirar o teste ou o acesso pago, o servidor exige um novo período válido para operar demandas. Os dados e a conta permanecem, com os recursos de privacidade acessíveis. O fluxo não exclui demandas nem cancela cobranças por expiração.

## Conferir e registrar pagamento

Confira no [Painel de Recorrência](https://assinaturas.pagbank.com.br/login) a aprovação, o titular, o valor, o plano e a referência efetiva da transação. O pagador deve usar o e-mail da conta; isso ajuda a identificação, mas não substitui a conferência.

Em **Pessoas assinantes → Gerenciar → Registrar pagamento conferido**, selecione o plano e informe a referência única da transação. A API administrativa usa:

```json
{"plano":"mensal","referencia":"ID_PAGAMENTO"}
```

`POST /admin/pessoas/:id/assinatura` registra o período pago. O valor é determinado pelo servidor. A repetição da mesma referência para a mesma pessoa e plano não acrescenta outro período; outra pessoa ou plano não pode reutilizá-la. Cada renovação necessita de uma nova transação conferida e referência própria.

Como alternativa no servidor:

```text
node scripts/ativar-assinatura.js --email pessoa@exemplo.com --plano mensal --referencia ID_PAGAMENTO --confirmar
```

Use `--plano anual` para o anual. O comando não consulta o gateway. **Registrar um pagamento concede acesso e não efetua cobrança.**

## Cancelar a renovação e enviar a confirmação

1. O profissional registra o pedido na área de assinatura; o painel exibe cancelamento solicitado.
2. O responsável localiza a assinatura correta no PagBank, efetiva o cancelamento da recorrência e confere seu resultado.
3. Só então confirma no painel administrativo, informando uma referência e marcando que a ação no gateway foi conferida.
4. A aplicação registra a confirmação e uma mensagem na outbox na mesma transação. Um worker envia o e-mail automaticamente pelo Resend quando a configuração está válida.

A confirmação administrativa usa `POST /admin/pessoas/:id/cancelamento`:

```json
{"referencia":"ID_CANCELAMENTO","confirmado_no_pagbank":true}
```

O acesso existente é mantido até o vencimento. Uma repetição com a mesma referência não cria outro evento de e-mail; uma referência diferente após a confirmação é recusada. `email_confirmacao: "pendente"` informa a situação da fila, sem afirmar entrega. Retentativas e configuração estão em [E-mail e privacidade](EMAIL-PRIVACIDADE.md).

O pedido no aplicativo e a confirmação local não enviam uma ordem de cancelamento ao PagBank. A ação manual no gateway é indispensável. Sair da conta, bloquear acesso, expirar o período, conceder gratuidade ou excluir o cadastro também não interrompe a recorrência. O pedido de cancelamento continua disponível para profissionais autenticados mesmo com acesso bloqueado ou expirado. Cancelamento não exclui dados nem executa estorno.

**Excluir cadastro** depende do encerramento da cobrança. Se houver plano sem cancelamento confirmado ou contratação iniciada no aplicativo ainda em conferência, o botão registra os pedidos de exclusão e cancelamento e mantém a conta disponível. O administrador vê **Exclusão pendente**, encerra a recorrência no PagBank ou confere que ela não foi criada e registra a confirmação. Somente então a conta e seus dados são apagados automaticamente, na mesma transação. Sem cobrança pendente, a exclusão ocorre diretamente após o modal. O cliente não precisa confirmar novamente.

Antes de devolver o link de pagamento, o aplicativo registra a contratação iniciada. O marcador é removido ao conferir o pagamento ou o encerramento no PagBank; um cancelamento antigo não autoriza excluir após uma nova contratação. Enquanto houver exclusão pendente, o servidor impede novos checkouts e ativações pelo painel ou CLI. A expiração do acesso local não dispensa o encerramento da cobrança. Contratações iniciadas por links fora do aplicativo podem exigir identificação manual.

A aplicação continua sem enviar uma ordem de cancelamento ou estorno ao PagBank. A confirmação administrativa exige a conferência real do responsável. Ao excluir, referências de pagamentos consumidos ficam reservadas somente por hash, sem vínculo com o titular, e não podem conceder outro período pelo painel ou pela CLI. O cancelamento sem pedido de exclusão mantém o período de acesso e o envio de confirmação já existentes.

## Nova contratação após cancelamento

Depois do cancelamento confirmado, o profissional pode abrir nova contratação pelo aplicativo. Confira se o novo pagamento pertence à nova recorrência e se a anterior está encerrada. No registro administrativo, confirme expressamente:

```json
{"plano":"mensal","referencia":"ID_NOVO_PAGAMENTO","nova_assinatura":true}
```

A alternativa CLI acrescenta `--nova-assinatura`. Sem a confirmação, o registro depois de um cancelamento é recusado; a opção também é recusada se não houver cancelamento anterior confirmado. O registro válido limpa o estado de cancelamento e preserva o período de acesso já existente. Esse fluxo evita tratar uma renovação antiga como prova de uma nova contratação.

## Administração e gratuidade permanente

`GET /admin/pessoas` e `GET /admin/pessoas/:id` permitem consultar pessoas e histórico de ativações, sem listar suas demandas. `PATCH /admin/pessoas/:id/acesso` bloqueia ou desbloqueia acesso profissional e não cancela cobranças. Todas as rotas administrativas exigem um administrador ativo; o cadastro público nunca concede esse papel.

A gratuidade permanente é concedida somente pelo operador via `scripts/conceder-acesso-permanente.js`, com uma conta profissional e um administrador ativo existentes. Uma assinatura paga anterior precisa estar cancelada e confirmada antes. O comando está documentado no [README](../README.md); ele não opera o PagBank.

A versão administrativa anterior já possuía publicação ativa no último estado informado. A publicação dos novos fluxos de primeiro acesso, cancelamento, e-mail e privacidade deve ser conferida pelo commit efetivamente ativo; esta documentação descreve a fonte atual e não comprova um novo deploy.

Para automatizar a conciliação, será preciso uma integração elegível e validada, incluindo autenticação das notificações, antes de liberar acesso por eventos do gateway. Não há simulação dessa automação no fluxo atual. Documentação oficial de pagamentos consultada em 01/11/2026.
