const express = require("express");

const router = express.Router();

const demandaController = require("../controllers/demandaController");
const { exigirAutenticacao, exigirAssinatura } = require("../middleware/autenticacao");

router.use(exigirAutenticacao, exigirAssinatura);

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

router.use((req, res) => res.status(404).json({ mensagem: "Rota de demandas nao encontrada." }));

module.exports = router;
