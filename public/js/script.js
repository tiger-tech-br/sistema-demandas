const API = "https://sistema-demandas-aw2w.onrender.com";

const form = document.getElementById("formDemanda");
const tabelaDemandas = document.getElementById("tabelaDemandas");

let demandaEditando = null;

/* ===================================
   EVENTOS
=================================== */

document.addEventListener("DOMContentLoaded", () => {

    carregarDemandas();

    verificarDemandasVencendoAmanha();

});

form.addEventListener("submit", salvarDemanda);

/* ===================================
   CADASTRAR / EDITAR
=================================== */

async function salvarDemanda(event) {

    event.preventDefault();

    const numero_demanda = document.getElementById("numero").value.trim();

    const assunto = document.getElementById("assunto").value.trim();

    const data_vencimento = document.getElementById("vencimento").value;

    const url = demandaEditando

        ? `${API}/demandas/${demandaEditando}`

        : `${API}/demandas`;

    const metodo = demandaEditando ? "PUT" : "POST";

    try {

        const resposta = await fetch(url, {

            method: metodo,

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                numero_demanda,

                assunto,

                data_vencimento

            })

        });

        const dados = await resposta.json();

        if (!resposta.ok) {

            return alertaErro(dados.mensagem);

        }

        alertaSucesso(dados.mensagem);

        limparFormulario();

        carregarDemandas();

    } catch (erro) {

        console.error(erro);

        alertaErro("Não foi possível conectar ao servidor.");

    }

}

/* ===================================
   LISTAR DEMANDAS
=================================== */

async function carregarDemandas() {

    try {

        const resposta = await fetch(`${API}/demandas`);

        if (!resposta.ok) {

            throw new Error();

        }

        const demandas = await resposta.json();

        tabelaDemandas.innerHTML = "";

        demandas.forEach((demanda) => {

            tabelaDemandas.innerHTML += `

                <tr>

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

                </tr>

            `;

        });

    } catch (erro) {

        console.error(erro);

        alertaErro("Não foi possível carregar as demandas.");

    }

}

/* ===================================
   EDITAR
=================================== */

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

/* ===================================
   EXCLUIR
=================================== */

async function excluirDemanda(id) {

    const confirmar = await alertaConfirmacao(

        "Excluir demanda?",

        "Essa ação não poderá ser desfeita."

    );

    if (!confirmar.isConfirmed) {

        return;

    }

    try {

        const resposta = await fetch(`${API}/demandas/${id}`, {

            method: "DELETE"

        });

        const dados = await resposta.json();

        if (!resposta.ok) {

            return alertaErro(dados.mensagem);

        }

        alertaSucesso(dados.mensagem);

        carregarDemandas();

    } catch (erro) {

        console.error(erro);

        alertaErro("Erro ao excluir demanda.");

    }

}

/* ===================================
   ALERTA WEB
=================================== */

async function verificarDemandasVencendoAmanha() {

    try {

        const resposta = await fetch(`${API}/demandas/vencendo-amanha`);

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

/* ===================================
   LIMPAR FORMULÁRIO
=================================== */

function limparFormulario() {

    form.reset();

    demandaEditando = null;

    alterarTextoBotao(

        form.querySelector("button"),

        "Cadastrar Demanda"

    );

}

/* ===================================
   SERVICE WORKER
=================================== */

if ("serviceWorker" in navigator) {

    window.addEventListener("load", () => {

        navigator.serviceWorker

            .register("/service-worker.js")

            .then(() => {

                console.log("Service Worker registrado.");

            })

            .catch(console.error);

    });

}