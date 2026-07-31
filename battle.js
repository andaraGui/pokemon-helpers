const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

const TYPE_MAPPER = {
    0: 'normal',
    1: 'fighting',
    2: 'flying',
    3: 'poison',
    4: 'ground',
    5: 'rock',
    6: 'insect',
    7: 'ghost',
    8: 'steel',
    9: 'bug',
    10: 'fire',
    11: 'water',
    12: 'grass',
    13: 'electric',
    14: 'psychic',
    15: 'ice',
    16: 'dragon',
    17: 'dark',
    18: 'fairy'
}

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

function hpGauge(hp, maxHp) {
    const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
    const level = pct <= 20 ? 'low' : pct <= 50 ? 'mid' : 'high';
    return `
        <div class="pxl-hp" data-level="${level}">
            <div class="pxl-hp-label"><span>HP</span><span>${hp} / ${maxHp}</span></div>
            <div class="pxl-hp-track"><div class="pxl-hp-fill" style="width:${pct}%"></div></div>
        </div>
    `;
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
    const ivPercent = STAT_KEYS.reduce((acc, k) => {
        if (ivs[k] !== undefined) acc += ivs[k];
        return acc;
    }, 0) / (STAT_KEYS.length * 31);
    const moves = (data.next && data.next.allowed && data.next.allowed.moves) || [];

    function typeNamesFromIds(types) {
        if (!Array.isArray(types) || types.length === 0) return [];
        return [...new Set(types.map((typeId) => TYPE_MAPPER[typeId]).filter(Boolean))];
    }

    let html = '';
    html += row('Espécie', foe.name || foe.species);
    html += row('Nível', foe.level);
    html += row('Gênero', foe.gender || '-');
    if (foe.shiny) html += row('Shiny', '<span class="pxl-badge pxl-badge-accent">★ sim</span>');
    html += hpGauge(foe.hp, foe.maxHp);
    html += row('Habilidade', foe.ability || '-');
    html += row('Natureza', foe.nature || '-');
    html += row('IVs (%)', `${Math.round(ivPercent * 100)}%`);
    html += row('Item', foe.heldItem || '-');

    const typeNames = typeNamesFromIds(foe.types);
    html += row('Tipo(s)', typeNames.length ? typeNames.join(' / ') : '-');

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
