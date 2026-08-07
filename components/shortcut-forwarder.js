// ---------------------------------------------------------------------------
// Repassador de atalhos dos iframes do painel: envia TODO keydown fora de
// campo de texto pro shell (content.js), que é quem conhece o mapa de
// atalhos configurado. Substitui as listas de teclas que viviam duplicadas
// em app.js/chart.js/myPokemons.js (e faltavam em battle.js).
// ---------------------------------------------------------------------------
(() => {
    // só faz sentido dentro de um iframe do painel — nunca na página do jogo
    if (window.parent === window) return;
    window.addEventListener('keydown', (event) => {
        if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
        window.parent.postMessage({
            type: 'panel-shortcut',
            key: event.key,
            ctrl: event.ctrlKey,
            alt: event.altKey,
            shift: event.shiftKey,
            meta: event.metaKey
        }, '*');
    });

    // cliques também são repassados: o clique focou este iframe e o jogo parou
    // de receber teclado — o shell decide se devolve o foco (content.js,
    // mensagem 'panel-interaction')
    window.addEventListener('click', (event) => {
        if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
        window.parent.postMessage({ type: 'panel-interaction' }, '*');
    });
})();
