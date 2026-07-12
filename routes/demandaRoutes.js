const express = require("express");

const router = express.Router();

const demandaController = require("../controllers/demandaController");

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

module.exports = router;