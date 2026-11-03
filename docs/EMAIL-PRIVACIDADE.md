# E-mail transacional e privacidade

A fonte atual inclui recuperação de senha para profissionais e administradores, confirmação de cancelamento por e-mail e uma área de direitos de privacidade. O provedor de envio é o Resend. Em 01/11/2026, esta versão foi publicada no Railway e o responsável confirmou o recebimento do único e-mail real de redefinição autorizado para a verificação. O cancelamento e sua fila foram validados em banco temporário, com transporte simulado; nenhum pagamento ou cancelamento real foi executado nos testes.

## Remetente e ambiente

Use o domínio **tigertech.dev.br**. O remetente previsto é `Tiger Tech <nao-responda@tigertech.dev.br>`; suporte e respostas usam **tigertechbr@outlook.com**.

Configure no ambiente do servidor:

```dotenv
RESEND_API_KEY=
RESEND_FROM=Tiger Tech <nao-responda@tigertech.dev.br>
APP_URL=https://sistema-demandas-production.up.railway.app/
```

Preencha `RESEND_API_KEY` pelo gerenciador de segredos da hospedagem ou por arquivo local ignorado pelo Git. A chave pertence ao servidor: não use prefixo `VITE_`, não a coloque no APK, em arquivos versionados, capturas de tela, exemplos ou logs. O valor de `RESEND_FROM` deve corresponder a um remetente autorizado na conta Resend.

`APP_URL` é a URL pública confiável usada nos links enviados. Ela vem do ambiente do servidor, sem usar cabeçalhos, campos ou parâmetros enviados pelo navegador. Em produção, o validador exige HTTPS e recusa credenciais, query string e fragmento. HTTP só é aceito em desenvolvimento para `localhost`, `127.0.0.1` ou `::1`. Confira a URL antes de habilitar os envios.

No Resend, adicione `tigertech.dev.br` e publique no provedor DNS os registros exatos apresentados para esse domínio. Aguarde o estado de verificação de envio; a documentação de [verificação de domínio](https://resend.com/changelog/domain-verification-events) explica a validação dos registros. Não invente valores SPF/DKIM nem considere que o domínio está pronto apenas por existir uma variável de ambiente.

Recomenda-se desabilitar explicitamente **open tracking** e **click tracking** no domínio usado para mensagens de autenticação. O [rastreamento do Resend](https://resend.com/blog/open-and-click-tracking) pode inserir imagens ou reescrever links; isso é desnecessário para recuperação de senha e deve ser revisto para preservar a finalidade estritamente transacional. Esta recomendação não indica que a configuração da conta externa já tenha sido alterada.

## Recuperação de senha

A opção **Esqueci minha senha** está disponível no acesso comum a profissionais e administradores:

- `POST /auth/esqueci-senha`, com `{"email":"pessoa@exemplo.com"}`, recebe a solicitação quando o envio está configurado.
- A resposta utiliza a mesma mensagem para contas existentes e inexistentes, sem informar papel, existência da conta ou estado da assinatura.
- Sem configuração válida, o endpoint retorna `503` uniformemente, antes de consultar a existência da conta. Não informa que enviou uma mensagem fictícia.
- Existem limites de tentativas por IP e e-mail. O processamento de entrega ocorre em fila interna, com até duas tarefas simultâneas; a resposta HTTP não confirma que o provedor entregou a mensagem.

O link contém um token aleatório no fragmento da URL, no formato `#redefinir_senha=...`. Esse fragmento é lido pela interface e o token é enviado no corpo da solicitação de redefinição. O código armazena somente seu hash no banco, com validade de **30 minutos** e **uso único**. Não copie o token ou o link real para logs, tickets ou conversas.

`POST /auth/redefinir-senha` recebe `token` e `senha`. A senha deve ter de 10 a 128 caracteres. Uma redefinição válida atualiza o hash da senha, consome o token, inutiliza os demais links pendentes e revoga todas as sessões da conta, exigindo novo login. Papel, assinatura e demandas são preservados. Links expirados ou já usados são recusados.

Se o transporte de e-mail falhar, o serviço tenta invalidar o token emitido e registra apenas um código genérico de falha. Não há outbox persistente nem retentativa automática para esses links: após corrigir a configuração ou a entrega, a pessoa deve solicitar um novo link. Uma resposta genérica de solicitação não deve ser usada como prova de entrega.

## Confirmação de cancelamento e outbox

O pedido do profissional não cancela sozinho uma cobrança. O responsável deve efetivar o cancelamento no PagBank e, depois, confirmá-lo no painel da aplicação. Veja [PagBank](PAGBANK.md).

A confirmação grava o estado de cancelamento, a auditoria e o evento `cancelamento_confirmado` em `notificacoes_email` na mesma transação. O conteúdo informa a confirmação, o fim do acesso já disponibilizado, o endereço da aplicação e o contato de suporte. A chave única evita duplicar o evento quando a mesma confirmação é repetida.

O worker iniciado por `npm start` consulta a fila periodicamente, com intervalo padrão de 30 segundos. Ele reserva lotes de até dez mensagens e faz até duas entregas simultâneas. Cada evento utiliza uma chave de idempotência estável no envio ao Resend.

Os estados locais são:

| Estado | Significado |
| --- | --- |
| `pendente` | Aguardando configuração ou próxima tentativa. |
| `processando` | Reservado por um worker para tentativa de envio. |
| `enviado` | A API de envio aceitou a mensagem; não comprova recebimento ou leitura na caixa do usuário. |
| `falhou` | Atingiu o limite de tentativas e exige avaliação operacional. |

A reserva expira para permitir recuperação após interrupção do processo. Falhas de transporte recebem espera progressiva; há no máximo **seis tentativas** por evento. Sem configuração válida, a fila fica pendente e não consome tentativas. Depois de configurar corretamente o provedor, o worker pode processar essas pendências. Uma mensagem marcada como `falhou` não é retomada automaticamente por apenas reiniciar o servidor.

A resposta administrativa `email_confirmacao: "pendente"` indica que a mensagem ainda não está marcada como enviada. A confirmação do cancelamento é persistida mesmo quando falta configuração de e-mail, e a mensagem continua aguardando envio. Nenhum desses estados executa uma chamada de cancelamento no PagBank.

## Acompanhamento operacional sem expor conteúdo

Um operador autorizado pode conferir quantidades no banco correto, por uma conexão administrativa já protegida:

```sql
SELECT status, COUNT(*) AS quantidade, MIN(criado_em) AS mais_antiga
FROM notificacoes_email
GROUP BY status
ORDER BY status;

SELECT erro_codigo, COUNT(*) AS quantidade
FROM notificacoes_email
WHERE status = 'falhou'
GROUP BY erro_codigo
ORDER BY erro_codigo;
```

Essas consultas exibem somente totais, estados e datas. Para investigar falhas, confira configuração, verificação do domínio e o painel do provedor com acesso restrito. Não registre destinatários, assunto, corpo da mensagem, links de recuperação ou chaves em logs de diagnóstico. A aplicação também não repassa o corpo de erro retornado pelo Resend ao cliente.

O código não oferece um botão público de reenvio ou um procedimento automático de reabertura de falhas esgotadas. Antes de qualquer reprocessamento administrativo, confira se o envio anterior foi aceito, o motivo da falha e a possibilidade de duplicidade. Não crie outra confirmação de cancelamento apenas para tentar contornar o estado da fila.

## Política, termos e aceite

`GET /privacidade/politica` é público e fornece a versão `2026-11-03`, a marca responsável **Tiger Tech**, contato, política e termos. O cadastro exige o aceite explícito da versão apresentada; contas antigas registram ciência pelo `POST /privacidade/aceite`, com `{"versao":"2026-11-03"}`. A aplicação guarda versão e horário do aceite.

O aceite tem finalidade contratual e de transparência; não representa consentimento irrestrito para todo tratamento. A política descreve dados de conta e demandas, fornecedores Railway, Neon, Resend e PagBank, possibilidade de processamento internacional, sessão essencial, finalidades e canais de direitos. Não há integração de publicidade ou análise de audiência no aplicativo; as configurações externas de rastreamento do provedor de e-mail precisam ser conferidas conforme a orientação acima.

O responsável informou e autorizou a publicação do nome **José Andrey Pereira Lisboa**, junto da marca **Tiger Tech** e do contato público. Esses dados constam na política e nos termos. Obrigações legais, bases de tratamento, conservação e efetivo atendimento aos titulares dependem também da operação do serviço; estes recursos não representam certificação, aprovação da ANPD nem garantia de conformidade jurídica integral.

## Exportação e solicitações do titular

A conta autenticada pode utilizar os recursos de privacidade mesmo com assinatura expirada, acesso profissional bloqueado ou aceite de documentos desatualizado. Sem acesso à conta, o titular pode escrever para `tigertechbr@outlook.com`.

| Recurso | Finalidade |
| --- | --- |
| `GET /privacidade/dados` | Exporta perfil explícito, demandas do próprio profissional, ativações e solicitações próprias, sem hashes de senha ou tokens. Administradores não recebem demandas de terceiros nesse arquivo. |
| `GET /privacidade/solicitacoes` | Lista somente os pedidos da própria conta e suas respostas. |
| `POST /privacidade/solicitacoes` | Registra `acesso`, `correcao`, `exclusao` ou `outro`, com descrição de 10 a 2.000 caracteres. |
| `DELETE /privacidade/conta` | Com `{"confirmar":true}`, apaga imediatamente a própria conta profissional e seus dados do banco ativo, inclusive demandas na lixeira e todas as sessões. Sem confirmação, retorna `400`; administrador recebe `403`. |
| `GET /admin/privacidade` | Permite ao administrador ativo consultar a fila, com nome e e-mail do solicitante. |
| `POST /admin/privacidade/:id/resposta` | Registra resposta de 10 a 4.000 caracteres e a identidade administrativa na auditoria. |

Uma solicitação pendente do mesmo tipo impede outra igual; o serviço também limita a dez novos pedidos nas últimas 24 horas por conta. Nesses casos, é possível acompanhar o pedido existente ou usar o contato de suporte. As respostas aparecem na área Privacidade; não há envio automático de resposta de direitos por e-mail.

O download no navegador é um JSON; no Android a interface também permite consultar e copiar o conteúdo. O arquivo pode conter dados de beneficiários inseridos pelo profissional e deve ser protegido por quem o exporta. A exportação da conta não substitui a análise de pedidos específicos de terceiros nem uma resposta completa sobre todas as operações realizadas por fornecedores.

## Atendimento efetivo e conservação

**Registrar uma resposta não corrige, anonimiza, bloqueia nem apaga dados automaticamente.** O estado `respondida` registra que houve uma resposta administrativa, não que toda providência solicitada foi executada. Cancelar uma assinatura e encerrar seu período de acesso também não exclui os registros.

O botão **Excluir cadastro**, em Minha conta e Privacidade, abre uma confirmação simples e executa a exclusão definitiva diretamente, sem enviar pedido para análise. A transação apaga dados próprios, inclusive demandas ativas e na lixeira, ativações, solicitações, notificações, sessões e links de recuperação. Também remove os limites de autenticação específicos do e-mail, preservando limites compartilhados por IP. Uma falha reverte todas as alterações. A confirmação encerra o acesso imediatamente, mesmo havendo período pago restante. A autoexclusão direta atende somente profissionais; pedidos de contas administrativas continuam pelo atendimento.

A exclusão não cancela a recorrência no PagBank nem executa estorno. O modal apresenta essa informação e permite acessar a gestão da assinatura antes de excluir. Hashes de referências de pagamentos já consumidos são preservados em `referencias_pagamento_excluidas`, sem vínculo com usuário, nome ou e-mail, impedindo reutilização pelo painel e pela CLI. Mensagens já enviadas, registros dos fornecedores e cópias de segurança não são apagados por essa operação. O formulário de solicitações continua separado para atendimento dos demais pedidos; registrar uma resposta não executa uma alteração automaticamente.

Nos dados inseridos em demandas, o profissional ou a organização que representa define a finalidade e a base legal como controlador; a plataforma atua como operadora quando processa esses registros em seu nome. Para cadastro, autenticação, assinatura e administração da própria plataforma, a Tiger Tech define o tratamento correspondente.

A [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm) e as [orientações da ANPD](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes) fundamentam a revisão desses procedimentos. A política publicada deve continuar alinhada às operações reais, à identificação completa do responsável e aos contratos e configurações dos fornecedores.
