const API = "https://sistema-demandas-aw2w.onrender.com";

const form = document.getElementById("formDemanda");
const tabelaDemandas = document.getElementById("tabelaDemandas");

let demandaEditando = null;

/* ===========================
   CADASTRAR / ATUALIZAR
=========================== */

form.addEventListener("submit", salvarDemanda);

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

            return Swal.fire({

                icon: "error",
                title: "Erro",
                text: dados.mensagem

            });

        }

        Swal.fire({

            icon: "success",
            title: "Sucesso!",
            text: dados.mensagem

        });

        limparFormulario();

        carregarDemandas();

    } catch (erro) {

        console.error(erro);

        Swal.fire({

            icon: "error",
            title: "Erro",
            text: "Não foi possível conectar ao servidor."

        });

    }

}

/* ===========================
   LISTAR
=========================== */

async function carregarDemandas() {

    try {

        const resposta = await fetch(`${API}/demandas`);

        if (!resposta.ok) {

            throw new Error();

        }

        const demandas = await resposta.json();

        tabelaDemandas.innerHTML = "";

        demandas.forEach(criarLinhaTabela);

    } catch (erro) {

        console.error(erro);

        Swal.fire({

            icon: "error",
            title: "Erro",
            text: "Não foi possível carregar as demandas."

        });

    }

}

function criarLinhaTabela(demanda) {

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
                    )"
                >

                    ✏️ Editar

                </button>

                <button
                    class="btn-excluir"
                    onclick="excluirDemanda(${demanda.id})"
                >

                    🗑️ Excluir

                </button>

            </td>

        </tr>

    `;

}

/* ===========================
   EDITAR
=========================== */

function editarDemanda(id, numero, assunto, vencimento) {

    demandaEditando = id;

    document.getElementById("numero").value = numero;
    document.getElementById("assunto").value = assunto;
    document.getElementById("vencimento").value = vencimento.substring(0,10);

    form.querySelector("button").textContent = "Atualizar Demanda";

    window.scrollTo({

        top:0,

        behavior:"smooth"

    });

}

/* ===========================
   EXCLUIR
=========================== */

async function excluirDemanda(id) {

    const confirmar = await Swal.fire({

        title:"Excluir demanda?",

        text:"Essa ação não poderá ser desfeita.",

        icon:"warning",

        showCancelButton:true,

        confirmButtonText:"Excluir",

        cancelButtonText:"Cancelar",

        confirmButtonColor:"#dc2626"

    });

    if(!confirmar.isConfirmed){

        return;

    }

    try{

        const resposta = await fetch(`${API}/demandas/${id}`,{

            method:"DELETE"

        });

        const dados = await resposta.json();

        if(!resposta.ok){

            return Swal.fire({

                icon:"error",

                title:"Erro",

                text:dados.mensagem

            });

        }

        Swal.fire({

            icon:"success",

            title:"Sucesso",

            text:dados.mensagem

        });

        carregarDemandas();

    }catch(erro){

        console.error(erro);

        Swal.fire({

            icon:"error",

            title:"Erro",

            text:"Erro ao excluir demanda."

        });

    }

}

/* ===========================
   ALERTA (VERSÃO WEB)
=========================== */

async function verificarDemandasVencendoAmanha() {

    try {

        const resposta = await fetch(`${API}/demandas/vencendo-amanha`);

        if(!resposta.ok){

            return;

        }

        const demandas = await resposta.json();

        if(demandas.length===0){

            return;

        }

        let mensagem = "";

        demandas.forEach((demanda)=>{

            mensagem += `
                <b>Nº:</b> ${demanda.numero_demanda}<br>
                <b>Assunto:</b> ${demanda.assunto}<br><br>
            `;

        });

        Swal.fire({

            icon:"warning",

            title:"⚠️ Atenção!",

            html:`
                Existem demandas vencendo amanhã.<br><br>
                ${mensagem}
            `,

            confirmButtonText:"Ver Demandas"

        });

    }catch(erro){

        console.error(erro);

    }

}

/* ===========================
   UTILIDADES
=========================== */

function limparFormulario(){

    form.reset();

    demandaEditando = null;

    form.querySelector("button").textContent = "Cadastrar Demanda";

}

function formatarData(data){

    return new Date(data).toLocaleDateString("pt-BR");

}

/* ===========================
   INICIALIZAÇÃO
=========================== */

document.addEventListener("DOMContentLoaded",()=>{

    carregarDemandas();

    verificarDemandasVencendoAmanha();

});

/* ===========================
   SERVICE WORKER
=========================== */

if("serviceWorker" in navigator){

    window.addEventListener("load",()=>{

        navigator.serviceWorker
            .register("/service-worker.js")
            .then(()=>{

                console.log("Service Worker registrado.");

            })
            .catch(console.error);

    });

}