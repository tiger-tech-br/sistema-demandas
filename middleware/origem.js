const ORIGENS_APP = new Set(["http://localhost", "https://localhost", "capacitor://localhost"]);

function origensConfiguradas() {
    return new Set((process.env.APP_ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean));
}

function origemPermitida(req, origem) {
    return ORIGENS_APP.has(origem) || origensConfiguradas().has(origem) || origem === `${req.protocol}://${req.get("host")}`;
}

function clienteAndroid(req) {
    const origem = req.get("Origin");
    return req.get("X-App-Client") === "android" && Boolean(origem) && origemPermitida(req, origem);
}

function protegerOrigem(req, res, next) {
    const origem = req.get("Origin");
    const mutacao = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (origem && !origemPermitida(req, origem)) {
        if (mutacao || req.method === "OPTIONS") {
            return res.status(403).json({ mensagem: "Origem da requisicao nao permitida." });
        }
    } else if (origem) {
        res.set("Access-Control-Allow-Origin", origem);
        res.set("Access-Control-Allow-Credentials", "true");
        res.vary("Origin");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-App-Client, X-Usuario-Id");
        res.set("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, DELETE, OPTIONS");
    }
    if (mutacao && req.get("Sec-Fetch-Site") === "cross-site" && !origem) {
        return res.status(403).json({ mensagem: "Origem da requisicao nao permitida." });
    }
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    return next();
}

module.exports = { protegerOrigem, clienteAndroid };
