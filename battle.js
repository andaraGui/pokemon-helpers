const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
// TYPE_MAPPER e TYPES vêm de components/type-tag.js; CHART/defMultiplier vêm de
// components/type-chart-data.js; MOVE_TYPES vem de data/move-types.js;
// STATUS_MOVES vem de data/move-status.js

const state = {
    battleId: null, kind: null, foe: null, foeParty: [], party: [], bag: {}, turn: 1,
    canCatch: false, moves: [], caught: false, over: false, active: { you: null, foe: null },
    stages: { you: {}, foe: {} }
};
let pokedexBySlug = new Map();
let trainerMovesByKey = new Map();
let discoveredMovesByKey = new Map();
let matchupModalOpen = false;
let matchupIncludeDual = false;

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

function recommend(foe) {
    const defenders = typeNames(foe.types), candidates = [];
    state.party.filter(Boolean).forEach((pokemon, index) => {
        (pokemon.moves || []).forEach((move) => {
            if (Number(move.pp) <= 0 || Number(move.power) <= 0) return;
            const moveType = TYPE_MAPPER[move.type];
            const multiplier = defMultiplier(moveType, defenders);
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

const KNOWN_EVENT_TYPES = ['stat_change', 'capture_result', 'battle_end'];
const slugifyMoveName = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// não sabemos o nome exato do campo que carrega o golpe usado num evento de
// batalha (o jogo não documenta isso), então procuramos em qualquer campo de
// texto do evento por algo que bata com um golpe conhecido (data/move-types.js)
function findRevealedMoveSlug(event) {
    for (const key of ['move', 'moveSlug', 'slug', 'name', 'moveName']) {
        const slug = slugifyMoveName(event[key]);
        if (MOVE_TYPES[slug]) return slug;
    }
    for (const value of Object.values(event)) {
        if (typeof value !== 'string') continue;
        const slug = slugifyMoveName(value);
        if (MOVE_TYPES[slug]) return slug;
    }
    return null;
}

function applyEvents(events) {
    (events || []).forEach((event) => {
        if (event.t === 'stat_change' && state.stages[event.side]) {
            const current = Number(state.stages[event.side][event.stat] || 0);
            state.stages[event.side][event.stat] = Math.max(-6, Math.min(6, current + Number(event.delta || 0)));
        }
        if (event.t === 'capture_result' && event.caught === true) state.caught = true;
        if (event.t === 'battle_end' && event.outcome === 'caught') state.caught = true;

        // segue a mesma convenção já usada em stat_change (side: 'you'|'foe')
        // pra achar golpes que o oponente revelou usando em combate
        if (event.side === 'foe') {
            const slug = findRevealedMoveSlug(event);
            if (slug) recordDiscoveredMove(slug);
        } else if (event.t && !KNOWN_EVENT_TYPES.includes(event.t)) {
            console.debug('[Pokemon Helper] evento de batalha não mapeado (ajuda a calibrar a detecção de golpes):', event);
        }
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

function matchupValue(attackerTypes, defenderTypes) {
    return Math.max(...attackerTypes.map((atk) => defMultiplier(atk, defenderTypes)));
}

function dualCombos() {
    const combos = [];
    for (let i = 0; i < TYPES.length; i++) {
        for (let j = i + 1; j < TYPES.length; j++) combos.push([TYPES[i], TYPES[j]]);
    }
    return combos;
}

// um combo de defesa dupla [a,b] só vale a pena mostrar quando o resultado
// combinado foge do que dava pra prever olhando cada tipo individualmente:
// imunidade causada por um dos tipos, ou os dois tipos sendo simultaneamente
// não-neutros (cancelamento de fraqueza/resistência, ou empilhamento pra 4×/¼×).
// se um dos dois é neutro (1×) o combinado é sempre igual ao do outro tipo
// sozinho — nesse caso não há informação nova, então não é exibido.
function isDualDefenseException(combo, attackerTypes) {
    const [a, b] = combo;
    const overall = matchupValue(attackerTypes, combo);
    return attackerTypes.some((atk) => {
        if (defMultiplier(atk, combo) !== overall) return false;
        const va = defMultiplier(atk, [a]);
        const vb = defMultiplier(atk, [b]);
        return va === 0 || vb === 0 || (va !== 1 && vb !== 1);
    });
}

// mapeamento direto de multiplicador -> cor: quanto maior o dano, mais verde
// (vale tanto pra "quanto eu bato nele" quanto pra "quanto ele bate", já que em
// ambas as listas um número alto é um golpe forte acontecendo)
function favClass(value) {
    if (value === 0) return 'fx-immune';
    if (value < 1) return 'fx-bad';
    if (value === 1) return 'fx-neutral';
    if (value <= 2) return 'fx-good';
    return 'fx-great';
}

function groupByValue(entries) {
    const groups = new Map();
    entries.forEach(({ combo, value }) => {
        if (!groups.has(value)) groups.set(value, []);
        groups.get(value).push(combo);
    });
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
}

function renderMatchupList(entries) {
    return groupByValue(entries).filter(([value]) => value !== 1).map(([value, combos]) => {
        const types = combos.map((combo) => typeTagHTML(combo, { stack: true })).join('');
        return `<div class="matchup-value-group">` +
            `<div class="matchup-value-label ${favClass(value)}">${multLabel(value)}</div>` +
            `<div class="matchup-value-types">${types}</div>` +
            `</div>`;
    }).join('');
}

const moveLabel = (slug) => slug.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

// o jogo não revela o moveset do oponente na batalha, então inferimos os golpes
// prováveis a partir do learnset por nível da Pokédex (data/move-types.js dá o
// tipo de cada golpe) — pegamos os golpes de nível <= nível atual e ficamos com
// os 4 aprendidos mais recentemente, como faria um Pokémon selvagem/treinador real.
function probableMoves(foe) {
    const entry = pokedexBySlug.get(normalizeSpecies(foe.species || foe.name));
    const level = Number(foe.level) || 0;
    const learned = (entry?.levelMoves || [])
        .filter((move) => move.lv <= level && MOVE_TYPES[move.slug])
        .sort((a, b) => a.lv - b.lv);
    const uniqueBySlug = new Map(learned.map((move) => [move.slug, move]));
    return [...uniqueBySlug.values()].slice(-4).map((move) => ({ slug: move.slug, type: MOVE_TYPES[move.slug] }));
}

function movesWithTypes(slugs) {
    return slugs.map((slug) => ({ slug, type: MOVE_TYPES[slug] })).filter((move) => move.type);
}

// moveset real de um treinador da wiki (data/trainer-moves.js), casando por
// espécie+nível — bem mais confiável que a heurística de nível quando existe.
function trainerMovesFor(foe) {
    const key = `${normalizeSpecies(foe.species || foe.name)}|${Number(foe.level)}`;
    return trainerMovesByKey.get(key) || null;
}

// identifica um "oponente recorrente" por espécie+nível (o jogo não expõe
// id/nome de treinador nem um identificador de mapa confiável, então essa é a
// melhor aproximação disponível — pode confundir dois treinadores diferentes
// com o mesmo Pokémon no mesmo nível, mas é o que dá pra fazer sem esse dado).
function discoveryKey(species, level) {
    return `${normalizeSpecies(species)}|${Number(level)}`;
}

function discoveredMovesFor(foe) {
    return discoveredMovesByKey.get(discoveryKey(foe.species || foe.name, foe.level)) || null;
}

// golpe visto de fato num turno de batalha: guarda permanentemente vinculado
// a esse oponente recorrente (espécie+nível), mesmo que a luta atual seja
// perdida — na próxima vez que ele aparecer, já mostramos o que já vimos.
function recordDiscoveredMove(slug) {
    if (!state.foe || !MOVE_TYPES[slug]) return;
    const key = discoveryKey(state.foe.species || state.foe.name, state.foe.level);
    const existing = discoveredMovesByKey.get(key) || [];
    if (existing.includes(slug)) return;
    discoveredMovesByKey.set(key, [...existing, slug]);
    saveDiscoveredMoves();
    render();
}

// resolve os golpes do oponente na seguinte ordem de prioridade:
// 1) golpes já vistos em batalhas anteriores contra esse mesmo oponente recorrente;
// 2) moveset exato de treinador (quando é batalha de treinador e casa espécie+nível);
// 3) heurística por nível (fallback pra selvagens/sem dados de treinador).
function resolveFoeMoves(foe) {
    const discovered = discoveredMovesFor(foe);
    if (discovered?.length) return { source: 'discovered', moves: movesWithTypes(discovered), seenCount: discovered.length };
    if (state.kind === 'trainer') {
        const trainerSlugs = trainerMovesFor(foe);
        if (trainerSlugs) return { source: 'trainer', moves: movesWithTypes(trainerSlugs) };
    }
    return { source: 'heuristic', moves: probableMoves(foe) };
}

const knownMoveTypes = (foe) => [...new Set(resolveFoeMoves(foe).moves.map((move) => move.type))];

const MOVE_SOURCE_LABELS = {
    discovered: 'Visto em batalhas anteriores contra esse mesmo oponente.',
    trainer: 'Confirmado: moveset exato desse treinador, vindo da wiki.',
    heuristic: 'Estimado pelo nível do Pokémon — ainda sem dados exatos.'
};

const infoIcon = (text) => `<span class="info-icon" tabindex="0" title="${escapeHtml(text)}">i</span>`;

// mesma tabela de valor->cor/rótulo (½×, 2×, 0× etc.) já usada nas listas
// Ataque/Defesa, agora aplicada por golpe individual: coluna do multiplicador
// ao lado da coluna dos tipos que levam esse multiplicador.
function renderMoveEffTable(moveType) {
    const entries = TYPES.map((type) => ({ combo: [type], value: defMultiplier(moveType, [type]) }));
    const groups = groupByValue(entries).filter(([value]) => value !== 1);
    if (!groups.length) return `<span class="move-eff-empty">sem interação especial</span>`;
    return `<div class="move-eff-table">` + groups.map(([value, combos]) => {
        const types = combos.map((combo) => typeTagHTML(combo, { stack: true })).join('');
        return `<div class="move-eff-row"><span class="move-eff-value ${favClass(value)}">${multLabel(value)}</span><div class="move-eff-types">${types}</div></div>`;
    }).join('') + `</div>`;
}

const MOVE_CATEGORY_LABELS = { physical: 'Físico', special: 'Especial', status: 'Status' };

// tooltip nativo (title) com poder/precisão/PP/categoria/efeito — dados vêm
// de data/move-details.js (PokeAPI); texto de efeito fica em inglês porque
// não há tradução oficial disponível.
function moveTooltip(slug) {
    const details = MOVE_DETAILS[slug];
    if (!details) return moveLabel(slug);
    const category = MOVE_CATEGORY_LABELS[details.category] || details.category || '?';
    const power = details.power ?? '—';
    const accuracy = details.accuracy != null ? `${details.accuracy}%` : '—';
    const pp = details.pp ?? '—';
    const lines = [moveLabel(slug), `Categoria: ${category}`, `Poder: ${power} · Precisão: ${accuracy} · PP: ${pp}`];
    if (details.effect) lines.push(details.effect);
    return lines.join('\n');
}

function renderMoveCard(move) {
    const eff = STATUS_MOVES.has(move.slug)
        ? `<span class="move-eff-empty">golpe de status</span>`
        : renderMoveEffTable(move.type);
    return `<div class="move-row">` +
        typeTagHTML(move.type, { stack: true, label: escapeHtml(moveLabel(move.slug)), title: escapeHtml(moveTooltip(move.slug)) }) +
        eff +
        `</div>`;
}

function renderFoeMoves(foe) {
    const resolved = resolveFoeMoves(foe);
    const cards = resolved.moves.map(renderMoveCard).join('');
    const partialHint = resolved.source === 'discovered' && resolved.seenCount < 4 ? ` (${resolved.seenCount}/4 vistos até agora)` : '';
    const infoText = MOVE_SOURCE_LABELS[resolved.source] + partialHint;
    return `<h3>Golpes do oponente ${infoIcon(infoText)}</h3>` +
        (cards ? `<div class="move-rows">${cards}</div>` : `<p class="empty">Nenhum golpe conhecido.</p>`);
}

function renderMatchupModal(foe) {
    if (!matchupModalOpen) return '';
    const foeTypes = typeNames(foe.types);
    const moveTypes = knownMoveTypes(foe);
    // "Defesa" deve refletir com o que ele realmente ataca, não só o tipo dele —
    // um golpe de cobertura muda completamente o que é ameaça. Só cai pro tipo
    // base se nenhum golpe foi revelado ainda.
    const foeAttackTypes = moveTypes.length ? moveTypes : foeTypes;
    const singles = TYPES.map((type) => [type]);
    // tipos duplos de atacante nunca trazem informação nova aqui: o resultado é
    // sempre o máximo entre os dois tipos únicos, que já aparecem na lista —
    // por isso a seção de Ataque nunca lista combos duplos.
    const myAttack = singles.map((combo) => ({ combo, value: matchupValue(combo, foeTypes) })).sort((a, b) => b.value - a.value);
    // "Defesa": o que o oponente ataca bem — os tipos que ele ameaça, não como ele se defende.
    // aqui tipos duplos SÃO relevantes (a combinação multiplica), mas só exibimos as exceções.
    const dualDefense = matchupIncludeDual ? dualCombos().filter((combo) => isDualDefenseException(combo, foeAttackTypes)) : [];
    const foeAttack = singles.concat(dualDefense).map((combo) => ({ combo, value: matchupValue(foeAttackTypes, combo) })).sort((a, b) => b.value - a.value);
    const defesaHint = moveTypes.length ? 'Baseado nos golpes do oponente.' : 'Baseado no tipo dele — ainda sem golpes conhecidos.';
    return `<div class="matchup-modal-backdrop">` +
        `<div class="matchup-modal">` +
        `<div class="matchup-modal-header"><button type="button" class="pxl-btn pxl-btn-sm pxl-btn-accent" data-action="close-matchup-modal">← Voltar</button></div>` +
        `<h2>Vantagens de tipo</h2>` +
        renderFoeMoves(foe) +
        `<label class="matchup-toggle"><input type="checkbox" data-action="toggle-matchup-dual"${matchupIncludeDual ? ' checked' : ''}> Incluir tipos duplos</label>` +
        `<h3>Ataque ${infoIcon('Quanto de dano você causa nele.')}</h3><div class="matchup-detail-list">${renderMatchupList(myAttack)}</div>` +
        `<h3>Defesa ${infoIcon('O que ele ataca bem. ' + defesaHint)}</h3><div class="matchup-detail-list">${renderMatchupList(foeAttack)}</div>` +
        `</div></div>`;
}

function renderMatchups(foe) {
    const foeTypes = typeNames(foe.types);
    if (!foeTypes.length) return '';
    return `<div class="row"><button type="button" class="pxl-btn pxl-btn-sm pxl-btn-accent pxl-btn-block" data-action="open-matchup-modal">Detalhes de movimentos e tipo</button></div>` +
        renderMatchupModal(foe);
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
    html += renderMatchups(foe);
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

async function loadTrainerMoves() {
    try {
        const cached = await PokemonHelperStorage.getTrainerMoves();
        trainerMovesByKey = new Map((cached.items || []).map((item) => [`${normalizeSpecies(item.species)}|${item.level}`, item.moves]));
        render();
        chrome.runtime.sendMessage({ type:'pkmn-helper-refresh-trainer-moves' });
    } catch (error) {
        console.warn('[Pokemon Helper] Não foi possível carregar golpes de treinadores:', error);
    }
}

async function loadDiscoveredMoves() {
    try {
        const cached = await PokemonHelperStorage.getDiscoveredMoves();
        discoveredMovesByKey = new Map((cached.items || []).map((item) => [discoveryKey(item.species, item.level), item.moves]));
        render();
    } catch (error) {
        console.warn('[Pokemon Helper] Não foi possível carregar golpes descobertos:', error);
    }
}

async function saveDiscoveredMoves() {
    try {
        const items = [...discoveredMovesByKey.entries()].map(([key, moves]) => {
            const [species, level] = key.split('|');
            return { species, level: Number(level), moves };
        });
        await PokemonHelperStorage.setDiscoveredMoves({ items });
    } catch (error) {
        console.warn('[Pokemon Helper] Não foi possível salvar golpes descobertos:', error);
    }
}

window.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== 'battle-data') return;
    updateBattle(event.data.payload);
    render();
});

document.getElementById('content').addEventListener('click', (event) => {
    if (event.target.closest('[data-action="open-matchup-modal"]')) { matchupModalOpen = true; render(); return; }
    if (event.target.closest('[data-action="close-matchup-modal"]')) { matchupModalOpen = false; render(); return; }
    if (event.target.matches('.matchup-modal-backdrop')) { matchupModalOpen = false; render(); }
});

document.getElementById('content').addEventListener('change', (event) => {
    if (!event.target.closest('[data-action="toggle-matchup-dual"]')) return;
    matchupIncludeDual = event.target.checked;
    render();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes[PokemonHelperStorage.KEYS.pokedex]) {
        const items = changes[PokemonHelperStorage.KEYS.pokedex].newValue?.items || [];
        pokedexBySlug = new Map(items.map((pokemon) => [normalizeSpecies(pokemon.slug || pokemon.name), pokemon]));
        render();
    }
    if (changes[PokemonHelperStorage.KEYS.trainerMoves]) {
        const items = changes[PokemonHelperStorage.KEYS.trainerMoves].newValue?.items || [];
        trainerMovesByKey = new Map(items.map((item) => [`${normalizeSpecies(item.species)}|${item.level}`, item.moves]));
        render();
    }
    if (changes[PokemonHelperStorage.KEYS.discoveredMoves]) {
        const items = changes[PokemonHelperStorage.KEYS.discoveredMoves].newValue?.items || [];
        discoveredMovesByKey = new Map(items.map((item) => [discoveryKey(item.species, item.level), item.moves]));
        render();
    }
});

loadPokedex();
loadTrainerMoves();
loadDiscoveredMoves();
