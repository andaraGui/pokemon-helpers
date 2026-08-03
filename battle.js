const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const TYPE_MAPPER = { 0:'normal',1:'fighting',2:'flying',3:'poison',4:'ground',5:'rock',6:'bug',7:'ghost',8:'steel',10:'fire',11:'water',12:'grass',13:'electric',14:'psychic',15:'ice',16:'dragon',17:'dark',18:'fairy' };
const TYPE_CHART = {
    normal:{rock:.5,ghost:0,steel:.5}, fighting:{normal:2,flying:.5,poison:.5,rock:2,bug:.5,ghost:0,steel:2,psychic:.5,ice:2,dark:2,fairy:.5},
    flying:{fighting:2,rock:.5,bug:2,steel:.5,grass:2,electric:.5}, poison:{poison:.5,ground:.5,rock:.5,ghost:.5,steel:0,grass:2,fairy:2},
    ground:{flying:0,poison:2,rock:2,bug:.5,steel:2,fire:2,grass:.5,electric:2}, rock:{fighting:.5,flying:2,ground:.5,bug:2,steel:.5,fire:2,ice:2},
    bug:{fighting:.5,flying:.5,poison:.5,ghost:.5,steel:.5,fire:.5,grass:2,psychic:2,dark:2,fairy:.5}, ghost:{normal:0,ghost:2,psychic:2,dark:.5},
    steel:{rock:2,steel:.5,fire:.5,water:.5,electric:.5,ice:2,fairy:2}, fire:{rock:.5,bug:2,steel:2,fire:.5,water:.5,grass:2,ice:2,dragon:.5},
    water:{ground:2,rock:2,fire:2,water:.5,grass:.5,dragon:.5}, grass:{flying:.5,poison:.5,ground:2,rock:2,bug:.5,steel:.5,fire:.5,water:2,grass:.5,dragon:.5},
    electric:{flying:2,ground:0,water:2,grass:.5,electric:.5,dragon:.5}, psychic:{fighting:2,poison:2,steel:.5,psychic:.5,dark:0},
    ice:{flying:2,ground:2,steel:.5,fire:.5,water:.5,grass:2,ice:.5,dragon:2}, dragon:{steel:.5,dragon:2,fairy:0}, dark:{fighting:.5,ghost:2,psychic:2,dark:.5,fairy:.5},
    fairy:{fighting:2,poison:.5,steel:.5,fire:.5,dragon:2,dark:2}
};

const state = {
    battleId: null, kind: null, foe: null, foeParty: [], party: [], bag: {}, turn: 1,
    canCatch: false, moves: [], caught: false, over: false, active: { you: null, foe: null },
    stages: { you: {}, foe: {} }
};
let pokedexBySlug = new Map();

const escapeHtml = (value) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const normalizeSpecies = (value) => String(value || '').trim().toLowerCase().replace(/[.']/g, '').replace(/[\s-]+/g, '_');
const typeNames = (types) => [...new Set((types || []).map((id) => TYPE_MAPPER[id] || String(id).toLowerCase()).filter(Boolean))];
const row = (label, value) => `<div class="row"><span class="label">${label}</span><span class="value">${value}</span></div>`;
const ivLevel = (iv) => iv <= 15 ? 'low' : iv <= 25 ? 'mid' : 'high';
const ivRow = (label, iv, display) => `<div class="row"><span class="label">${label}</span><span class="value" data-level="${ivLevel(iv)}">${display}</span></div>`;

function resetBattle(battleId) {
    Object.assign(state, {
        battleId: battleId || null, kind: null, foe: null, foeParty: [], turn: 1,
        canCatch: false, moves: [], caught: false, over: false,
        active: { you: null, foe: null }, stages: { you: {}, foe: {} }
    });
}

function hpGauge(hp, maxHp) {
    const current = Number(hp || 0), maximum = Number(maxHp || 0);
    const pct = maximum > 0 ? Math.max(0, Math.min(100, current / maximum * 100)) : 0;
    return `<div class="pxl-hp" data-level="${pct <= 20 ? 'low' : pct <= 50 ? 'mid' : 'high'}"><div class="pxl-hp-label"><span>HP</span><span>${current} / ${maximum}</span></div><div class="pxl-hp-track"><div class="pxl-hp-fill" style="width:${pct}%"></div></div></div>`;
}

function effectiveness(moveType, defenderTypes) {
    return defenderTypes.reduce((value, defender) => value * (TYPE_CHART[moveType]?.[defender] ?? 1), 1);
}

function recommend(foe) {
    const defenders = typeNames(foe.types), candidates = [];
    state.party.filter(Boolean).forEach((pokemon, index) => {
        (pokemon.moves || []).forEach((move) => {
            if (Number(move.pp) <= 0 || Number(move.power) <= 0) return;
            const moveType = TYPE_MAPPER[move.type];
            const multiplier = effectiveness(moveType, defenders);
            const stab = typeNames(pokemon.types).includes(moveType) ? 1.5 : 1;
            const attack = move.category === 'special' ? Number(pokemon.stats?.spa || 1) : Number(pokemon.stats?.atk || 1);
            candidates.push({ pokemon, index, move, multiplier, score:Number(move.power) * (Number(move.accuracy) || 100) / 100 * multiplier * stab * attack });
        });
    });
    candidates.sort((left, right) => right.score - left.score);
    const best = candidates[0];
    if (!best) return '';
    const effect = best.multiplier > 1 ? `${best.multiplier}× super eficaz` : best.multiplier < 1 ? `${best.multiplier}× de eficácia` : 'dano neutro';
    return `<h2>Sugestão</h2><div class="recommendation"><strong>${escapeHtml(best.pokemon.name || best.pokemon.species)}</strong> (slot ${best.index + 1}) com <strong>${escapeHtml(best.move.name)}</strong><br>${effect}; potência ${best.move.power}${typeNames(best.pokemon.types).includes(TYPE_MAPPER[best.move.type]) ? ' + STAB' : ''}.</div>`;
}

function applyEvents(events) {
    (events || []).forEach((event) => {
        if (event.t === 'stat_change' && state.stages[event.side]) {
            const current = Number(state.stages[event.side][event.stat] || 0);
            state.stages[event.side][event.stat] = Math.max(-6, Math.min(6, current + Number(event.delta || 0)));
        }
        if (event.t === 'capture_result' && event.caught === true) state.caught = true;
        if (event.t === 'battle_end' && event.outcome === 'caught') state.caught = true;
    });
}

function decrementUsedBall(request) {
    const action = request?.action;
    if (action?.type !== 'item' || !PokemonCatchRate.isBall(action.slug)) return;
    const slug = PokemonCatchRate.normalizeSlug(action.slug);
    const matchingKey = Object.keys(state.bag).find((key) => PokemonCatchRate.normalizeSlug(key) === slug) || slug;
    state.bag[matchingKey] = Math.max(0, Number(state.bag[matchingKey] || 0) - 1);
}

function updateBattle(data) {
    if (Array.isArray(data?.party)) state.party = data.party;
    if (data?.bag && typeof data.bag === 'object') state.bag = { ...data.bag };
    if (!data?.foe && !data?.state?.foe?.mon && !data?.battleId && !data?.__pokemonHelperRequest) return;

    const requestBattleId = data.__pokemonHelperRequest?.battleId;
    const incomingBattleId = data.battleId || requestBattleId;
    if (data.foe && (!state.foe || (incomingBattleId && incomingBattleId !== state.battleId))) resetBattle(incomingBattleId);
    if (incomingBattleId) state.battleId = incomingBattleId;
    if (data.kind) state.kind = data.kind;
    if (Array.isArray(data.foeParty)) state.foeParty = data.foeParty.map((pokemon) => ({ ...pokemon }));
    if (data.foe) state.foe = { ...data.foe };

    const battleState = data.state;
    if (battleState) {
        const foeActive = Number(battleState.foe?.active ?? state.active.foe ?? 0);
        const youActive = Number(battleState.you?.active ?? state.active.you ?? 0);
        if (state.active.foe !== null && foeActive !== state.active.foe) state.stages.foe = {};
        if (state.active.you !== null && youActive !== state.active.you) state.stages.you = {};
        state.active = { foe:foeActive, you:youActive };
        const activeMon = battleState.foe?.mon;
        if (activeMon) {
            const detailed = state.foeParty[foeActive] || {};
            const sameSpecies = normalizeSpecies(state.foe?.species) === normalizeSpecies(activeMon.species);
            state.foe = { ...(sameSpecies ? state.foe : {}), ...detailed, ...activeMon };
            state.foeParty[foeActive] = { ...detailed, ...state.foe };
        }
        state.turn = Number(battleState.turn || state.turn);
        state.over = battleState.over === true;
        if (battleState.outcome === 'caught') state.caught = true;
    }

    const allowed = data.next?.allowed;
    if (allowed && !Array.isArray(allowed)) {
        if (Array.isArray(allowed.moves)) state.moves = allowed.moves;
        if (typeof allowed.canCatch === 'boolean') state.canCatch = allowed.canCatch;
    } else if (data.next && data.next.phase !== 'choose') {
        state.moves = [];
    }
    applyEvents(data.events);
    decrementUsedBall(data.__pokemonHelperRequest);
}

const STAGE_LABELS = { hp:'HP',atk:'ATK',def:'DEF',spa:'SPA',spd:'SPD',spe:'SPE',accuracy:'Precisão',evasion:'Evasão' };
function renderStages() {
    const sections = [['you','Seus atributos'], ['foe','Atributos do oponente']];
    return sections.map(([side,title]) => {
        const values = Object.entries(state.stages[side]).filter(([,value]) => Number(value) !== 0);
        if (!values.length) return '';
        return `<h2>${title}</h2>${values.map(([key,value]) => row(STAGE_LABELS[key] || escapeHtml(key), `<span class="stage ${value > 0 ? 'up' : 'down'}">${value > 0 ? '+' : ''}${value}</span>`)).join('')}`;
    }).join('');
}

function renderBalls(foe) {
    if (!state.canCatch || state.kind === 'trainer') return '';
    const pokedex = pokedexBySlug.get(normalizeSpecies(foe.species || foe.name));
    const catchRate = Number(pokedex?.catchRate);
    const context = { types:typeNames(foe.types), level:foe.level, turn:state.turn };
    const balls = Object.entries(state.bag).map(([slug,quantity]) => ({ slug:PokemonCatchRate.normalizeSlug(slug), quantity:Number(quantity || 0) })).filter((item) => PokemonCatchRate.isBall(item.slug) && item.quantity > 0);
    if (!balls.length) return '';
    return `<h2>Pokébolas disponíveis</h2>${balls.map((ball) => {
        const definition = PokemonCatchRate.BALLS[ball.slug];
        const chance = PokemonCatchRate.chance({ hp:foe.hp, maxHp:foe.maxHp, catchRate, status:foe.status, ballMultiplier:PokemonCatchRate.multiplier(ball.slug, context) });
        return row(`${definition.name} ×${ball.quantity}`, `<span class="ball-rate">${chance === null ? '—' : `${chance.toFixed(1)}%`}</span>`);
    }).join('')}`;
}

function render() {
    const content = document.getElementById('content'), foe = state.foe;
    if (!foe) { content.innerHTML = '<p class="empty">Encontro sem dados de oponente.</p>'; return; }
    const stats = foe.stats || {}, ivs = foe.ivs || {}, evaluation = PokemonIvEvaluation.evaluate(foe);
    let html = row('Espécie', escapeHtml(foe.name || foe.species)) + row('Nível', foe.level ?? '-') + row('Gênero', escapeHtml(foe.gender || '-'));
    if (foe.shiny) html += row('Shiny', '<span class="pxl-badge pxl-badge-accent">★ sim</span>');
    html += hpGauge(foe.hp, foe.maxHp);
    html += row('Tipo(s)', typeNames(foe.types).join(' / ') || '-');
    html += row('Habilidade', `<span data-ability="${escapeHtml(foe.ability)}">${escapeHtml(PokemonAbilityInfo.label(foe.ability))}</span>`);
    html += row('Natureza', natureEffectHTML(foe.nature));
    html += row('Item', escapeHtml(foe.heldItem || '-'));
    html += row('Tipo de ataque principal', evaluation.role);
    html += row(PokemonIvEvaluation.labelHTML(), PokemonIvEvaluation.html(foe));
    html += ivRow('IVs (%)', evaluation.percent * 31 / 100, `${evaluation.percent}%`);
    html += '<h2>IVs</h2><div class="ivs-grid">' + STAT_KEYS.filter((key) => ivs[key] !== undefined).map((key) => ivRow(key.toUpperCase(), ivs[key], `${ivs[key]}/31`)).join('') + '</div>';
    html += '<h2>Stats</h2><div class="stats-grid">' + STAT_KEYS.filter((key) => stats[key] !== undefined).map((key) => row(key.toUpperCase(), stats[key])).join('') + '</div>';
    html += renderBalls(foe) + renderStages();
    if (state.caught) {
        html += '<div class="gotcha"><span class="gotcha-badge">Gotcha</span><p>Pokémon capturado</p></div>';
    } else {
        if (state.moves.length) html += '<h2>Seus golpes disponíveis</h2>' + state.moves.map((move) => `<div class="move"><span>${escapeHtml(move.name)}</span><span>${move.pp} PP</span></div>`).join('');
        html += recommend(foe);
    }
    content.innerHTML = html;
    PokemonAbilityInfo.hydrate(content);
}

async function loadPokedex() {
    try {
        const cached = await PokemonHelperStorage.getPokedex();
        pokedexBySlug = new Map((cached.items || []).map((pokemon) => [normalizeSpecies(pokemon.slug || pokemon.name), pokemon]));
        render();
        chrome.runtime.sendMessage({ type:'pkmn-helper-refresh-pokedex' });
    } catch (error) {
        console.warn('[Pokemon Helper] Não foi possível carregar a Pokédex:', error);
    }
}

window.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== 'battle-data') return;
    updateBattle(event.data.payload);
    render();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[PokemonHelperStorage.KEYS.pokedex]) return;
    const items = changes[PokemonHelperStorage.KEYS.pokedex].newValue?.items || [];
    pokedexBySlug = new Map(items.map((pokemon) => [normalizeSpecies(pokemon.slug || pokemon.name), pokemon]));
    render();
});

loadPokedex();
