const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

const OUTCOME_LABELS = {
    fled: 'Fugiu',
    caught: 'Capturado',
    captured: 'Capturado',
    won: 'Vitória',
    win: 'Vitória',
    lost: 'Derrota',
    lose: 'Derrota',
};

function row(label, value) {
    return `<div class="row"><span class="label">${label}</span><span class="value">${value}</span></div>`;
}

function renderBattleEnd(data, outcome) {
    const content = document.getElementById('content');
    const rewards = data.rewards || {};

    let html = row('Resultado', OUTCOME_LABELS[outcome] || outcome || '-');
    if (rewards.money) html += row('Dinheiro', rewards.money);
    if (rewards.prize) html += row('Prêmio', rewards.prize);
    if (rewards.badge) html += row('Emblema', rewards.badge);

    content.innerHTML = html;
}

function render(data) {
    const content = document.getElementById('content');

    const isOver = !!(data.state && data.state.over === true);
    if (isOver) {
        renderBattleEnd(data, data.state.outcome);
        return;
    }

    const foe = data && data.foe;

    if (!foe) {
        content.innerHTML = '<p class="empty">Encontro sem dados de oponente.</p>';
        return;
    }

    const stats = foe.stats || {};
    const ivs = foe.ivs || {};
    const moves = (data.next && data.next.allowed && data.next.allowed.moves) || [];

    let html = '';
    html += row('Espécie', foe.name || foe.species);
    html += row('Nível', foe.level);
    html += row('Gênero', foe.gender || '-');
    if (foe.shiny) html += row('Shiny', '<span class="shiny">★ sim</span>');
    html += row('HP', `${foe.hp} / ${foe.maxHp}`);
    html += row('Habilidade', foe.ability || '-');
    html += row('Natureza', foe.nature || '-');
    html += row('Item', foe.heldItem || '-');
    html += row('Tipos (id)', (foe.types || []).join(' / ') || '-');

    html += '<h2>Stats</h2>';
    STAT_KEYS.forEach((k) => {
        if (stats[k] !== undefined) html += row(k.toUpperCase(), stats[k]);
    });

    html += '<h2>IVs</h2>';
    STAT_KEYS.forEach((k) => {
        if (ivs[k] !== undefined) html += row(k.toUpperCase(), `${ivs[k]}/31`);
    });

    if (moves.length) {
        html += '<h2>Seus golpes disponíveis</h2>';
        moves.forEach((m) => {
            html += `<div class="move"><span>${m.name}</span><span>${m.pp} PP</span></div>`;
        });
    }

    content.innerHTML = html;
}

window.addEventListener('message', (ev) => {
    if (!ev.data || ev.data.type !== 'battle-data') return;
    render(ev.data.payload);
});
