/* ===========================
   DATA
=========================== */

function formatarData(data) {

    return new Date(data).toLocaleDateString("pt-BR");

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