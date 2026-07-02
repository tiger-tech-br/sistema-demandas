const express = require("express");
const router = express.Router();

const demandaController = require("../controllers/demandaController");

router.post("/", demandaController.criarDemanda);
router.get("/", demandaController.listarDemandas);

router.delete("/:id", demandaController.excluirDemanda);

router.put("/:id", demandaController.atualizarDemanda);

router.get(
    "/vencendo-amanha",
    demandaController.buscarDemandasVencendoAmanha
);

module.exports = router;