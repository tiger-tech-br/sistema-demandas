const API = "https://sistema-demandas-aw2w.onrender.com";

async function apiGet(url) {

    return fetch(`${API}${url}`);

}

async function apiPost(url, dados) {

    return fetch(`${API}${url}`, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify(dados)

    });

}

async function apiPut(url, dados) {

    return fetch(`${API}${url}`, {

        method: "PUT",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify(dados)

    });

}

async function apiDelete(url) {

    return fetch(`${API}${url}`, {

        method: "DELETE"

    });

}