// Roda no MAIN world da página (não no isolated world do content script),
// porque só ali dá pra sobrescrever o window.fetch que o próprio jogo usa.
(function () {
    // Fica numa propriedade de window (não numa const fechada no escopo) pra
    // que reinjeções futuras (próximo clique no ícone) consigam atualizar o
    // padrão sem precisar recarregar a página — só o fetch em si é
    // sobrescrito uma única vez, o padrão de URL pode mudar depois.
    window.__pkmnHelperBattleUrlRe = /\/battle\//;
    window.__pkmnHelperCharacterUrlRe = /\/character/;

    if (window.__pkmnHelperFetchPatched) return;
    window.__pkmnHelperFetchPatched = true;

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const input = args[0];
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        let requestActionPromise = Promise.resolve(null);
        if (window.__pkmnHelperBattleUrlRe.test(url)) {
            const initBody = args[1] && args[1].body;
            if (typeof initBody === 'string') {
                requestActionPromise = Promise.resolve().then(() => {
                    const body = JSON.parse(initBody);
                    return { battleId: body.battleId || null, action: body.action || null };
                }).catch(() => null);
            } else if (input && typeof input.clone === 'function') {
                requestActionPromise = input.clone().json().then((body) => ({ battleId: body?.battleId || null, action: body?.action || null })).catch(() => null);
            }
        }
        const response = await originalFetch.apply(this, args);
        try {
            if (window.__pkmnHelperBattleUrlRe.test(url)) {
                response
                    .clone()
                    .json()
                    .then(async (data) => {
                        const request = await requestActionPromise;
                        if (request) data.__pokemonHelperRequest = request;
                        window.dispatchEvent(new CustomEvent('pkmn-helper-battle-data', { detail: data }));
                    })
                    .catch(() => {});
            } else if (window.__pkmnHelperCharacterUrlRe.test(url)) {
                response
                    .clone()
                    .json()
                    .then((data) => {
                        window.dispatchEvent(new CustomEvent('pkmn-helper-character-data', { detail: data }));
                    })
                    .catch(() => {});
            }
        } catch (_) {
            // nunca deixa o hook quebrar a chamada real do jogo
        }
        return response;
    };
})();
