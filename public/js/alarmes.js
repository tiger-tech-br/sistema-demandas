/* ===========================
   DEMANDAS VENCENDO AMANHÃ
=========================== */

async function verificarDemandasVencendoAmanha() {

    try {

        const resposta = await apiGet("/demandas/vencendo-amanha");

        if (!resposta.ok) {

            throw new Error("Erro ao consultar demandas.");

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

        // Apenas navegador mostra SweetAlert.
        // O APK será tratado pelo AlarmManager.

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