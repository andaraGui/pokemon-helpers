(function () {
    const ID = 'pokemon-type-matchup-overlay';
    const existing = document.getElementById(ID);
    if (existing) {
        existing.remove();
        return;
    }

    const container = document.createElement('div');
    container.id = ID;
    container.style.cssText = [
        'position: fixed',
        'top: 16px',
        'right: 16px',
        'width: 300px',
        'height: 360px',
        'z-index: 2147483647',
        'border-radius: 12px',
        'overflow: hidden',
        'box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5)',
        'display: flex',
        'flex-direction: column',
        'background: #14161c'
    ].join(';');

    const tabs = document.createElement('div');
    tabs.style.cssText = 'display:flex;flex:0 0 auto;';

    const calcTabBtn = document.createElement('button');
    calcTabBtn.textContent = 'Calculadora';
    calcTabBtn.id = 'pokemon-calc-tab-btn';

    const battleTabBtn = document.createElement('button');
    battleTabBtn.textContent = 'Encontro';
    battleTabBtn.id = 'pokemon-battle-tab-btn';

    [calcTabBtn, battleTabBtn].forEach((btn) => {
        btn.style.cssText = [
            'flex: 1',
            'padding: 8px',
            'border: 0',
            'background: #1c1f28',
            'color: #9198ab',
            'cursor: pointer',
            'font-size: 12px',
            'font-weight: 700'
        ].join(';');
    });

    const calcFrame = document.createElement('iframe');
    calcFrame.id = 'pokemon-calc-frame';
    calcFrame.src = chrome.runtime.getURL('index.html');
    calcFrame.style.cssText = 'width: 100%; flex: 1; border: 0; display: block;';

    const battleFrame = document.createElement('iframe');
    battleFrame.id = 'pokemon-battle-frame';
    battleFrame.src = chrome.runtime.getURL('battle.html');
    battleFrame.style.cssText = 'width: 100%; flex: 1; border: 0; display: none;';

    calcTabBtn.addEventListener('click', () => setActiveTab('calc'));
    battleTabBtn.addEventListener('click', () => setActiveTab('battle'));

    tabs.appendChild(calcTabBtn);
    tabs.appendChild(battleTabBtn);
    container.appendChild(tabs);
    container.appendChild(calcFrame);
    container.appendChild(battleFrame);
    document.documentElement.appendChild(container);

    setActiveTab('calc');

    // Busca os elementos por ID (em vez de usar closures) porque o listener
    // abaixo é global e persiste entre toggles da extensão — se o overlay for
    // fechado e reaberto, o container é recriado do zero e closures antigas
    // ficariam presas a elementos removidos do DOM.
    function setActiveTab(tab) {
        const calc = document.getElementById('pokemon-calc-frame');
        const battle = document.getElementById('pokemon-battle-frame');
        const calcBtn = document.getElementById('pokemon-calc-tab-btn');
        const battleBtn = document.getElementById('pokemon-battle-tab-btn');
        if (!calc || !battle || !calcBtn || !battleBtn) return;

        const showBattle = tab === 'battle';
        calc.style.display = showBattle ? 'none' : 'block';
        battle.style.display = showBattle ? 'block' : 'none';
        calcBtn.style.color = showBattle ? '#9198ab' : '#ffb238';
        battleBtn.style.color = showBattle ? '#ffb238' : '#9198ab';
    }

    if (!window.__pkmnHelperBattleListenerAdded) {
        window.__pkmnHelperBattleListenerAdded = true;
        window.addEventListener('pkmn-helper-battle-data', (ev) => {
            const data = ev.detail;
            const frame = document.getElementById('pokemon-battle-frame');
            if (frame) frame.contentWindow.postMessage({ type: 'battle-data', payload: data }, '*');

            const battleEnded = !!(data.state && data.state.over === true);

            // battleEnded checado primeiro de propósito: a resposta de fim de
            // batalha (ex: fugir) também pode trazer um "foe.stats" completo
            // junto (não é exclusivo do início de encontro), então o fim tem
            // que ganhar prioridade sobre o foco quando os dois aparecem juntos.
            if (battleEnded) {
                setActiveTab('calc');
            } else if (data.foe && data.foe.stats) {
                setActiveTab('battle');
            }
        });
    }
})();
