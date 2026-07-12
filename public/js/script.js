const form = document.getElementById("formDemanda");
const tabelaDemandas = document.getElementById("tabelaDemandas");

let demandaEditando = null;

/* ==========================================
   INICIALIZAÇÃO
========================================== */

document.addEventListener("DOMContentLoaded", iniciarSistema);

async function iniciarSistema() {

    await carregarDemandas();

    await verificarDemandasVencendoAmanha();

}

form.addEventListener("submit", salvarDemanda);

/* ==========================================
   CADASTRAR / EDITAR
========================================== */

async function salvarDemanda(event) {

    event.preventDefault();

    const dados = {

        numero_demanda: document.getElementById("numero").value.trim(),

        assunto: document.getElementById("assunto").value.trim(),

        data_vencimento: document.getElementById("vencimento").value

    };

    try {

        let resposta;

        if (demandaEditando) {

            resposta = await apiPut(

                `/demandas/${demandaEditando}`,

                dados

            );

        } else {

            resposta = await apiPost(

                "/demandas",

                dados

            );

        }

        const resultado = await resposta.json();

        if (!resposta.ok) {

            return alertaErro(resultado.mensagem);

        }

        alertaSucesso(resultado.mensagem);

        limparFormulario();

        await carregarDemandas();

    } catch (erro) {

        console.error(erro);

        alertaErro("Erro ao conectar ao servidor.");

    }

}

/* ==========================================
   LISTAR
========================================== */

async function carregarDemandas() {

    try {

        const resposta = await apiGet("/demandas");

        if (!resposta.ok) {

            throw new Error();

        }

        const demandas = await resposta.json();

        tabelaDemandas.innerHTML = "";

        demandas.forEach(criarLinhaTabela);

    } catch (erro) {

        console.error(erro);

        alertaErro("Não foi possível carregar as demandas.");

    }

}

function criarLinhaTabela(demanda) {

    const linha = document.createElement("tr");

    linha.innerHTML = `

        <td>${demanda.numero_demanda}</td>

        <td>${demanda.assunto}</td>

        <td>${formatarData(demanda.data_vencimento)}</td>

        <td>

            <button
                class="btn-editar"
                onclick="editarDemanda(
                    ${demanda.id},
                    '${demanda.numero_demanda}',
                    '${demanda.assunto}',
                    '${demanda.data_vencimento}'
                )">

                ✏️ Editar

            </button>

            <button
                class="btn-excluir"
                onclick="excluirDemanda(${demanda.id})">

                🗑️ Excluir

            </button>

        </td>

    `;

    tabelaDemandas.appendChild(linha);

}

/* ==========================================
   EDITAR
========================================== */

function editarDemanda(id, numero, assunto, vencimento) {

    demandaEditando = id;

    document.getElementById("numero").value = numero;

    document.getElementById("assunto").value = assunto;

    document.getElementById("vencimento").value = vencimento.substring(0, 10);

    alterarTextoBotao(

        form.querySelector("button"),

        "Atualizar Demanda"

    );

    scrollTopo();

}

/* ==========================================
   EXCLUIR
========================================== */

async function excluirDemanda(id) {

    const confirmar = await alertaConfirmacao(

        "Excluir demanda?",

        "Essa ação não poderá ser desfeita."

    );

    if (!confirmar.isConfirmed) {

        return;

    }

    try {

        const resposta = await apiDelete(

            `/demandas/${id}`

        );

        const resultado = await resposta.json();

        if (!resposta.ok) {

            return alertaErro(resultado.mensagem);

        }

        alertaSucesso(resultado.mensagem);

        await carregarDemandas();

    } catch (erro) {

        console.error(erro);

        alertaErro("Erro ao excluir demanda.");

    }

}

/* ==========================================
   ALERTA WEB
========================================== */

async function verificarDemandasVencendoAmanha() {

    try {

        const resposta = await apiGet(

            "/demandas/vencendo-amanha"

        );

        if (!resposta.ok) {

            return;

        }

        const demandas = await resposta.json();

        if (demandas.length === 0) {

            return;

        }

        let mensagem = "";

        demandas.forEach((demanda) => {

            mensagem += `
                <b>Nº:</b> ${demanda.numero_demanda}<br>
                <b>Assunto:</b> ${demanda.assunto}<br>
                <b>Vencimento:</b> ${formatarData(demanda.data_vencimento)}
                <br><br>
            `;

        });

        if (ehNavegador()) {

            alertaAviso(

                "⚠️ Demandas vencendo amanhã",

                mensagem

            );

        }

    } catch (erro) {

        console.error(erro);

    }

}

/* ==========================================
   LIMPAR FORMULÁRIO
========================================== */

function limparFormulario() {

    form.reset();

    demandaEditando = null;

    alterarTextoBotao(

        form.querySelector("button"),

        "Cadastrar Demanda"

    );

}

/* ==========================================
   SERVICE WORKER
========================================== */

if ("serviceWorker" in navigator) {

    window.addEventListener("load", async () => {

        try {

            await navigator.serviceWorker.register(

                "/service-worker.js"

            );

            console.log("Service Worker registrado.");

        } catch (erro) {

            console.error(erro);

        }

    });

}