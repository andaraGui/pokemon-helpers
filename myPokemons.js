let LOCAL_PAYLOAD = { party: [], pc: [] };

const ICON_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/dream-world/';
const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

const DATA_STATE = {
    sourcePokemon: [],
    filteredPokemon: [],
    groups: []
};

const FILTER_STATE = {
    advancedEnabled: false,
    liveName: '',
    appliedName: '',
    applied: PokemonFilters.defaultValues(),
    isFiltering: false
};

const UI_STATE = {
    expandedGroups: new Set(),
    expandedPokemon: new Set(),
    knownGroups: new Set(),
    initialized: false
};

let filterController = null;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function calculateIvPercent(ivs) {
    const total = STAT_KEYS.reduce((sum, stat) => {
        const value = Number(ivs?.[stat] ?? 0);
        return sum + Math.min(Math.max(value, 0), 31);
    }, 0);
    return Math.round((total / (31 * STAT_KEYS.length)) * 100);
}

function ivLevel(iv) {
    return iv <= 15 ? 'low' : iv <= 25 ? 'mid' : 'high';
}

function formatToText(value) {
    if (!value) return '—';
    return String(value)
        .replace(/[-_]/g, ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function getGenderSymbol(gender) {
    const value = String(gender ?? '').toUpperCase();
    const genders = {
        M: { class: 'male', symbol: '♂️' },
        MALE: { class: 'male', symbol: '♂️' },
        F: { class: 'female', symbol: '♀️' },
        FEMALE: { class: 'female', symbol: '♀️' }
    };
    return genders[value] || { symbol: '—', class: '' };
}

function getPokemonName(pokemon) {
    return pokemon?.name || pokemon?.species || 'Desconhecido';
}

function normalizeSearch(value) {
    return String(value ?? '').trim().toLocaleLowerCase('pt-BR');
}

function getPokemonId(name) {
    return POKEMON_NAME_TO_ID[name.toLowerCase()] || null;
}

function normalizeMoves(moves) {
    if (!Array.isArray(moves)) return [];
    return moves.filter(Boolean).map((move) => ({
        name: move.name || 'Desconhecido',
        typeKey: TYPE_MAPPER[move.type] || null,
        category: formatToText(move.category)
    }));
}

function createPokemonViewModel(pokemon, location) {
    const name = getPokemonName(pokemon);
    const typeKeys = [...new Set((pokemon.types || []).map((type) => TYPE_MAPPER[type]).filter(Boolean))];
    const natureName = pokemon.nature || '—';
    const pokemonId = getPokemonId(name);

    return {
        pokemon,
        key: location.key,
        groupKey: location.groupKey,
        location: location.kind,
        boxIndex: location.boxIndex,
        slotIndex: location.slotIndex,
        slotLabel: location.kind === 'party'
            ? `Meu Time - Slot ${location.slotIndex + 1}`
            : `Cx.${location.boxIndex + 1} - Slot ${location.slotIndex + 1}`,
        sourceOrder: location.sourceOrder,
        name,
        normalizedName: normalizeSearch(name),
        pokemonId,
        iconUrl: pokemonId ? `${ICON_URL}${pokemonId}.svg` : null,
        gender: getGenderSymbol(pokemon.gender),
        level: Number(pokemon.level ?? 0),
        natureName,
        natureKey: normalizeSearch(natureName),
        natureEffect: getNatureEffect(natureName),
        ability: pokemon.ability,
        heldItem: formatToText(pokemon.heldItem),
        hasItem: pokemon.heldItem !== null && pokemon.heldItem !== undefined && pokemon.heldItem !== '',
        shiny: pokemon.shiny === true,
        ivs: Object.fromEntries(STAT_KEYS.map((stat) => [stat, Math.min(Math.max(Number(pokemon.ivs?.[stat] ?? 0), 0), 31)])),
        ivPercent: calculateIvPercent(pokemon.ivs),
        typeKeys,
        typeOrder: typeKeys.map((type) => TYPES.indexOf(type)),
        moves: normalizeMoves(pokemon.moves)
    };
}

function rebuildDataState(data) {
    const party = Array.isArray(data?.party) ? data.party : [];
    const pc = Array.isArray(data?.pc) ? data.pc : [];
    const groups = [{ key: 'party', kind: 'party', title: 'Meu time', capacity: 6, boxIndex: null }];
    const pokemon = [];
    let sourceOrder = 0;

    party.forEach((entry, slotIndex) => {
        if (!entry) return;
        pokemon.push(createPokemonViewModel(entry, {
            key: `party:${slotIndex}`,
            groupKey: 'party',
            kind: 'party',
            boxIndex: null,
            slotIndex,
            sourceOrder: sourceOrder++
        }));
    });

    pc.forEach((box, boxIndex) => {
        const list = Array.isArray(box?.pokemon) ? box.pokemon : [];
        const groupKey = `pc:${boxIndex}`;
        groups.push({
            key: groupKey,
            kind: 'pc',
            title: box?.name || `Caixa ${boxIndex + 1}`,
            capacity: list.length || 30,
            boxIndex
        });
        list.forEach((entry, slotIndex) => {
            if (!entry) return;
            pokemon.push(createPokemonViewModel(entry, {
                key: `pc:${boxIndex}:${slotIndex}`,
                groupKey,
                kind: 'pc',
                boxIndex,
                slotIndex,
                sourceOrder: sourceOrder++
            }));
        });
    });

    DATA_STATE.sourcePokemon = pokemon;
    DATA_STATE.groups = groups;
}

function hasAdvancedFilter(values) {
    return values.shinyOnly
        || values.itemOnly
        || values.types.length > 0
        || (values.natureMode === 'name' && values.natures.length > 0)
        || (values.natureMode === 'effect' && (
            values.neutralOnly || values.natureIncrease || values.natureDecrease
        ))
        || STAT_KEYS.some((stat) => values.ivMinimum[stat] > 0);
}

function pokemonPassesFilters(viewModel, nameQuery, values, advancedEnabled, compiled) {
    if (nameQuery && !viewModel.normalizedName.includes(nameQuery)) return false;
    if (!advancedEnabled) return true;
    if (values.shinyOnly && !viewModel.shiny) return false;
    if (values.itemOnly && !viewModel.hasItem) return false;

    if (values.types.length) {
        const matchesType = values.typeMode === 'all'
            ? values.types.every((type) => viewModel.typeKeys.includes(type))
            : values.types.some((type) => viewModel.typeKeys.includes(type));
        if (!matchesType) return false;
    }

    if (values.natureMode === 'name' && values.natures.length) {
        if (!compiled.natureKeys.has(viewModel.natureKey)) return false;
    }

    if (values.natureMode === 'effect') {
        const effect = viewModel.natureEffect;
        if (!effect) return false;
        if (values.neutralOnly) {
            if (effect.increases !== effect.decreases) return false;
        } else {
            if (values.natureIncrease && effect.increases !== values.natureIncrease) return false;
            if (values.natureDecrease && effect.decreases !== values.natureDecrease) return false;
        }
    }

    if (STAT_KEYS.some((stat) => viewModel.ivs[stat] < values.ivMinimum[stat])) return false;
    return true;
}

function compareTypeOrder(left, right) {
    const length = Math.max(left.typeOrder.length, right.typeOrder.length, 2);
    for (let index = 0; index < length; index += 1) {
        const leftOrder = left.typeOrder[index] ?? TYPES.length;
        const rightOrder = right.typeOrder[index] ?? TYPES.length;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    }
    return 0;
}

function createComparator(values) {
    const direction = values.sortDirection === 'desc' ? -1 : 1;
    return (left, right) => {
        let result = 0;
        switch (values.sortBy) {
            case 'level':
                result = (left.level - right.level) * direction;
                break;
            case 'name':
                result = left.normalizedName.localeCompare(right.normalizedName, 'pt-BR');
                break;
            case 'type':
                result = compareTypeOrder(left, right);
                break;
            case 'nature':
                result = left.natureKey.localeCompare(right.natureKey, 'pt-BR');
                break;
            case 'ivPercent':
                result = (left.ivPercent - right.ivPercent) * direction;
                break;
            default:
                result = left.sourceOrder - right.sourceOrder;
        }
        return result || left.sourceOrder - right.sourceOrder;
    };
}

function applyFilters() {
    const advancedEnabled = FILTER_STATE.advancedEnabled;
    const values = advancedEnabled ? FILTER_STATE.applied : PokemonFilters.defaultValues();
    const nameQuery = advancedEnabled ? FILTER_STATE.appliedName : FILTER_STATE.liveName;
    FILTER_STATE.isFiltering = Boolean(nameQuery) || (advancedEnabled && hasAdvancedFilter(values));

    const noProcessing = !FILTER_STATE.isFiltering
        && (!advancedEnabled || values.sortBy === 'position');
    if (noProcessing) {
        DATA_STATE.filteredPokemon = DATA_STATE.sourcePokemon;
        return;
    }

    const compiled = {
        natureKeys: new Set(values.natures.map(normalizeSearch))
    };

    DATA_STATE.filteredPokemon = DATA_STATE.sourcePokemon
        .filter((viewModel) => pokemonPassesFilters(viewModel, nameQuery, values, advancedEnabled, compiled))
        .sort(createComparator(values));
}

function formatTypeIcons(typeKeys) {
    if (!typeKeys.length) return '—';
    return typeKeys.map((type) => typeIconHTML(type, { colored: true, title: true })).join(' ');
}

function formatMoveType(typeKey) {
    return typeKey
        ? `<span class="pokemon-move-type">${typeIconHTML(typeKey, { colored: true, title: true })}</span>`
        : '<span class="pokemon-move-type move-type-missing">—</span>';
}

function syncUiState() {
    const groupKeys = DATA_STATE.groups.map((group) => group.key);
    const pokemonKeys = new Set(DATA_STATE.sourcePokemon.map((viewModel) => viewModel.key));
    groupKeys.forEach((key) => {
        if (!UI_STATE.initialized || !UI_STATE.knownGroups.has(key)) UI_STATE.expandedGroups.add(key);
    });
    UI_STATE.expandedGroups.forEach((key) => {
        if (!groupKeys.includes(key)) UI_STATE.expandedGroups.delete(key);
    });
    UI_STATE.expandedPokemon.forEach((key) => {
        if (!pokemonKeys.has(key)) UI_STATE.expandedPokemon.delete(key);
    });
    UI_STATE.knownGroups = new Set(groupKeys);
    UI_STATE.initialized = true;
}

function renderIvDetails(viewModel) {
    const evaluation = PokemonIvEvaluation.evaluate(viewModel.pokemon);
    return `
        <div class="pokemon-details-section">
            <h4>IVs</h4>
            <div class="pokemon-iv-grid">
                ${STAT_KEYS.map((stat) => `
                    <div class="pokemon-iv">
                        <span>${stat.toUpperCase()}</span>
                        <strong data-level="${ivLevel(viewModel.ivs[stat])}">${viewModel.ivs[stat]}</strong>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="pokemon-details-section pokemon-iv-assessment">
            <div class="pokemon-assessment-item"><span class="pokemon-assessment-label">${PokemonIvEvaluation.labelHTML()}</span><strong>${PokemonIvEvaluation.html(viewModel.pokemon)}</strong></div>
            <div class="pokemon-assessment-item"><span class="pokemon-assessment-label">Ataque (tipo principal)</span><strong>${evaluation.role}</strong></div>
        </div>
    `;
}

function renderMoveDetails(viewModel) {
    const content = viewModel.moves.length
        ? viewModel.moves.map((move) => `
            <div class="pokemon-move">
                <span class="pokemon-move-name">${escapeHtml(move.name)}</span>
                ${formatMoveType(move.typeKey)}
                <span class="pokemon-move-category">${escapeHtml(move.category)}</span>
            </div>
        `).join('')
        : '<p class="pokemon-details-empty">Nenhum golpe disponível.</p>';
    return `<div class="pokemon-details-section"><h4>Golpes</h4><div class="pokemon-moves">${content}</div></div>`;
}

function renderPokemonCard(viewModel) {
    const expanded = UI_STATE.expandedPokemon.has(viewModel.key);
    const detailsId = `pokemon-details-${viewModel.key.replace(/:/g, '-')}`;
    const icon = viewModel.iconUrl
        ? `<img class="pokemon-icon" src="${viewModel.iconUrl}" alt="${escapeHtml(viewModel.name)} icon">`
        : '<span class="pxl-pokeball pokemon-icon-fallback"></span>';

    return `
        <article class="pokemon-card pokemon-card--${viewModel.location} pxl-panel" data-pokemon-key="${viewModel.key}">
            <button type="button" class="pokemon-card-toggle" aria-expanded="${expanded}" aria-controls="${detailsId}">
                <span class="pokemon-name">${icon}<span class="pokemon-name-text">${escapeHtml(viewModel.name)}</span>${formatTypeIcons(viewModel.typeKeys)}</span>
                <span class="pokemon-level">Lv. ${viewModel.level || '—'}<span class="pokemon-gender ${viewModel.gender.class}">${viewModel.gender.symbol}</span><span class="expand-indicator" aria-hidden="true">${expanded ? '▼' : '▶'}</span></span>
            </button>

            <div class="pokemon-card-body">
                <div class="pokemon-info-row">
                    <div class="pokemon-info"><span class="pokemon-label">Natureza</span><span class="pokemon-value pokemon-nature-value">${natureEffectHTML(escapeHtml(viewModel.natureName))}</span></div>
                    <div class="pokemon-info"><span class="pokemon-label">Habilidade</span><span class="pokemon-value" data-ability="${escapeHtml(viewModel.ability)}">${escapeHtml(PokemonAbilityInfo.label(viewModel.ability))}</span></div>
                    <div class="pokemon-info pokemon-info--ivs"><span class="pokemon-label">IVs</span><span class="pokemon-value">${viewModel.ivPercent}%</span></div>
                </div>
            </div>

            <div class="pokemon-details" id="${detailsId}" ${expanded ? '' : 'hidden'}>${renderIvDetails(viewModel)}${renderMoveDetails(viewModel)}</div>
            <div class="pokemon-slot"><span>${escapeHtml(viewModel.slotLabel)}</span><span>${viewModel.shiny ? '✨' : ''}</span><span>Item: ${escapeHtml(viewModel.heldItem)}</span></div>
        </article>
    `;
}

function renderPokemonList(viewModels, location = 'all') {
    if (!viewModels.length) return '<p class="empty">Nenhum Pokémon encontrado.</p>';
    return `<div class="pokemon-list pokemon-list--${location}">${viewModels.map(renderPokemonCard).join('')}</div>`;
}

function renderCollapsibleGroup(group, viewModels, total) {
    const expanded = UI_STATE.expandedGroups.has(group.key);
    const contentId = `pokemon-group-${group.key.replace(/:/g, '-')}`;
    const counter = FILTER_STATE.isFiltering
        ? `${viewModels.length}/${total}`
        : `${total}/${group.capacity}`;
    return `
        <section class="pokemon-group ${group.kind === 'party' ? 'party-section' : 'pc-box'}" data-group-key="${group.key}">
            <button type="button" class="pokemon-group-toggle" aria-expanded="${expanded}" aria-controls="${contentId}">
                <span class="group-title"><span class="expand-indicator" aria-hidden="true">${expanded ? '▼' : '▶'}</span>${escapeHtml(group.title)}</span>
                <span class="group-counter">${counter}</span>
            </button>
            <div class="pokemon-group-content" id="${contentId}" ${expanded ? '' : 'hidden'}>${renderPokemonList(viewModels, group.kind)}</div>
        </section>
    `;
}

function renderGrouped() {
    const sourceByGroup = new Map(DATA_STATE.groups.map((group) => [group.key, []]));
    const filteredByGroup = new Map(DATA_STATE.groups.map((group) => [group.key, []]));
    DATA_STATE.sourcePokemon.forEach((viewModel) => sourceByGroup.get(viewModel.groupKey)?.push(viewModel));
    DATA_STATE.filteredPokemon.forEach((viewModel) => filteredByGroup.get(viewModel.groupKey)?.push(viewModel));
    const partyGroup = DATA_STATE.groups[0];
    const pcGroups = DATA_STATE.groups.slice(1);
    const party = renderCollapsibleGroup(
        partyGroup,
        filteredByGroup.get('party') || [],
        sourceByGroup.get('party')?.length || 0
    );
    const pcCount = DATA_STATE.filteredPokemon.filter((viewModel) => viewModel.location === 'pc').length;
    const pcTotal = DATA_STATE.sourcePokemon.filter((viewModel) => viewModel.location === 'pc').length;
    const pcBoxes = pcGroups.map((group) => {
        const filtered = filteredByGroup.get(group.key) || [];
        if (FILTER_STATE.isFiltering && filtered.length === 0) return '';
        return renderCollapsibleGroup(group, filtered, sourceByGroup.get(group.key)?.length || 0);
    }).join('');

    return `
        ${party}
        <section class="pokemon-section pc-section">
            <div class="section-header"><h2 class="section-title">Meu computador</h2><span class="section-counter">${FILTER_STATE.isFiltering ? `${pcCount}/${pcTotal}` : pcTotal} Pokémon</span></div>
            <div class="pc-boxes">${pcBoxes || '<p class="empty">Nenhum Pokémon do computador corresponde aos filtros.</p>'}</div>
        </section>
    `;
}

function renderFlat() {
    return `
        <section class="pokemon-section flat-pokemon-section">
            <div class="section-header"><h2 class="section-title">Todos os Pokémon</h2><span class="section-counter">${DATA_STATE.filteredPokemon.length}/${DATA_STATE.sourcePokemon.length}</span></div>
            ${renderPokemonList(DATA_STATE.filteredPokemon)}
        </section>
    `;
}

function syncGlobalControls() {
    const visibleKeys = DATA_STATE.filteredPokemon.map((viewModel) => viewModel.key);
    const groupKeys = DATA_STATE.groups.map((group) => group.key);
    const allGroupsExpanded = groupKeys.length > 0 && groupKeys.every((key) => UI_STATE.expandedGroups.has(key));
    const allPokemonExpanded = visibleKeys.length > 0 && visibleKeys.every((key) => UI_STATE.expandedPokemon.has(key));
    const removeGroups = FILTER_STATE.advancedEnabled && FILTER_STATE.applied.removeGroups;
    document.getElementById('expand-all-groups')?.setAttribute('aria-checked', String(allGroupsExpanded));
    document.getElementById('expand-all-pokemon')?.setAttribute('aria-checked', String(allPokemonExpanded));
    const groupToggleRow = document.getElementById('expand-all-groups-row');
    if (groupToggleRow) groupToggleRow.hidden = removeGroups;
}

function render() {
    const content = document.getElementById('content');
    if (!content) return;
    syncUiState();
    const removeGroups = FILTER_STATE.advancedEnabled && FILTER_STATE.applied.removeGroups;
    content.innerHTML = removeGroups ? renderFlat() : renderGrouped();
    PokemonAbilityInfo.hydrate(content);
    syncGlobalControls();
}

function applyAndRender() {
    applyFilters();
    render();
}

function toggleSetValue(set, key) {
    if (set.has(key)) set.delete(key);
    else set.add(key);
}

function bindControls() {
    const content = document.getElementById('content');
    const filterInput = document.getElementById('pokemon-name-filter');
    const advancedToggle = document.getElementById('toggle-advanced-filters');
    const advancedPanel = document.getElementById('pokemon-advanced-filters');
    const groupsToggle = document.getElementById('expand-all-groups');
    const pokemonToggle = document.getElementById('expand-all-pokemon');

    filterController = PokemonFilters.mount(advancedPanel, {
        onApply(values) {
            FILTER_STATE.applied = values;
            FILTER_STATE.appliedName = normalizeSearch(filterInput.value);
            applyAndRender();
        },
        onClear(values) {
            filterInput.value = '';
            FILTER_STATE.liveName = '';
            FILTER_STATE.appliedName = '';
            FILTER_STATE.applied = values;
            applyAndRender();
        }
    });

    advancedToggle.addEventListener('click', () => {
        FILTER_STATE.advancedEnabled = !FILTER_STATE.advancedEnabled;
        advancedToggle.setAttribute('aria-pressed', String(FILTER_STATE.advancedEnabled));
        advancedPanel.hidden = !FILTER_STATE.advancedEnabled;
        if (!FILTER_STATE.advancedEnabled) FILTER_STATE.liveName = normalizeSearch(filterInput.value);
        applyAndRender();
    });

    filterInput.addEventListener('input', () => {
        if (FILTER_STATE.advancedEnabled) return;
        FILTER_STATE.liveName = normalizeSearch(filterInput.value);
        applyAndRender();
    });

    groupsToggle.addEventListener('click', () => {
        const shouldExpand = groupsToggle.getAttribute('aria-checked') !== 'true';
        DATA_STATE.groups.forEach((group) => {
            if (shouldExpand) UI_STATE.expandedGroups.add(group.key);
            else UI_STATE.expandedGroups.delete(group.key);
        });
        render();
    });

    pokemonToggle.addEventListener('click', () => {
        const shouldExpand = pokemonToggle.getAttribute('aria-checked') !== 'true';
        DATA_STATE.filteredPokemon.forEach((viewModel) => {
            if (shouldExpand) UI_STATE.expandedPokemon.add(viewModel.key);
            else UI_STATE.expandedPokemon.delete(viewModel.key);
        });
        render();
    });

    content.addEventListener('click', (event) => {
        const groupButton = event.target.closest('.pokemon-group-toggle');
        if (groupButton) {
            const group = groupButton.closest('[data-group-key]');
            if (group) toggleSetValue(UI_STATE.expandedGroups, group.dataset.groupKey);
            render();
            return;
        }
        const pokemonButton = event.target.closest('.pokemon-card-toggle');
        if (pokemonButton) {
            const card = pokemonButton.closest('[data-pokemon-key]');
            if (card) toggleSetValue(UI_STATE.expandedPokemon, card.dataset.pokemonKey);
            render();
        }
    });
}

bindControls();

window.addEventListener('message', (event) => {
    const { type, payload } = event?.data || {};
    const hasData = payload?.party?.length > 0 || payload?.pc?.length > 0;
    if (type !== 'character-data' || !hasData) return;
    if (payload.pc?.length > 0) LOCAL_PAYLOAD.pc = payload.pc;
    if (payload.party?.length > 0) LOCAL_PAYLOAD.party = payload.party;
    rebuildDataState(LOCAL_PAYLOAD);
    applyAndRender();
});
