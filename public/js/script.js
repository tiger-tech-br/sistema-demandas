const STORAGE_KEY = "sistema-demandas";
const MIGRATION_KEY = "sistema-demandas-migrado-para-banco";
const API_PUBLICA = "https://sistema-demandas-aw2w.onrender.com";

const form = document.getElementById("formDemanda");
const listaDemandas = document.getElementById("listaDemandas");
const popup = document.getElementById("popup");
const popupMensagem = document.getElementById("popupMensagem");
const fecharPopup = document.getElementById("fecharPopup");
const pesquisa = document.getElementById("pesquisa");
const pesquisaAssunto = document.getElementById("pesquisaAssunto");
const filtroRegional = document.getElementById("filtroRegional");
const filtroStatus = document.getElementById("filtroStatus");
const filtroConclusao = document.getElementById("filtroConclusao");

let demandasCache = [];

function estaNoAppAndroid() {
    return Boolean(window.Capacitor) || window.location.protocol === "capacitor:";
}

const API_BASE = estaNoAppAndroid() ? API_PUBLICA : "";

async function limparCacheDoAppAndroid() {
    if (!estaNoAppAndroid()) {
        return;
    }

    if ("serviceWorker" in navigator) {
        const registros = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registros.map((registro) => registro.unregister()));
    }

    if ("caches" in window) {
        const nomes = await caches.keys();
        await Promise.all(nomes.map((nome) => caches.delete(nome)));
    }
}

if ("serviceWorker" in navigator && !estaNoAppAndroid()) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/service-worker.js").catch((erro) => {
            console.error("Erro ao registrar o service worker:", erro);
        });
    });
}

async function apiJson(url, opcoes = {}) {
    const resposta = await fetch(`${API_BASE}${url}`, {
        headers: {
            "Content-Type": "application/json",
            ...(opcoes.headers || {})
        },
        ...opcoes
    });

    const corpo = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
        throw new Error(corpo.mensagem || "Erro ao acessar o servidor.");
    }

    return corpo;
}

function hojeIso() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return hoje.toISOString().slice(0, 10);
}

function amanhaIso() {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(0, 0, 0, 0);
    return amanha.toISOString().slice(0, 10);
}

function diasAteVencimento(dataIso) {
    const hoje = new Date();
    const vencimento = new Date(`${dataIso}T00:00:00`);

    hoje.setHours(0, 0, 0, 0);

    return Math.ceil((vencimento - hoje) / 86400000);
}

function obterStatus(demanda) {
    if (demanda.concluida) {
        return {
            texto: "Concluida",
            classe: "status-concluido"
        };
    }

    const dias = diasAteVencimento(demanda.data_vencimento);

    if (dias >= 0 && dias <= 3) {
        return {
            texto: "Proxima de vencer",
            classe: "status-vencendo"
        };
    }

    return {
        texto: "Em andamento",
        classe: "status-andamento"
    };
}

function formatarData(dataIso) {
    if (!dataIso) {
        return "";
    }

    return new Date(`${dataIso}T00:00:00`).toLocaleDateString("pt-BR");
}

function textoSeguro(valor) {
    return String(valor || "").replace(/[&<>"']/g, (caractere) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;"
    })[caractere]);
}

function normalizarTexto(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function adaptarDemandaLocal(demanda) {
    return {
        numero_demanda: demanda.numero,
        beneficiario: demanda.beneficiario,
        regional: demanda.regional,
        assunto: demanda.assunto,
        data_vencimento: demanda.vencimento,
        concluida: Boolean(demanda.concluida)
    };
}

async function migrarLocalStorageParaBanco() {
    if (localStorage.getItem(MIGRATION_KEY) === "sim") {
        return;
    }

    const demandasLocais = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    if (demandasLocais.length === 0) {
        localStorage.setItem(MIGRATION_KEY, "sim");
        return;
    }

    for (const demanda of demandasLocais) {
        await apiJson("/demandas", {
            method: "POST",
            body: JSON.stringify(adaptarDemandaLocal(demanda))
        });
    }

    localStorage.setItem(MIGRATION_KEY, "sim");
}

function filtrarDemandas(demandas) {
    const termo = normalizarTexto(pesquisa.value);
    const termoAssunto = normalizarTexto(pesquisaAssunto.value);
    const regional = filtroRegional.value;
    const statusSelecionado = normalizarTexto(filtroStatus.value);
    const conclusaoSelecionada = normalizarTexto(filtroConclusao.value);

    return demandas.filter((demanda) => {
        const status = normalizarTexto(obterStatus(demanda).texto);
        const conclusao = normalizarTexto(demanda.concluida ? "Concluida" : "Pendente");
        const nomeBeneficiario = normalizarTexto(demanda.beneficiario);
        const assunto = normalizarTexto(demanda.assunto);

        return (
            (!termo || nomeBeneficiario.includes(termo)) &&
            (!termoAssunto || assunto.includes(termoAssunto)) &&
            (!regional || demanda.regional === regional) &&
            (!statusSelecionado || status === statusSelecionado) &&
            (!conclusaoSelecionada || conclusao === conclusaoSelecionada)
        );
    });
}

function renderizarDemandas() {
    const demandas = filtrarDemandas(demandasCache);

    if (demandas.length === 0) {
        listaDemandas.innerHTML = `
            <tr>
                <td class="vazio" colspan="8">Nenhuma demanda encontrada.</td>
            </tr>
        `;
        return;
    }

    listaDemandas.innerHTML = demandas.map((demanda) => {
        const concluida = demanda.concluida;
        const conclusao = concluida ? "Concluida" : "Pendente";
        const classeConclusao = concluida ? "status-concluido" : "status-andamento";
        const status = obterStatus(demanda);

        return `
            <tr>
                <td data-label="N. de Demanda">${textoSeguro(demanda.numero_demanda)}</td>
                <td data-label="Nome do Beneficiario">${textoSeguro(demanda.beneficiario)}</td>
                <td data-label="Regional">${textoSeguro(demanda.regional)}</td>
                <td data-label="Assunto">${textoSeguro(demanda.assunto)}</td>
                <td data-label="Conclusao" class="${classeConclusao}">${conclusao}</td>
                <td data-label="Data da Demanda">${formatarData(demanda.data_vencimento)}</td>
                <td data-label="Status" class="${status.classe}">${status.texto}</td>
                <td data-label="Acao">${concluida ? "" : `<button type="button" data-id="${demanda.id}">Concluido</button>`}</td>
            </tr>
        `;
    }).join("");
}

function abrirPopup(mensagem) {
    popupMensagem.textContent = mensagem;
    popup.hidden = false;
}

function verificarPendencias() {
    const vencendoAmanha = demandasCache.filter((demanda) => (
        !demanda.concluida && demanda.data_vencimento === amanhaIso()
    ));

    if (vencendoAmanha.length === 0) {
        return;
    }

    const numeros = vencendoAmanha.map((demanda) => demanda.numero_demanda).join(", ");
    abrirPopup(`Demanda pendente com vencimento amanha: ${numeros}.`);
}

async function carregarDemandasDoBanco() {
    listaDemandas.innerHTML = `
        <tr>
            <td class="vazio" colspan="8">Carregando demandas...</td>
        </tr>
    `;

    await limparCacheDoAppAndroid();
    await migrarLocalStorageParaBanco();

    demandasCache = await apiJson("/demandas");
    renderizarDemandas();
    verificarPendencias();
}

function montarPayloadDoFormulario() {
    return {
        numero_demanda: document.getElementById("numero").value.trim(),
        beneficiario: document.getElementById("beneficiario").value.trim(),
        regional: document.getElementById("regional").value,
        assunto: document.getElementById("assunto").value.trim(),
        data_vencimento: document.getElementById("vencimento").value || hojeIso(),
        concluida: false
    };
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        const resposta = await apiJson("/demandas", {
            method: "POST",
            body: JSON.stringify(montarPayloadDoFormulario())
        });

        demandasCache.push(resposta.demanda);
        form.reset();
        renderizarDemandas();
        verificarPendencias();
    } catch (erro) {
        abrirPopup(erro.message);
    }
});

listaDemandas.addEventListener("click", async (event) => {
    const botao = event.target.closest("button[data-id]");

    if (!botao) {
        return;
    }

    const demanda = demandasCache.find((item) => String(item.id) === botao.dataset.id);

    if (!demanda) {
        return;
    }

    try {
        const resposta = await apiJson(`/demandas/${demanda.id}`, {
            method: "PUT",
            body: JSON.stringify({
                ...demanda,
                concluida: true
            })
        });

        demandasCache = demandasCache.map((item) => (
            item.id === resposta.demanda.id ? resposta.demanda : item
        ));
        renderizarDemandas();
    } catch (erro) {
        abrirPopup(erro.message);
    }
});

fecharPopup.addEventListener("click", () => {
    popup.hidden = true;
});

[pesquisa, pesquisaAssunto, filtroRegional, filtroStatus, filtroConclusao].forEach((campo) => {
    campo.addEventListener("input", renderizarDemandas);
    campo.addEventListener("change", renderizarDemandas);
});

carregarDemandasDoBanco().catch((erro) => {
    console.error(erro);
    abrirPopup("Nao foi possivel carregar as demandas do banco de dados.");
});
