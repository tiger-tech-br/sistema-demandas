const express = require("express");
const path = require("node:path");
const authRoutes = require("./routes/authRoutes");
const passwordRoutes = require("./routes/passwordRoutes");
const demandaRoutes = require("./routes/demandaRoutes");
const cobrancaRoutes = require("./routes/cobrancaRoutes");
const adminRoutes = require("./routes/adminRoutes");
const privacidadeRoutes = require("./routes/privacidadeRoutes");
const adminPrivacidadeRoutes = require("./routes/adminPrivacidadeRoutes");
const { protegerOrigem } = require("./middleware/origem");
const { obterPlanos } = require("./services/assinaturaService");

const app = express();
app.disable("x-powered-by");
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(proxyHops) && proxyHops >= 0 && proxyHops <= 5) app.set("trust proxy", proxyHops);

app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");
    res.set("X-Frame-Options", "DENY");
    res.set("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
    next();
});
app.use(["/auth", "/demandas", "/planos", "/cobranca", "/admin", "/privacidade"], (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
}, protegerOrigem);
app.use(express.json({ limit: "16kb" }));
app.use("/auth", passwordRoutes);
app.use("/auth", authRoutes);
app.get("/planos", (req, res) => res.json(obterPlanos()));
app.use("/demandas", demandaRoutes);
app.use("/cobranca", cobrancaRoutes);
app.use("/privacidade", privacidadeRoutes);
app.use("/admin/privacidade", adminPrivacidadeRoutes);
app.use("/admin", adminRoutes);
const frontend = path.join(__dirname, "web", "dist");
app.use(express.static(frontend));
app.use((req, res) => res.status(404).json({ mensagem: "Pagina ou recurso nao encontrado." }));
app.use((erro, req, res, next) => {
    if (res.headersSent) return next(erro);
    if (erro.type === "entity.parse.failed") return res.status(400).json({ mensagem: "Envie um JSON valido." });
    if (erro.type === "entity.too.large") return res.status(413).json({ mensagem: "Os dados enviados excedem o tamanho permitido." });
    if (erro.codigo === "BANCO_NAO_CONFIGURADO") return res.status(503).json({ codigo: erro.codigo, mensagem: erro.message });
    console.error("Falha ao atender requisicao:", erro.code || erro.name || "erro interno");
    return res.status(503).json({ mensagem: "Nao foi possivel acessar o servico. Tente novamente em instantes." });
});

module.exports = app;
