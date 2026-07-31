const STORAGE_KEY = "sistema-demandas";

const form = document.getElementById("formDemanda");
const listaDemandas = document.getElementById("listaDemandas");
const popup = document.getElementById("popup");
const popupMensagem = document.getElementById("popupMensagem");
const fecharPopup = document.getElementById("fecharPopup");
const pesquisa = document.getElementById("pesquisa");
const filtroRegional = document.getElementById("filtroRegional");
const filtroStatus = document.getElementById("filtroStatus");
const filtroConclusao = document.getElementById("filtroConclusao");

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/service-worker.js").catch((erro) => {
            console.error("Erro ao registrar o service worker:", erro);
        });
    });
}

function carregarDemandas() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function salvarDemandas(demandas) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demandas));
}

function criarId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
            texto: "Concluída",
            classe: "status-concluido"
        };
    }

    const dias = diasAteVencimento(demanda.vencimento);

    if (dias >= 0 && dias <= 3) {
        return {
            texto: "Próxima de vencer",
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
    return String(valor).replace(/[&<>"']/g, (caractere) => ({
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

function filtrarDemandas(demandas) {
    const termo = normalizarTexto(pesquisa.value);
    const regional = filtroRegional.value;
    const statusSelecionado = filtroStatus.value;
    const conclusaoSelecionada = filtroConclusao.value;

    return demandas.filter((demanda) => {
        const status = obterStatus(demanda).texto;
        const conclusao = demanda.concluida ? "Concluída" : "Pendente";
        const nomeBeneficiario = normalizarTexto(demanda.beneficiario);

        return (
            (!termo || nomeBeneficiario.includes(termo)) &&
            (!regional || demanda.regional === regional) &&
            (!statusSelecionado || status === statusSelecionado) &&
            (!conclusaoSelecionada || conclusao === conclusaoSelecionada)
        );
    });
}

function renderizarDemandas() {
    const demandas = filtrarDemandas(carregarDemandas());

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
        const conclusao = concluida ? "Concluída" : "Pendente";
        const classeConclusao = concluida ? "status-concluido" : "status-andamento";
        const status = obterStatus(demanda);

        return `
            <tr>
                <td data-label="N° de Demanda">${textoSeguro(demanda.numero)}</td>
                <td data-label="Nome do Beneficiário">${textoSeguro(demanda.beneficiario)}</td>
                <td data-label="Regional">${textoSeguro(demanda.regional || "")}</td>
                <td data-label="Assunto">${textoSeguro(demanda.assunto)}</td>
                <td data-label="Conclusão" class="${classeConclusao}">${conclusao}</td>
                <td data-label="Data da Demanda">${formatarData(demanda.vencimento)}</td>
                <td data-label="Status" class="${status.classe}">${status.texto}</td>
                <td data-label="Ação">${concluida ? "" : `<button type="button" data-id="${demanda.id}">Concluído</button>`}</td>
            </tr>
        `;
    }).join("");
}

function abrirPopup(mensagem) {
    popupMensagem.textContent = mensagem;
    popup.hidden = false;
}

function verificarPendencias() {
    const demandas = carregarDemandas();
    const vencendoAmanha = demandas.filter((demanda) => (
        !demanda.concluida && demanda.vencimento === amanhaIso()
    ));

    if (vencendoAmanha.length === 0) {
        return;
    }

    const numeros = vencendoAmanha.map((demanda) => demanda.numero).join(", ");
    abrirPopup(`Demanda pendente com vencimento amanhã: ${numeros}.`);
}

form.addEventListener("submit", (event) => {
    event.preventDefault();

    const demandas = carregarDemandas();

    demandas.push({
        id: criarId(),
        numero: document.getElementById("numero").value.trim(),
        beneficiario: document.getElementById("beneficiario").value.trim(),
        regional: document.getElementById("regional").value,
        assunto: document.getElementById("assunto").value.trim(),
        vencimento: document.getElementById("vencimento").value || hojeIso(),
        concluida: false
    });

    salvarDemandas(demandas);
    form.reset();
    renderizarDemandas();
    verificarPendencias();
});

listaDemandas.addEventListener("click", (event) => {
    const botao = event.target.closest("button[data-id]");

    if (!botao) {
        return;
    }

    const demandas = carregarDemandas().map((demanda) => {
        if (demanda.id !== botao.dataset.id) {
            return demanda;
        }

        return {
            ...demanda,
            concluida: true
        };
    });

    salvarDemandas(demandas);
    renderizarDemandas();
});

fecharPopup.addEventListener("click", () => {
    popup.hidden = true;
});

[pesquisa, filtroRegional, filtroStatus, filtroConclusao].forEach((campo) => {
    campo.addEventListener("input", renderizarDemandas);
    campo.addEventListener("change", renderizarDemandas);
});

renderizarDemandas();
verificarPendencias();
