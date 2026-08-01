let LOCAL_PAYLOAD = {
    party: [],
    pc: []
};
const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
// TYPE_MAPPER e typeIconHTML vêm de components/type-tag.js

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function calculateIvPercent(ivs) {
    if (!ivs) {
        return 0;
    }

    const total = STAT_KEYS.reduce((sum, stat) => {
        const value = Number(ivs[stat] ?? 0);
        return sum + Math.min(Math.max(value, 0), 31);
    }, 0);

    return Math.round((total / (31 * STAT_KEYS.length)) * 100);
}

function formatToText(ability) {
    if (!ability) {
        return '—';
    }

    return ability
        .replace(/[-_]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function getGenderSymbol(gender) {
    const value = String(gender ?? '').toUpperCase();

    const male = {
        class: 'male',
        symbol: '♂️'
    };

    const female = {
        class: 'female',
        symbol: '♀️'
    };

    const genderMap = {
        'M': male,
        'MALE': male,
        'F': female,
        'FEMALE': female
    };

    if (value in genderMap) {
        return genderMap[value];
    }

    return { symbol: '—', class: '' };
}

function getPokemonName(pokemon) {
    return pokemon?.name || pokemon?.species || 'Desconhecido';
}

function countPokemon(list) {
    if (!Array.isArray(list)) {
        return 0;
    }

    return list.filter(Boolean).length;
}

function countPcPokemon(pc) {
    if (!Array.isArray(pc)) {
        return 0;
    }

    return pc.reduce((total, box) => {
        return total + countPokemon(box?.pokemon);
    }, 0);
}

function formatType(types) {
    if (!Array.isArray(types) || types.length === 0) {
        return '—';
    }

    const opts = { colored: true, title: true };
    if (types[0] !== types[1]) {
        return `${typeIconHTML(TYPE_MAPPER[types[0]], opts)} ${typeIconHTML(TYPE_MAPPER[types[1]], opts)}`;
    }

    return typeIconHTML(TYPE_MAPPER[types[0]], opts);
}

function renderPokemonCard(pokemon, options = {}) {
    if (!pokemon) {
        return '';
    }

    const {
        slot = null,
        location = 'party'
    } = options;

    const name = getPokemonName(pokemon);
    const level = pokemon.level ?? '—';
    const gender = getGenderSymbol(pokemon.gender);
    const nature = pokemon.nature || '—';
    const ability = formatToText(pokemon.ability);
    const ivPercent = calculateIvPercent(pokemon.ivs);
    const heldItem = formatToText(pokemon.heldItem) || '—';
    const type = formatType(pokemon.types);
    const shiny = pokemon.shiny ? '✨' : '';

    return `
        <div class="pokemon-card pokemon-card--${location}">
            <div class="pokemon-card-header">
                <div class="pokemon-name">
                    ${escapeHtml(name)}
                    ${type}
                </div>

                <div class="pokemon-level">
                    Lv. ${escapeHtml(level)}
                    <span class="pokemon-gender ${gender.class}">
                        ${gender.symbol}
                    </span>
                </div>
            </div>

            <div class="pokemon-card-body">

                <div class="pokemon-info-row">
                    <div class="pokemon-info">
                        <span class="pokemon-label">Natureza</span>
                        <span class="pokemon-value">
                            ${escapeHtml(nature)}
                        </span>
                    </div>

                    <div class="pokemon-info">
                        <span class="pokemon-label">Habilidade</span>
                        <span class="pokemon-value">
                            ${escapeHtml(ability)}
                        </span>
                    </div>

                    <div class="pokemon-info">
                        <span class="pokemon-label">IVs</span>
                        <span class="pokemon-value">
                            ${ivPercent}%
                        </span>
                    </div>
                </div>
                
            </div>

            ${
                slot !== null
                    ? `
                        <div class="pokemon-slot">
                            <span>Slot ${slot + 1}</span>
                            <span>${shiny}</span>
                            <span>Item: ${escapeHtml(heldItem)}</span>
                        </div>
                    `
                    : ''
            }
        </div>
    `;
}

function renderPokemonList(list, options = {}) {
    const {
        emptyMessage = 'Nenhum Pokémon encontrado.',
        location = 'party'
    } = options;

    if (!Array.isArray(list)) {
        return `<p class="empty">${emptyMessage}</p>`;
    }

    const html = list
        .map((pokemon, index) => {
            if (!pokemon) {
                return '';
            }

            return renderPokemonCard(pokemon, {
                slot: index,
                location
            });
        })
        .join('');

    if (!html.trim()) {
        return `<p class="empty">${emptyMessage}</p>`;
    }

    return `
        <div class="pokemon-list pokemon-list--${location}">
            ${html}
        </div>
    `;
}

function renderParty(party) {
    return `
        <section class="pokemon-section party-section">
            <div class="section-header">
                <h2 class="section-title">
                    Meu time
                </h2>

                <span class="section-counter">
                    ${countPokemon(party)}/6
                </span>
            </div>

            ${renderPokemonList(party, {
                emptyMessage: 'Nenhum Pokémon na Party.',
                location: 'party'
            })}
        </section>
    `;
}

function renderPcBoxes(pc) {
    if (!Array.isArray(pc) || pc.length === 0) {
        return `
            <p class="empty">
                Nenhuma caixa disponível.
            </p>
        `;
    }

    return pc
        .map((box, boxIndex) => {
            const boxName = box?.name || `Caixa ${boxIndex + 1}`;
            const pokemonList = Array.isArray(box?.pokemon)
                ? box.pokemon
                : [];

            return `
                <section class="pc-box pxl-panel">
                    <div class="pc-box-header">
                        <h3 class="pxl-heading pc-box-title">
                            ${escapeHtml(boxName)}
                        </h3>

                        <span class="pc-box-counter">
                            ${countPokemon(pokemonList)}/${pokemonList.length || 30}
                        </span>
                    </div>

                    ${renderPokemonList(pokemonList, {
                        emptyMessage: 'Esta caixa está vazia.',
                        location: 'pc'
                    })}
                </section>
            `;
        })
        .join('');
}

function render(data) {
    const content = document.getElementById('content');

    if (!content) {
        console.error('Elemento #content não foi encontrado.');
        return;
    }

    if (!data || typeof data !== 'object') {
        content.innerHTML = `
            <p class="empty">
                Nenhum dado de Pokémon disponível.
            </p>
        `;

        return;
    }

    const party = Array.isArray(data.party)
        ? data.party
        : [];

    const pc = Array.isArray(data.pc)
        ? data.pc
        : [];

    content.innerHTML = `
        ${renderParty(party)}

        <section class="pokemon-section pc-section">
            <div class="section-header">
                <h2 class="section-title">
                    Meu computador
                </h2>

                <span class="section-counter">
                    ${countPcPokemon(pc)} Pokémon
                </span>
            </div>

            <div class="pc-boxes">
                ${renderPcBoxes(pc)}
            </div>
        </section>
    `;
}

window.addEventListener('message', event => {
    const { type, payload } = event?.data;
    const hasData = payload.party?.length > 0 || payload.pc?.length > 0;
    if (type !== 'character-data' || !hasData) {
        return;
    }

    LOCAL_PAYLOAD = {
        party: payload.party,
        pc: payload.pc
    };

    render(LOCAL_PAYLOAD);
});