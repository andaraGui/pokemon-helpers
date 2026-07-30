// Roda no MAIN world da página (não no isolated world do content script),
// porque só ali dá pra sobrescrever o window.fetch que o próprio jogo usa.
(function () {
    // Fica numa propriedade de window (não numa const fechada no escopo) pra
    // que reinjeções futuras (próximo clique no ícone) consigam atualizar o
    // padrão sem precisar recarregar a página — só o fetch em si é
    // sobrescrito uma única vez, o padrão de URL pode mudar depois.
    window.__pkmnHelperBattleUrlRe = /\/battle\//;

    if (window.__pkmnHelperFetchPatched) return;
    window.__pkmnHelperFetchPatched = true;

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);
        try {
            const input = args[0];
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            if (window.__pkmnHelperBattleUrlRe.test(url)) {
                response
                    .clone()
                    .json()
                    .then((data) => {
                        window.dispatchEvent(new CustomEvent('pkmn-helper-battle-data', { detail: data }));
                    })
                    .catch(() => {});
            }
        } catch (_) {
            // nunca deixa o hook quebrar a chamada real do jogo
        }
        return response;
    };
})();
