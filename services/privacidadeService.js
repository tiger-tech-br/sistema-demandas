const dbPadrao = require("../config/db");
const inicializarBanco = require("../config/initDb");

const VERSAO_POLITICA = "2026-10-31";
const TIPOS_SOLICITACAO = new Set(["acesso", "correcao", "exclusao", "outro"]);
const CAMPOS_SOLICITACAO = "id, tipo, descricao, status, criado_em, resposta, respondido_em";
const CAMPOS_PERFIL = `id, nome, email, papel, criado_em, bloqueado_em,
    teste_iniciado_em, teste_expira_em, assinatura_plano, assinatura_expira_em,
    acesso_permanente, boas_vindas_em, cancelamento_solicitado_em,
    cancelamento_confirmado_em, cancelamento_referencia, termos_versao, termos_aceitos_em`;

// As finalidades abaixo descrevem os recursos deste aplicativo. As referencias
// oficiais fundamentam os direitos, sem representar certificacao pela ANPD.
const POLITICA = {
    versao: VERSAO_POLITICA,
    responsavel: "José Andrey Pereira Lisboa — Tiger Tech",
    contato: "tigertechbr@outlook.com",
    privacidade: [
        {
            titulo: "Responsável e contato",
            texto: "José Andrey Pereira Lisboa é o responsável pelo Sistema de Demandas, sob a marca Tiger Tech. Para questões de privacidade, informações sobre o responsável, reclamações e exercício de direitos, use tigertechbr@outlook.com ou a área Privacidade da sua conta. Este canal também atende quem não possui conta."
        },
        {
            titulo: "Quem decide sobre os dados",
            texto: "A Tiger Tech decide sobre o tratamento dos dados de cadastro, autenticação, assinatura, suporte e administração da plataforma. Nos registros de demandas inseridos pelo profissional, a plataforma atua como operadora, conforme as instruções e as finalidades do profissional ou da organização que ele representa. Esse responsável decide sobre os dados dos beneficiários, a base legal, a necessidade de cada registro e o atendimento aos titulares."
        },
        {
            titulo: "Dados tratados e origem",
            texto: "Você fornece nome, e-mail e senha no cadastro. A senha é armazenada como hash. A aplicação registra datas de cadastro, teste e acesso, plano, referências de pagamentos conferidos, pedidos e confirmação de cancelamento, aceite dos documentos e situação da conta. Nas demandas, você informa número, beneficiário, regional, assunto, vencimento e conclusão. Também são tratados mensagens e respostas de privacidade, registros administrativos, sessões e dados necessários à recuperação de senha e aos e-mails transacionais. Os provedores de infraestrutura podem processar registros técnicos, como IP, horário e informações da requisição."
        },
        {
            titulo: "Finalidades e fundamentos",
            texto: "Cadastro, sessão, recuperação de senha, gestão de demandas, assinatura e mensagens de serviço permitem executar o contrato solicitado. Medidas contra abuso e controle de acesso protegem a aplicação e seus usuários, mediante avaliação do legítimo interesse quando aplicável. Registros necessários a obrigações legais e ao exercício regular de direitos são mantidos para essas finalidades. O tratamento dos dados inseridos nas demandas depende da base legal definida pelo respectivo controlador, inclusive das regras específicas para dados sensíveis quando aplicáveis. O aceite dos termos registra sua concordância contratual e ciência da política; não é uma autorização genérica para qualquer tratamento."
        },
        {
            titulo: "Fornecedores e processamento internacional",
            texto: "A infraestrutura utiliza Railway para hospedagem e Neon para banco de dados. O Resend pode receber nome, e-mail e conteúdo das mensagens para recuperação de senha e comunicações transacionais, quando configurado. O PagBank trata os dados informados diretamente em seu ambiente para pagamento e assinatura; a plataforma mantém plano e referência da conferência, sem solicitar os dados do cartão no cadastro. Esses fornecedores podem processar dados fora do Brasil, conforme sua infraestrutura e contratos. Informações sobre regiões, destinatários e salvaguardas aplicáveis podem ser solicitadas ao canal de privacidade. Não vendemos os dados nem os utilizamos para publicidade comportamental."
        },
        {
            titulo: "Sessão e armazenamento essencial",
            texto: "O cookie essencial demandas_sessao mantém a autenticação e tem duração de até sete dias, sujeita à expiração ou encerramento da sessão. A aplicação não incorpora ferramentas de análise de audiência nem cookies de publicidade. O bloqueio dos cookies essenciais pode impedir o acesso à conta. As páginas de pagamento externas seguem suas próprias políticas."
        },
        {
            titulo: "Conservação e exclusão",
            texto: "Os dados permanecem armazenados enquanto a conta for mantida para disponibilizar o serviço e os registros do usuário. A expiração do teste ou o cancelamento da renovação não exclui a conta ou suas demandas. A necessidade de conservação é examinada ao atender um pedido de exclusão; obrigações legais e outras hipóteses legais de conservação podem impedir a eliminação imediata de certos registros. Cópias de segurança eventualmente existentes precisam ser consideradas no atendimento e informadas na resposta. Não há exclusão automática ao enviar ou receber resposta a uma solicitação."
        },
        {
            titulo: "Seus direitos e como solicitar",
            texto: "Você pode pedir confirmação, acesso, correção, informações sobre compartilhamento e, nas hipóteses legais, portabilidade, anonimização, bloqueio, eliminação, oposição e revogação de consentimento. Na área Privacidade, baixe os dados da sua conta e registre uma solicitação gratuitamente, mesmo após o fim do acesso pago ou uma suspensão. Se não conseguir entrar, escreva para tigertechbr@outlook.com. Podemos confirmar a identidade de forma proporcional, sem solicitar sua senha. Uma resposta administrativa registra a análise e as providências efetivas ou seus impedimentos; não significa que o pedido foi automaticamente executado."
        },
        {
            titulo: "Beneficiários, atendimento e reclamações",
            texto: "Se você é beneficiário mencionado em uma demanda, procure o profissional ou a organização responsável pelo registro. Nosso canal pode auxiliar na identificação e no encaminhamento ao controlador adequado, sem revelar dados de outras pessoas. Os requerimentos são analisados conforme sua natureza e os prazos legais aplicáveis. A confirmação e o acesso simplificado são disponibilizados de imediato quando possível; a declaração completa de acesso observa o prazo legal de até quinze dias, ressalvadas hipóteses legais específicas. Você também pode recorrer à ANPD e aos órgãos de defesa do consumidor competentes."
        },
        {
            titulo: "Proteção e uso responsável",
            texto: "A aplicação utiliza controle de sessão, isolamento das demandas por conta, perfis de acesso e registros de ações administrativas. O painel administrativo gerencia pessoas, assinaturas e solicitações, sem uma lista geral de demandas de todos os usuários. Pessoas autorizadas na operação da infraestrutura podem ter acesso técnico quando necessário ao serviço, à segurança ou ao atendimento. O profissional deve incluir apenas dados necessários, evitar informações sensíveis no campo de assunto sem fundamento adequado e proteger a própria senha e os arquivos exportados."
        },
        {
            titulo: "Atualizações e referências",
            texto: "Esta é a versão 2026-10-31. Alterações relevantes serão apresentadas para nova ciência e aceite, quando exigido pelo serviço. Referências oficiais: Lei nº 13.709/2018, em https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm; orientações da ANPD sobre direitos, em https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares, e perguntas frequentes, em https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes."
        }
    ],
    termos: [
        {
            titulo: "Serviço e conta individual",
            texto: "O Sistema de Demandas, disponibilizado por José Andrey Pereira Lisboa sob a marca Tiger Tech, permite ao profissional organizar suas próprias demandas e prazos. Cada cadastro é individual; o usuário deve manter dados corretos, proteger a senha e usar apenas dados que tenha autorização e fundamento para tratar. É vedado acessar contas alheias, explorar falhas, compartilhar credenciais ou usar a aplicação para finalidades ilícitas. Suporte e dúvidas: tigertechbr@outlook.com."
        },
        {
            titulo: "Teste, planos e pagamento",
            texto: "Novas contas profissionais recebem trinta dias gratuitos. Após esse prazo, os planos são mensal de R$ 35,00 ou anual de R$ 350,00, salvo condição expressamente concedida pelo responsável. A contratação é concluída no PagBank com o mesmo e-mail da conta. A liberação depende da conferência do pagamento pelo responsável, sem confirmação automática pelo aplicativo. Não informe senha da conta ou dados do cartão ao suporte."
        },
        {
            titulo: "Renovação e cancelamento",
            texto: "O pedido de cancelamento pode ser registrado na área de assinatura. Como a cobrança é gerenciada no PagBank, a interrupção da renovação depende da atuação e conferência do responsável nesse provedor. O aplicativo apresenta o pedido como pendente até a confirmação; não considere a cobrança cancelada apenas por enviar o pedido. Após a confirmação, o acesso continua até o fim do período já disponibilizado e uma mensagem transacional é preparada para o e-mail cadastrado. Cancelar a renovação não exclui seus dados. Solicite exclusão na área Privacidade ou pelo contato de suporte."
        },
        {
            titulo: "Responsabilidade pelos registros e prazos",
            texto: "O profissional ou sua organização é responsável pela exatidão e atualização das demandas, pela escolha de quais dados registrar e pela verificação de vencimentos. A aplicação auxilia na organização e não substitui a consulta aos sistemas oficiais nem a avaliação profissional. Recursos de aviso e disponibilidade dependem do funcionamento da aplicação e da infraestrutura; mantenha uma rotina de conferência dos prazos e proteja suas exportações."
        },
        {
            titulo: "Acesso, suporte e direitos",
            texto: "O acesso às demandas depende de período de teste, assinatura válida ou liberação expressa, e pode ser suspenso por decisão administrativa relacionada ao uso da conta. A conta autenticada mantém os canais de privacidade disponíveis mesmo com acesso profissional expirado ou suspenso. Dúvidas de cobrança, correções, cancelamento, encerramento e demais direitos podem ser solicitados pelo aplicativo ou por tigertechbr@outlook.com. Estes termos não afastam direitos assegurados pela legislação aplicável, inclusive os do consumidor quando cabíveis."
        }
    ]
};

function obterPolitica() {
    return structuredClone(POLITICA);
}

function erroPublico(status, codigo, mensagem) {
    return Object.assign(new Error(mensagem), { status, codigo });
}

function textoValido(valor, tamanhoMaximo) {
    return typeof valor === "string" && valor.trim().length >= 10 && valor.trim().length <= tamanhoMaximo &&
        !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(valor);
}

function criarServicoPrivacidade({ db = dbPadrao, inicializar = inicializarBanco } = {}) {
    async function aceitarTermos(usuarioId, versao) {
        if (versao !== VERSAO_POLITICA) {
            throw erroPublico(400, "VERSAO_POLITICA_INVALIDA", "Leia e aceite a versão atual dos termos e da política de privacidade.");
        }
        await inicializar();
        const resultado = await db.query(`UPDATE usuarios SET
            termos_aceitos_em = CASE WHEN termos_versao = $2 AND termos_aceitos_em IS NOT NULL
                THEN termos_aceitos_em ELSE CURRENT_TIMESTAMP END,
            termos_versao = $2 WHERE id = $1 RETURNING id`, [usuarioId, versao]);
        if (!resultado.rows[0]) throw erroPublico(404, "USUARIO_NAO_ENCONTRADO", "Conta não encontrada.");
        return { aceita: true, versao: VERSAO_POLITICA };
    }

    async function listarSolicitacoes(usuarioId) {
        await inicializar();
        const resultado = await db.query(`SELECT ${CAMPOS_SOLICITACAO} FROM solicitacoes_privacidade
            WHERE usuario_id = $1 ORDER BY criado_em DESC, id DESC`, [usuarioId]);
        return { solicitacoes: resultado.rows };
    }

    async function criarSolicitacao(usuarioId, dados) {
        if (!TIPOS_SOLICITACAO.has(dados?.tipo) || !textoValido(dados?.descricao, 2000)) {
            throw erroPublico(400, "SOLICITACAO_INVALIDA", "Escolha o tipo e descreva sua solicitação em 10 a 2.000 caracteres.");
        }
        await inicializar();
        const client = await db.connect();
        try {
            await client.query("BEGIN");
            // O bloqueio por titular serializa a verificacao e a criacao entre instancias.
            const usuario = (await client.query("SELECT id FROM usuarios WHERE id = $1 FOR UPDATE", [usuarioId])).rows[0];
            if (!usuario) throw erroPublico(404, "USUARIO_NAO_ENCONTRADO", "Conta não encontrada.");
            const uso = (await client.query(`SELECT
                COUNT(*) FILTER (WHERE criado_em >= CURRENT_TIMESTAMP - INTERVAL '24 hours')::integer AS recentes,
                COUNT(*) FILTER (WHERE tipo = $2 AND status = 'pendente')::integer AS pendentes
                FROM solicitacoes_privacidade WHERE usuario_id = $1`, [usuarioId, dados.tipo])).rows[0];
            if (Number(uso.pendentes) > 0) {
                throw erroPublico(409, "SOLICITACAO_PENDENTE", "Você já possui uma solicitação pendente deste tipo. Acompanhe a resposta ou entre em contato pelo e-mail de suporte.");
            }
            if (Number(uso.recentes) >= 10) {
                throw erroPublico(409, "LIMITE_SOLICITACOES", "O limite de dez solicitações nas últimas 24 horas foi alcançado. Aguarde ou use o e-mail de suporte.");
            }
            const solicitacao = (await client.query(`INSERT INTO solicitacoes_privacidade (usuario_id, tipo, descricao)
                VALUES ($1, $2, $3) RETURNING ${CAMPOS_SOLICITACAO}`, [usuarioId, dados.tipo, dados.descricao.trim()])).rows[0];
            await client.query("COMMIT");
            return { solicitacao };
        } catch (erro) {
            await client.query("ROLLBACK").catch(() => {});
            throw erro;
        } finally { client.release(); }
    }

    async function exportarDados(usuarioId) {
        await inicializar();
        const client = await db.connect();
        try {
            await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
            // A lista explicita impede que futuros campos de autenticacao entrem no arquivo.
            const perfil = (await client.query(`SELECT ${CAMPOS_PERFIL} FROM usuarios WHERE id = $1`, [usuarioId])).rows[0];
            if (!perfil) throw erroPublico(404, "USUARIO_NAO_ENCONTRADO", "Conta não encontrada.");
            const demandas = perfil.papel === "profissional" ? (await client.query(`SELECT id, numero_demanda,
                beneficiario, regional, assunto, TO_CHAR(data_vencimento, 'YYYY-MM-DD') AS data_vencimento,
                concluida, criado_em FROM demandas WHERE usuario_id = $1 ORDER BY id`, [usuarioId])).rows : [];
            const ativacoes = (await client.query(`SELECT id, referencia, plano, valor_centavos, acesso_ate, ativado_em
                FROM ativacoes_assinatura WHERE usuario_id = $1 ORDER BY ativado_em, id`, [usuarioId])).rows;
            const solicitacoes = (await client.query(`SELECT ${CAMPOS_SOLICITACAO} FROM solicitacoes_privacidade
                WHERE usuario_id = $1 ORDER BY criado_em, id`, [usuarioId])).rows;
            await client.query("COMMIT");
            return { gerado_em: new Date().toISOString(), versao_politica: VERSAO_POLITICA, perfil, demandas, ativacoes, solicitacoes };
        } catch (erro) {
            await client.query("ROLLBACK").catch(() => {});
            throw erro;
        } finally { client.release(); }
    }

    async function listarSolicitacoesAdministrativas() {
        await inicializar();
        const resultado = await db.query(`SELECT s.id, s.tipo, s.descricao, s.status, s.criado_em, s.resposta,
            s.respondido_em, u.nome, u.email FROM solicitacoes_privacidade s
            JOIN usuarios u ON u.id = s.usuario_id
            ORDER BY CASE WHEN s.status = 'pendente' THEN 0 ELSE 1 END, s.criado_em, s.id`);
        return { solicitacoes: resultado.rows };
    }

    async function responderSolicitacao(administradorId, solicitacaoId, resposta) {
        if (!textoValido(resposta, 4000)) {
            throw erroPublico(400, "RESPOSTA_INVALIDA", "Descreva a resposta e as providências em 10 a 4.000 caracteres.");
        }
        await inicializar();
        const client = await db.connect();
        try {
            await client.query("BEGIN");
            const anterior = (await client.query(`SELECT s.id, s.usuario_id, s.tipo, s.status, u.nome, u.email
                FROM solicitacoes_privacidade s JOIN usuarios u ON u.id = s.usuario_id
                WHERE s.id = $1 FOR UPDATE OF s`, [solicitacaoId])).rows[0];
            if (!anterior) throw erroPublico(404, "SOLICITACAO_NAO_ENCONTRADA", "Solicitação não encontrada.");
            if (anterior.status !== "pendente") {
                throw erroPublico(409, "SOLICITACAO_RESPONDIDA", "Esta solicitação já recebeu uma resposta.");
            }
            const solicitacao = (await client.query(`UPDATE solicitacoes_privacidade
                SET status = 'respondida', resposta = $2, respondido_em = CURRENT_TIMESTAMP, administrador_id = $3
                WHERE id = $1 RETURNING ${CAMPOS_SOLICITACAO}`, [solicitacaoId, resposta.trim(), administradorId])).rows[0];
            // Responder registra uma providencia; nao executa a exclusao de dados.
            await client.query(`INSERT INTO acoes_administrativas (administrador_id, usuario_id, acao, detalhes)
                VALUES ($1, $2, 'privacidade_respondida', $3::jsonb)`, [administradorId, anterior.usuario_id,
                JSON.stringify({ solicitacao_id: solicitacaoId, tipo: anterior.tipo })]);
            await client.query("COMMIT");
            return { solicitacao: { ...solicitacao, nome: anterior.nome, email: anterior.email } };
        } catch (erro) {
            await client.query("ROLLBACK").catch(() => {});
            throw erro;
        } finally { client.release(); }
    }

    return { aceitarTermos, listarSolicitacoes, criarSolicitacao, exportarDados,
        listarSolicitacoesAdministrativas, responderSolicitacao };
}

module.exports = { VERSAO_POLITICA, obterPolitica, criarServicoPrivacidade, ...criarServicoPrivacidade() };
