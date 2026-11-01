const express = require("express");

const router = express.Router();

const demandaController = require("../controllers/demandaController");
const { exigirAutenticacao, exigirAssinatura, exigirProfissional } = require("../middleware/autenticacao");

router.use(exigirAutenticacao, exigirProfissional, exigirAssinatura);

/* ===========================
   CRUD
=========================== */

// Criar demanda
router.post(
    "/",
    demandaController.criarDemanda
);

// Listar todas
router.get(
    "/",
    demandaController.listarDemandas
);

// Lixeira
router.get(
    "/lixeira",
    demandaController.listarLixeira
);

router.post(
    "/lixeira/todas",
    demandaController.moverTodasParaLixeira
);

// A rota fixa deve anteceder DELETE /:id.
router.delete(
    "/lixeira",
    demandaController.esvaziarLixeira
);

router.post(
    "/:id/restaurar",
    demandaController.restaurarDemanda
);

// Atualizar
router.put(
    "/:id",
    demandaController.atualizarDemanda
);

// Excluir
router.delete(
    "/:id",
    demandaController.excluirDemanda
);

/* ===========================
   ALERTAS
=========================== */

// Demandas que vencem amanhã
router.get(
    "/vencendo-amanha",
    demandaController.buscarDemandasVencendoAmanha
);

router.use((req, res) => res.status(404).json({ mensagem: "Rota de demandas nao encontrada." }));

module.exports = router;
