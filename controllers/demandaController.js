const demandaModel = require("../models/demandaModel");

const REGEX_NUMERO_DEMANDA = /^[0-9]{1,20}$/;
const REGEX_ASSUNTO = /^[A-Za-zÀ-ÿ0-9\s.,;:!?()/-]{3,120}$/;
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

function dataValida(data) {
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

function validarDemanda({ numero_demanda, assunto, data_vencimento }) {
    if (!numero_demanda || !assunto || !data_vencimento) {
        return "Preencha todos os campos.";
    }

    if (!REGEX_NUMERO_DEMANDA.test(String(numero_demanda))) {
        return "O campo N° de Demanda deve conter apenas números.";
    }

    if (!REGEX_ASSUNTO.test(String(assunto).trim())) {
        return "O assunto deve ter de 3 a 120 caracteres e não pode conter símbolos especiais.";
    }

    if (!dataValida(String(data_vencimento))) {
        return "Informe uma data de vencimento válida.";
    }

    return null;
}

async function criarDemanda(req, res) {
    try {
        const {
            numero_demanda,
            assunto,
            data_vencimento
        } = req.body;

        const erroValidacao = validarDemanda({
            numero_demanda,
            assunto,
            data_vencimento
        });

        if (erroValidacao) {
            return res.status(400).json({
                mensagem: erroValidacao
            });
        }

        const novaDemanda = await demandaModel.criarDemanda(
            String(numero_demanda).trim(),
            String(assunto).trim(),
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
        return res.status(200).json(demandas);
    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            mensagem: "Erro ao buscar demandas."
        });
    }
}

async function excluirDemanda(req, res) {
    try {
        const { id } = req.params;

        if (!/^[0-9]+$/.test(id)) {
            return res.status(400).json({
                mensagem: "ID inválido."
            });
        }

        const demanda = await demandaModel.excluirDemanda(id);

        if (!demanda) {
            return res.status(404).json({
                mensagem: "Demanda não encontrada."
            });
        }

        return res.status(200).json({
            mensagem: "Demanda excluída com sucesso."
        });
    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            mensagem: "Erro ao excluir demanda."
        });
    }
}

async function atualizarDemanda(req, res) {
    try {
        const { id } = req.params;

        if (!/^[0-9]+$/.test(id)) {
            return res.status(400).json({
                mensagem: "ID inválido."
            });
        }

        const {
            numero_demanda,
            assunto,
            data_vencimento
        } = req.body;

        const erroValidacao = validarDemanda({
            numero_demanda,
            assunto,
            data_vencimento
        });

        if (erroValidacao) {
            return res.status(400).json({
                mensagem: erroValidacao
            });
        }

        const demanda = await demandaModel.atualizarDemanda(
            id,
            String(numero_demanda).trim(),
            String(assunto).trim(),
            data_vencimento
        );

        if (!demanda) {
            return res.status(404).json({
                mensagem: "Demanda não encontrada."
            });
        }

        return res.status(200).json({
            mensagem: "Demanda atualizada com sucesso!",
            demanda
        });
    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            mensagem: "Erro ao atualizar demanda."
        });
    }
}

async function buscarDemandasVencendoAmanha(req, res) {
    try {
        const demandas = await demandaModel.buscarDemandasVencendoAmanha();
        return res.status(200).json(demandas);
    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
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
