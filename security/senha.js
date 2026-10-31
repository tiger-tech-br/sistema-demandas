const { randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");

const derivar = promisify(scrypt);
const OPCOES = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const HASH_FICTICIO = `scrypt$32768$8$3$${"0".repeat(32)}$${"0".repeat(128)}`;

async function criarHash(senha) {
    const salt = randomBytes(16).toString("hex");
    const hash = await derivar(senha, salt, 64, OPCOES);
    return `scrypt$32768$8$3$${salt}$${hash.toString("hex")}`;
}

async function verificarSenha(senha, senhaHash) {
    const partes = /^scrypt\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(senhaHash || HASH_FICTICIO);
    if (!partes) {
        await derivar(senha, "0".repeat(32), 64, OPCOES);
        return false;
    }
    const hash = await derivar(senha, partes[1], 64, OPCOES);
    return Boolean(senhaHash) && timingSafeEqual(hash, Buffer.from(partes[2], "hex"));
}

module.exports = { criarHash, verificarSenha };
