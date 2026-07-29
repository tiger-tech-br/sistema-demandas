const form = document.getElementById("formDemanda");
const tabelaDemandas = document.getElementById("tabelaDemandas");
const campoNumero = document.getElementById("numero");
const campoAssunto = document.getElementById("assunto");
const campoVencimento = document.getElementById("vencimento");

let demandaEditando = null;

const REGEX_NUMERO_DEMANDA = /^[0-9]{1,20}$/;
const REGEX_ASSUNTO = /^[A-Za-zÀ-ÿ0-9\s.,;:!?()/-]{3,120}$/;
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

document.addEventListener("DOMContentLoaded", iniciarSistema);
form.addEventListener("submit", salvarDemanda);

campoNumero.addEventListener("input", () => {
    campoNumero.value = campoNumero.value.replace(/\D/g, "").slice(0, 20);
});

async function iniciarSistema() {
    await carregarDemandas();
    await verificarDemandasVencendoAmanha();
}

function validarDataReal(data) {
    if (!REGEX_DATA.test(data)) {
        return false;
    }

    const [ano, mes, dia] = data.split("-").map(Number);
    const dataConvertida = new Date(ano, mes - 1, dia);

    return !Number.isNaN(dataConvertida.getTime()) &&
        dataConvertida.getFullYear() === ano &&
        dataConvertida.getMonth() === mes - 1 &&
        dataConvertida.getDate() === dia;
}

function validarFormulario(dados) {
    if (!REGEX_NUMERO_DEMANDA.test(dados.numero_demanda)) {
        alertaErro("O campo N° de Demanda deve conter apenas números.");
        campoNumero.focus();
        return false;
    }

    if (!REGEX_ASSUNTO.test(dados.assunto)) {
        alertaErro("O assunto deve ter de 3 a 120 caracteres e não pode conter símbolos especiais.");
        campoAssunto.focus();
        return false;
    }

    if (!validarDataReal(dados.data_vencimento)) {
        alertaErro("Informe uma data de vencimento válida.");
        campoVencimento.focus();
        return false;
    }

    return true;
}

async function salvarDemanda(event) {
    event.preventDefault();

    const dados = {
        numero_demanda: campoNumero.value.trim(),
        assunto: campoAssunto.value.trim(),
        data_vencimento: campoVencimento.value
    };

    if (!validarFormulario(dados)) {
        return;
    }

    try {
        const resposta = demandaEditando
            ? await apiPut(`/demandas/${demandaEditando}`, dados)
            : await apiPost("/demandas", dados);

        const resultado = await resposta.json();

        if (!resposta.ok) {
            alertaErro(resultado.mensagem);
            return;
        }

        alertaSucesso(resultado.mensagem);
        limparFormulario();
        await carregarDemandas();
    } catch (erro) {
        console.error(erro);
        alertaErro("Erro ao conectar ao servidor.");
    }
}

async function carregarDemandas() {
    try {
        const resposta = await apiGet("/demandas");

        if (!resposta.ok) {
            throw new Error();
        }

        const demandas = await resposta.json();

        tabelaDemandas.textContent = "";
        demandas.forEach(criarLinhaTabela);
    } catch (erro) {
        console.error(erro);
        alertaErro("Não foi possível carregar as demandas.");
    }
}

function criarLinhaTabela(demanda) {
    const linha = document.createElement("tr");
    const celulaNumero = document.createElement("td");
    const celulaAssunto = document.createElement("td");
    const celulaVencimento = document.createElement("td");
    const celulaAcoes = document.createElement("td");
    const botaoEditar = document.createElement("button");
    const botaoExcluir = document.createElement("button");

    celulaNumero.textContent = demanda.numero_demanda;
    celulaAssunto.textContent = demanda.assunto;
    celulaVencimento.textContent = formatarData(demanda.data_vencimento);

    botaoEditar.type = "button";
    botaoEditar.className = "btn-editar";
    botaoEditar.textContent = "Editar";
    botaoEditar.addEventListener("click", () => {
        editarDemanda(
            demanda.id,
            demanda.numero_demanda,
            demanda.assunto,
            demanda.data_vencimento
        );
    });

    botaoExcluir.type = "button";
    botaoExcluir.className = "btn-excluir";
    botaoExcluir.textContent = "Excluir";
    botaoExcluir.addEventListener("click", () => {
        excluirDemanda(demanda.id);
    });

    celulaAcoes.append(botaoEditar, botaoExcluir);
    linha.append(celulaNumero, celulaAssunto, celulaVencimento, celulaAcoes);
    tabelaDemandas.appendChild(linha);
}

function editarDemanda(id, numero, assunto, vencimento) {
    demandaEditando = id;
    campoNumero.value = numero;
    campoAssunto.value = assunto;
    campoVencimento.value = vencimento.substring(0, 10);
    alterarTextoBotao(form.querySelector("button"), "Atualizar Demanda");
    scrollTopo();
}

async function excluirDemanda(id) {
    const confirmar = await alertaConfirmacao(
        "Excluir demanda?",
        "Essa ação não poderá ser desfeita."
    );

    if (!confirmar.isConfirmed) {
        return;
    }

    try {
        const resposta = await apiDelete(`/demandas/${id}`);
        const resultado = await resposta.json();

        if (!resposta.ok) {
            alertaErro(resultado.mensagem);
            return;
        }

        alertaSucesso(resultado.mensagem);
        await carregarDemandas();
    } catch (erro) {
        console.error(erro);
        alertaErro("Erro ao excluir demanda.");
    }
}

async function verificarDemandasVencendoAmanha() {
    try {
        const resposta = await apiGet("/demandas/vencendo-amanha");

        if (!resposta.ok) {
            return;
        }

        const demandas = await resposta.json();

        if (demandas.length === 0) {
            return;
        }

        const mensagem = demandas.map((demanda) => (
            `<b>N°:</b> ${demanda.numero_demanda}<br>` +
            `<b>Assunto:</b> ${demanda.assunto}<br>` +
            `<b>Vencimento:</b> ${formatarData(demanda.data_vencimento)}`
        )).join("<br><br>");

        if (ehNavegador()) {
            alertaAviso("Demandas vencendo amanhã", mensagem);
        }
    } catch (erro) {
        console.error(erro);
    }
}

function limparFormulario() {
    form.reset();
    demandaEditando = null;
    alterarTextoBotao(form.querySelector("button"), "Cadastrar Demanda");
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
        try {
            await navigator.serviceWorker.register("/service-worker.js");
            console.log("Service Worker registrado.");
        } catch (erro) {
            console.error(erro);
        }
    });
}
