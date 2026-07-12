/* ===========================
   DATA
=========================== */

function formatarData(data) {

    if (!data) return "";

    const somenteData = data.split("T")[0];

    const partes = somenteData.split("-");

    return `${partes[2]}/${partes[1]}/${partes[0]}`;

}

/* ===========================
   SCROLL
=========================== */

function scrollTopo() {

    window.scrollTo({

        top: 0,

        behavior: "smooth"

    });

}

/* ===========================
   PLATAFORMA
=========================== */

function ehAPK() {

    return window.location.protocol === "capacitor:";

}

function ehNavegador() {

    return !ehAPK();

}

/* ===========================
   INTERNET
=========================== */

function estaOnline() {

    return navigator.onLine;

}

/* ===========================
   ALERTAS
=========================== */

function alertaSucesso(mensagem) {

    Swal.fire({

        icon: "success",

        title: "Sucesso!",

        text: mensagem,

        confirmButtonText: "OK"

    });

}

function alertaErro(mensagem) {

    Swal.fire({

        icon: "error",

        title: "Erro",

        text: mensagem,

        confirmButtonText: "OK"

    });

}

function alertaAviso(titulo, html) {

    Swal.fire({

        icon: "warning",

        title: titulo,

        html: html,

        confirmButtonText: "Entendi"

    });

}

function alertaConfirmacao(titulo, mensagem) {

    return Swal.fire({

        title: titulo,

        text: mensagem,

        icon: "question",

        showCancelButton: true,

        confirmButtonText: "Sim",

        cancelButtonText: "Cancelar"

    });

}

/* ===========================
   FORMULÁRIOS
=========================== */

function limparFormulario(formulario) {

    formulario.reset();

}

function alterarTextoBotao(botao, texto) {

    botao.textContent = texto;

}