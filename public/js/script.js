const form = document.getElementById("formDemanda");

const API = "https://sistema-demandas-aw2w.onrender.com";

let demandaEditando = null;

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    const numero_demanda = document.getElementById("numero").value;
    const assunto = document.getElementById("assunto").value;
    const data_vencimento = document.getElementById("vencimento").value;

    const url = demandaEditando
        ? `/demandas/${demandaEditando}`
        : "/demandas";

    const metodo = demandaEditando
        ? "PUT"
        : "POST";

    try {

        const resposta = await fetch(`${API}${url}`, {
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

            Swal.fire({
                icon: "error",
                title: "Erro",
                text: dados.mensagem
            });

            return;
        }

        Swal.fire({
            icon: "success",
            title: "Sucesso!",
            text: dados.mensagem,
            confirmButtonText: "OK"
        });

        form.reset();

        demandaEditando = null;

        form.querySelector("button").textContent = "Cadastrar Demanda";

        carregarDemandas();

    } catch (erro) {

        console.error(erro);

        Swal.fire({
            icon: "error",
            title: "Erro",
            text: "Erro ao conectar com o servidor."
        });

    }

});

async function carregarDemandas() {

    try {

        const resposta = await fetch(`${API}/demandas`);

        if (!resposta.ok) {
            throw new Error("Erro ao buscar demandas.");
        }

        const demandas = await resposta.json();

        const tabela = document.getElementById("tabelaDemandas");

        let html = "";

        demandas.forEach((demanda) => {

            html += `
                <tr>
                    <td>${demanda.numero_demanda}</td>
                    <td>${demanda.assunto}</td>
                    <td>${new Date(demanda.data_vencimento).toLocaleDateString("pt-BR")}</td>

                    <td>

                        <button
                            onclick="editarDemanda(
                                ${demanda.id},
                                '${demanda.numero_demanda}',
                                '${demanda.assunto}',
                                '${demanda.data_vencimento}'
                            )"
                        >
                            Editar
                        </button>

                        <button
                            onclick="excluirDemanda(${demanda.id})"
                        >
                            Excluir
                        </button>

                    </td>
                </tr>
            `;

        });

        tabela.innerHTML = html;

    } catch (erro) {

        console.error(erro);

        Swal.fire({
            icon: "error",
            title: "Erro",
            text: "Não foi possível carregar as demandas."
        });

    }

}

async function excluirDemanda(id) {

    const resultado = await Swal.fire({
        title: "Excluir demanda?",
        text: "Esta ação não poderá ser desfeita.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Excluir",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#d33"
    });

    if (!resultado.isConfirmed) {
        return;
    }

    try {

        const resposta = await fetch(`${API}/demandas/${id}`, {
            method: "DELETE"
        });

        const dados = await resposta.json();

        if (!resposta.ok) {

            Swal.fire({
                icon: "error",
                title: "Erro",
                text: dados.mensagem
            });

            return;
        }

        Swal.fire({
            icon: "success",
            title: "Sucesso!",
            text: dados.mensagem
        });

        carregarDemandas();

    } catch (erro) {

        console.error(erro);

        Swal.fire({
            icon: "error",
            title: "Erro",
            text: "Erro ao excluir demanda."
        });

    }

}

function editarDemanda(id, numero, assunto, vencimento) {

    demandaEditando = id;

    document.getElementById("numero").value = numero;
    document.getElementById("assunto").value = assunto;
    document.getElementById("vencimento").value = vencimento.substring(0, 10);

    form.querySelector("button").textContent = "Atualizar Demanda";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


async function verificarDemandasVencendoAmanha() {

    try {

        const resposta = await fetch(`${API}/demandas/vencendo-amanha`);

        if (!resposta.ok) {
            throw new Error("Erro ao verificar demandas.");
        }

        const demandas = await resposta.json();

        if (demandas.length === 0) {
            return;
        }

        let mensagem = "";

        demandas.forEach((demanda) => {

            mensagem += `
                <b>Nº:</b> ${demanda.numero_demanda}<br>
                <b>Assunto:</b> ${demanda.assunto}<br><br>
            `;

        });

        const alarme = document.getElementById("alarme");

        if (alarme) {

            alarme.currentTime = 0;

            try {

                await alarme.play();

            } catch (erro) {

                console.log("O navegador bloqueou a reprodução automática do áudio.");

            }

        }

        Swal.fire({
            icon: "warning",
            title: "⚠️ Demandas vencendo amanhã",
            html: mensagem,
            confirmButtonText: "Entendi"
        });

    } catch (erro) {

        console.error(erro);

    }

}

carregarDemandas();
verificarDemandasVencendoAmanha();

if ("serviceWorker" in navigator) {

    window.addEventListener("load", () => {

        navigator.serviceWorker
            .register("/service-worker.js")
            .then(() => {

                console.log("Service Worker registrado com sucesso.");

            })
            .catch((erro) => {

                console.error("Erro ao registrar Service Worker:", erro);

            });

    });

}