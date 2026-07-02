const demandaModel = require("../models/demandaModel");

async function criarDemanda(req, res) {
    try {
        const {
            numero_demanda,
            assunto,
            data_vencimento
        } = req.body;

        if (!numero_demanda || !assunto || !data_vencimento) {
            return res.status(400).json({
                mensagem: "Preencha todos os campos."
            });
        }

        const novaDemanda = await demandaModel.criarDemanda(
            numero_demanda,
            assunto,
            data_vencimento
        );

        return res.status(201).json({
            mensagem: "Demanda cadastrada com sucesso!",
            demanda: novaDemanda
        });

    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            mensagem: "Erro ao cadastrar demanda."
        });
    }
}

async function listarDemandas(req, res) {

    try {

        const demandas = await demandaModel.listarDemandas();

        res.status(200).json(demandas);

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            mensagem: "Erro ao buscar demandas."
        });

    }

}

async function excluirDemanda(req, res) {

    try {

        const { id } = req.params;

        const demanda = await demandaModel.excluirDemanda(id);

        if (!demanda) {
            return res.status(404).json({
                mensagem: "Demanda não encontrada."
            });
        }

        res.status(200).json({
            mensagem: "Demanda excluída com sucesso."
        });

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            mensagem: "Erro ao excluir demanda."
        });

    }

}


async function atualizarDemanda(req, res) {

    try {

        const { id } = req.params;

        const {
            numero_demanda,
            assunto,
            data_vencimento
        } = req.body;

        const demanda = await demandaModel.atualizarDemanda(
            id,
            numero_demanda,
            assunto,
            data_vencimento
        );

        if (!demanda) {
            return res.status(404).json({
                mensagem: "Demanda não encontrada."
            });
        }

        res.status(200).json({
            mensagem: "Demanda atualizada com sucesso!",
            demanda
        });

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            mensagem: "Erro ao atualizar demanda."
        });

    }

}

async function buscarDemandasVencendoAmanha(req, res) {

    try {

        const demandas = await demandaModel.buscarDemandasVencendoAmanha();

        res.status(200).json(demandas);

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            mensagem: "Erro ao verificar demandas."
        });

    }

}

module.exports = {
    criarDemanda,
    listarDemandas,
    excluirDemanda,
    atualizarDemanda,
    buscarDemandasVencendoAmanha
};