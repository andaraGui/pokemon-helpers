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
const openMoves = new Set();
// golpes que causam dano começam expandidos (uma única vez por slug — depois
// disso a escolha do usuário de fechar/abrir é respeitada)
const autoExpandedMoves = new Set();

// seções visíveis da tela (Configurações → TELAS → BATALHA)
let SCREEN_PREFS = Object.assign({}, PokemonHelperStorage.DEFAULT_UI_PREFERENCES.screens.battle);
PokemonHelperStorage.getUiPreferences()
    .then((prefs) => { SCREEN_PREFS = prefs.screens.battle; render(); })
    .catch(() => {});
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[PokemonHelperStorage.KEYS.uiPreferences]) return;
    PokemonHelperStorage.getUiPreferences()
        .then((prefs) => { SCREEN_PREFS = prefs.screens.battle; render(); })
        .catch(() => {});
});

const escapeHtml = (value) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const normalizeSpecies = (value) => String(value || '').trim().toLowerCase().replace(/[.']/g, '').replace(/[\s-]+/g, '_');
const typeNames = (types) => [...new Set((types || []).map((id) => TYPE_MAPPER[id] || String(id).toLowerCase()).filter(Boolean))];
const row = (label, value) => `<div class="row"><span class="label">${label}</span><span class="value">${value}</span></div>`;
// verde/amarelo/vermelho por faixa de IV (0-31), usado no grid IVS/STATS e na
// célula "IVS TOTAL" da grade meta
const ivColor = (iv) => iv >= 26 ? 'var(--px-good)' : iv >= 15 ? 'var(--px-mid)' : 'var(--px-bad)';

function resetBattle(battleId) {
    Object.assign(state, {
        battleId: battleId || null, kind: null, foe: null, foeParty: [], turn: 1,
        canCatch: false, moves: [], caught: false, over: false,
        active: { you: null, foe: null }, stages: { you: {}, foe: {} }
    });
}

// escolhe a melhor combinação Pokémon+golpe do time contra o oponente atual
// (potência × precisão × eficácia × STAB × ataque) e monta a caixa de destaque
function bestPlay(foe) {
    const defenders = typeNames(foe.types), candidates = [];
    state.party.filter(Boolean).forEach((pokemon, index) => {
        (pokemon.moves || []).forEach((move, moveIndex) => {
            if (Number(move.pp) <= 0 || Number(move.power) <= 0) return;
            const moveType = TYPE_MAPPER[move.type];
            const multiplier = defMultiplier(moveType, defenders);
            const stab = typeNames(pokemon.types).includes(moveType) ? 1.5 : 1;
            const attack = move.category === 'special' ? Number(pokemon.stats?.spa || 1) : Number(pokemon.stats?.atk || 1);
            candidates.push({ pokemon, index, move, moveIndex, multiplier, score:Number(move.power) * (Number(move.accuracy) || 100) / 100 * multiplier * stab * attack });
        });
    });
    candidates.sort((left, right) => right.score - left.score);
    const best = candidates[0];
    if (!best) return '';
    const moveType = TYPE_MAPPER[best.move.type];
    const hasStab = typeNames(best.pokemon.types).includes(moveType);
    const typeBg = PokemonPixelIcons.typeColor(moveType);
    const fg = PokemonPixelIcons.onColor(typeBg);
    const multBadge = best.multiplier !== 1
        ? `<span class="best-badge ${multClass(best.multiplier)}" data-tip="${best.multiplier > 1 ? 'Super eficaz' : 'Pouco eficaz'} contra o oponente.">${multLabel(best.multiplier)}</span>`
        : '';
    return `<div class="best-box">
        <div class="best-head">MELHOR JOGADA ${PokemonHelperTooltip.iconHTML('Melhor combinação de Pokémon e golpe do seu time contra este oponente (potência × precisão × eficácia × STAB × ataque).')}</div>
        <div class="best-row">
            <div class="best-detail">
                <div class="best-mon">${escapeHtml(best.pokemon.name || best.pokemon.species)} — slot ${best.index + 1}</div>
                <div class="best-line">
                    <span class="type-tag" style="background:${typeBg};color:${fg}" data-tip="${escapeHtml(best.move.name)} está no slot ${best.moveIndex + 1} de golpes">
                        ${PokemonPixelIcons.typeIcon(moveType, fg)}<span class="abbr">${escapeHtml(best.move.name)}</span><span class="slot-num" style="color:${fg}">${best.moveIndex + 1}</span>
                    </span>
                    <span class="best-badges">
                        ${multBadge}
                        <span class="best-badge badge-neutral" data-tip="Potência base do golpe.">POT ${best.move.power}</span>
                        ${hasStab ? '<span class="best-badge badge-stab" data-tip="STAB: +50% de dano porque o golpe é do mesmo tipo do Pokémon.">STAB</span>' : ''}
                    </span>
                </div>
            </div>
        </div>
    </div>`;
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
    const sections = [['you','SEUS ATRIBUTOS ALTERADOS'], ['foe','ATRIBUTOS ALTERADOS DO OPONENTE']];
    return sections.map(([side,title]) => {
        const values = Object.entries(state.stages[side]).filter(([,value]) => Number(value) !== 0);
        if (!values.length) return '';
        return `<div class="section"><div class="section-head"><span class="px-label">${title}</span></div><div class="rows">` +
            values.map(([key,value]) => row(STAGE_LABELS[key] || escapeHtml(key), `<span class="stage ${value > 0 ? 'up' : 'down'}">${value > 0 ? '+' : ''}${value}</span>`)).join('') +
            '</div></div>';
    }).join('');
}

function groupByValue(entries) {
    const groups = new Map();
    entries.forEach(({ combo, value }) => {
        if (!groups.has(value)) groups.set(value, []);
        groups.get(value).push(combo);
    });
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
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

// resolve os golpes do oponente mesclando as fontes (dedupe por slug, máx. 4):
// 1) golpes já vistos em batalhas anteriores contra esse mesmo oponente recorrente;
// 2) moveset exato de treinador (quando é batalha de treinador e casa espécie+nível);
// 3) heurística por nível (fallback pra selvagens/sem dados de treinador).
// Cada golpe carrega sua origem — confirmados ganham selo VISTO na renderização.
// Mesclar (em vez de substituir pela fonte de maior prioridade) garante que a
// lista nunca encolhe no meio da luta quando um golpe é confirmado.
function resolveFoeMoves(foe) {
    const discovered = discoveredMovesFor(foe) || [];
    const merged = [];
    const seen = new Set();
    const push = (moves, source) => moves.forEach((move) => {
        if (merged.length >= 4 || seen.has(move.slug)) return;
        seen.add(move.slug);
        merged.push({ ...move, source });
    });
    push(movesWithTypes(discovered), 'discovered');
    if (state.kind === 'trainer') push(movesWithTypes(trainerMovesFor(foe) || []), 'trainer');
    push(probableMoves(foe), 'heuristic');
    return { moves: merged, seenCount: discovered.length };
}

const MOVE_SOURCE_LABELS = {
    discovered: 'Visto em batalhas anteriores contra esse mesmo oponente.',
    trainer: 'Confirmado: moveset exato desse treinador, vindo da wiki.',
    heuristic: 'Estimado pelo nível do Pokémon — ainda sem dados exatos.'
};

// texto do ⓘ do cabeçalho GOLPES DELE: fonte única usa o rótulo existente;
// lista mista enumera só as fontes realmente presentes
function foeMovesHint(resolved) {
    const sources = new Set(resolved.moves.map((move) => move.source));
    if (sources.size <= 1) return MOVE_SOURCE_LABELS[resolved.moves[0]?.source] || '';
    const parts = [];
    if (sources.has('discovered')) parts.push(`${resolved.seenCount} confirmado(s) em batalha (selo VISTO)`);
    if (sources.has('trainer')) parts.push('moveset do treinador (wiki)');
    if (sources.has('heuristic')) parts.push('estimados pelo nível');
    return `Mistura de fontes: ${parts.join(' + ')}.`;
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

// tipos que causam dano extra no oponente (resistências/imunidades ficam de fora)
function renderWeaknesses(foe) {
    const foeTypes = typeNames(foe.types);
    if (!foeTypes.length) return '';
    const weak = TYPES
        .map((type) => ({ type, value: defMultiplier(type, foeTypes) }))
        .filter((entry) => entry.value > 1)
        .sort((a, b) => b.value - a.value);
    if (!weak.length) return '';
    const chips = weak.map(({ type, value }) =>
        typeTagHTML(type, { title: `${LABELS[type]} causa ${multLabel(value)} de dano nele.` })).join('');
    return `<div class="section">
        <div class="section-head"><span class="px-label">FRAQUEZAS DELE</span>${PokemonHelperTooltip.iconHTML('Tipos que causam dano extra nele. Resistências e imunidades ficam de fora.')}</div>
        <div class="chip-row">${chips}</div>
    </div>`;
}

// pior caso contra o meu time: maior multiplicador desse golpe contra
// qualquer Pokémon do meu time
function moveWorstCase(moveType) {
    const values = state.party.filter(Boolean).map((pokemon) => defMultiplier(moveType, typeNames(pokemon.types)));
    return values.length ? Math.max(...values) : null;
}

function renderFoeMoves(foe) {
    const resolved = resolveFoeMoves(foe);
    if (!resolved.moves.length) return '';
    const sourceHint = foeMovesHint(resolved);
    const items = resolved.moves.map((move) => {
        const isStatus = STATUS_MOVES.has(move.slug);
        if (!isStatus && !autoExpandedMoves.has(move.slug)) {
            autoExpandedMoves.add(move.slug);
            openMoves.add(move.slug);
        }
        const open = openMoves.has(move.slug);
        const typeBg = PokemonPixelIcons.typeColor(move.type);
        const fg = PokemonPixelIcons.onColor(typeBg);
        const worst = isStatus ? null : moveWorstCase(move.type);
        const multChip = worst === null
            ? '<span class="move-mult mult-1">—</span>'
            : `<span class="move-mult ${multClass(worst)}" data-tip="Pior caso contra o seu time.">${multLabel(worst)}</span>`;
        const details = MOVE_DETAILS[move.slug];
        const sub = details
            ? `${MOVE_CATEGORY_LABELS[details.category] || '?'} · ${details.pp ?? '—'} PP`
            : (isStatus ? 'Status' : '');
        let detail = '';
        if (open) {
            const body = isStatus
                ? '<div class="status-note">Golpe de status — não causa dano.</div>'
                : renderEffRows(move.type);
            detail = `<div class="move-detail">${body}</div>`;
        }
        return `<div class="move-item">
            <div class="move-main" data-tip="${escapeHtml(moveTooltip(move.slug))}">
                <span class="move-type-box" style="background:${typeBg}">${PokemonPixelIcons.typeIcon(move.type, fg)}</span>
                <span class="move-info"><span class="move-name-row"><span class="move-name">${escapeHtml(moveLabel(move.slug))}</span>${move.source === 'discovered' ? '<span class="move-seen" data-tip="Golpe confirmado: visto em batalha contra esse oponente.">VISTO</span>' : ''}</span><span class="move-sub">${sub}</span></span>
                ${multChip}
                <button type="button" class="move-expand${open ? ' open' : ''}" data-action="toggle-move" data-slug="${move.slug}"
                    data-tip="${open ? 'Fechar' : 'Ver'} contra quais tipos ${escapeHtml(moveLabel(move.slug))} é forte ou fraco">${open ? '▾' : '▸'}</button>
            </div>
            ${detail}
        </div>`;
    }).join('');
    return `<div class="section">
        <div class="section-head"><span class="px-label">GOLPES DELE</span>${PokemonHelperTooltip.iconHTML(sourceHint)}</div>
        ${items}
    </div>`;
}

function renderEffRows(moveType) {
    const entries = TYPES.map((type) => ({ combo: [type], value: defMultiplier(moveType, [type]) }));
    const groups = groupByValue(entries).filter(([value]) => value !== 1);
    if (!groups.length) return '<div class="status-note">Sem interação especial.</div>';
    return groups.map(([value, combos]) =>
        `<div class="eff-row"><span class="eff-mult ${multClass(value)}">${multLabel(value)}</span>` +
        `<span class="eff-types">${combos.map((combo) => typeTagHTML(combo, { stack: true })).join('')}</span></div>`
    ).join('');
}

function renderBalls(foe) {
    if (!state.canCatch || state.kind === 'trainer') return '';
    const pokedex = pokedexBySlug.get(normalizeSpecies(foe.species || foe.name));
    const catchRate = Number(pokedex?.catchRate);
    const context = { types:typeNames(foe.types), level:foe.level, turn:state.turn };
    const balls = Object.entries(state.bag).map(([slug,quantity]) => ({ slug:PokemonCatchRate.normalizeSlug(slug), quantity:Number(quantity || 0) })).filter((item) => PokemonCatchRate.isBall(item.slug) && item.quantity > 0);
    if (!balls.length) return '';
    return `<div class="section"><div class="section-head"><span class="px-label">POKÉBOLAS</span></div><div class="rows">` +
        balls.map((ball) => {
            const definition = PokemonCatchRate.BALLS[ball.slug];
            const chance = PokemonCatchRate.chance({ hp:foe.hp, maxHp:foe.maxHp, catchRate, status:foe.status, ballMultiplier:PokemonCatchRate.multiplier(ball.slug, context) });
            return row(`${definition.name} ×${ball.quantity}`, `<span class="ball-rate">${chance === null ? '—' : `${chance.toFixed(1)}%`}</span>`);
        }).join('') +
        '</div></div>';
}

// sprite do oponente: mesma arte (PokeAPI dream-world) usada em Meus Pokémon;
// POKEMON_NAME_TO_ID casa por nome de exibição, então tentamos name e species
// (inclusive com _/- viram espaço) antes de cair no placeholder
const SPRITE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/dream-world/';
function foeSpriteId(foe) {
    if (typeof POKEMON_NAME_TO_ID === 'undefined') return null;
    for (const value of [foe.name, foe.species]) {
        if (!value) continue;
        const key = String(value).trim().toLowerCase();
        const id = POKEMON_NAME_TO_ID[key] || POKEMON_NAME_TO_ID[key.replace(/[_-]+/g, ' ')];
        if (id) return id;
    }
    return null;
}

function render() {
    const content = document.getElementById('content'), foe = state.foe;
    if (!foe) { content.innerHTML = '<p class="empty">Nenhum encontro capturado ainda. Entre em uma batalha selvagem.</p>'; return; }
    const stats = foe.stats || {}, ivs = foe.ivs || {}, evaluation = PokemonIvEvaluation.evaluate(foe);
    const foeTypes = typeNames(foe.types);
    const hpPct = foe.maxHp > 0 ? Math.max(0, Math.min(100, foe.hp / foe.maxHp * 100)) : 0;
    const hpLevel = hpPct <= 20 ? 'low' : hpPct <= 50 ? 'mid' : 'high';
    const genderValue = String(foe.gender || '').toLowerCase();
    const gender = ['female', 'f', '♀'].includes(genderValue)
        ? '<span class="enc-gender-f">♀</span>'
        : ['male', 'm', '♂'].includes(genderValue)
            ? '<span class="enc-gender-m">♂</span>'
            : '';

    const spriteId = foeSpriteId(foe);
    const sprite = spriteId
        ? `<img class="enc-sprite" src="${SPRITE_URL}${spriteId}.svg" alt="${escapeHtml(foe.name || foe.species)}">`
        : '<div class="enc-sprite">?</div>';
    const head = `<div class="enc-head">
        ${sprite}
        <div class="enc-id">
            <div class="enc-name-row">
                <span class="enc-name">${escapeHtml(foe.name || foe.species)}</span>
                <span class="enc-level">Lv${foe.level ?? '-'}</span>${gender}
                ${foe.shiny ? '<span class="best-badge badge-stab" data-tip="Shiny!">★</span>' : ''}
            </div>
            <div class="enc-types">${foeTypes.map((type) => typeTagHTML(type)).join('')}</div>
            <div class="enc-hp">
                <div class="enc-hp-track"><div class="enc-hp-fill" data-level="${hpLevel}" style="width:${hpPct}%"></div></div>
                <span class="enc-hp-label">${Number(foe.hp || 0)}/${Number(foe.maxHp || 0)}</span>
            </div>
        </div>
    </div>`;

    const metaCell = (key, value, tip, color) =>
        `<div class="meta-cell" data-tip="${escapeHtml(tip)}"><span class="meta-key">${key}</span><span class="meta-val"${color ? ` style="color:${color}"` : ''}>${value}</span></div>`;
    const meta = `<div class="meta-grid">
        ${metaCell('HABILIDADE', `<span data-ability="${escapeHtml(foe.ability)}">${escapeHtml(PokemonAbilityInfo.label(foe.ability))}</span>`, 'Habilidade do oponente.')}
        ${metaCell('NATUREZA', natureEffectHTML(foe.nature), 'Natureza e atributos afetados.')}
        ${metaCell('ITEM', escapeHtml(foe.heldItem || '—'), foe.heldItem ? 'Item segurado.' : 'Nenhum item detectado neste encontro.', foe.heldItem ? null : 'var(--px-text-dim)')}
        ${metaCell('ATQ PRINCIPAL', evaluation.role, 'Estimado pelo maior stat ofensivo.')}
        ${metaCell('AVALIAÇÃO', PokemonIvEvaluation.html(foe), 'Avaliação combinando IVs, natureza e stats base.')}
        ${metaCell('IVS TOTAL', `${evaluation.percent}%`, 'Percentual dos IVs em relação ao máximo.', ivColor(evaluation.percent * 31 / 100))}
    </div>`;

    const ivsSection = `<div class="section">
        <div class="section-head"><span class="px-label">IVS / STATS</span><span class="head-extra" style="color:${ivColor(evaluation.percent * 31 / 100)}">${evaluation.percent}%</span></div>
        <div class="ivs-grid6">${STAT_KEYS.filter((key) => ivs[key] !== undefined).map((key) => `
            <div class="iv-cell" data-tip="${key.toUpperCase()} — IV ${ivs[key]}/31${stats[key] !== undefined ? ` · stat atual ${stats[key]}` : ''}">
                <span class="iv-key">${key.toUpperCase()}</span>
                <span class="px-bar"><span class="px-bar-fill" style="width:${Math.round(ivs[key] / 31 * 100)}%;background:${ivColor(ivs[key])}"></span></span>
                <span class="iv-num" style="color:${ivColor(ivs[key])}">${ivs[key]}</span>
                ${stats[key] !== undefined ? `<span class="iv-stat">${stats[key]}</span>` : ''}
            </div>`).join('')}</div>
    </div>`;

    let html = `<div class="enc-screen">` + head + meta + (SCREEN_PREFS.showIvs ? ivsSection : '');
    if (!state.caught) html += bestPlay(foe);
    if (SCREEN_PREFS.showWeaknesses) html += renderWeaknesses(foe);
    if (SCREEN_PREFS.showFoeMoves) html += renderFoeMoves(foe);
    if (SCREEN_PREFS.showPokeballs) html += renderBalls(foe);
    if (SCREEN_PREFS.showStatChanges) html += renderStages();
    if (state.caught) html += '<div class="gotcha"><span class="gotcha-badge">GOTCHA</span><p>Pokémon capturado</p></div>';
    else if (SCREEN_PREFS.showMyMoves && state.moves.length) html += `<div class="section"><div class="section-head"><span class="px-label">SEUS GOLPES</span></div><div class="rows">` +
        state.moves.map((move) => `<div class="row"><span class="label">${escapeHtml(move.name)}</span><span class="value">${move.pp} PP</span></div>`).join('') + '</div></div>';
    html += `</div>`;
    content.innerHTML = html;
    // sprite pode não existir no repositório (formas regionais etc.) — volta
    // pro placeholder em vez de mostrar o ícone de imagem quebrada
    content.querySelectorAll('img.enc-sprite').forEach((img) => img.addEventListener('error', () => {
        const fallback = document.createElement('div');
        fallback.className = 'enc-sprite';
        fallback.textContent = '?';
        img.replaceWith(fallback);
    }));
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
    const btn = event.target.closest('[data-action="toggle-move"]');
    if (!btn) return;
    const slug = btn.dataset.slug;
    if (openMoves.has(slug)) openMoves.delete(slug); else openMoves.add(slug);
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
