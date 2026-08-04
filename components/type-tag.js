// ---------------------------------------------------------------------------
// Componente de tipo de Pokémon: dados compartilhados (nomes, abreviações,
// ícones) e o template de tag/pill usado tanto na calculadora (index.html)
// quanto na tela de Meus Pokémons (myPokemons.html).
// ---------------------------------------------------------------------------

const TYPES = [
    'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
    'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'
];

const LABELS = {
    normal: 'Normal', fire: 'Fogo', water: 'Água', electric: 'Elétrico', grass: 'Planta',
    ice: 'Gelo', fighting: 'Lutador', poison: 'Venenoso', ground: 'Terra', flying: 'Voador',
    psychic: 'Psíquico', bug: 'Inseto', rock: 'Pedra', ghost: 'Fantasma', dragon: 'Dragão',
    dark: 'Sombrio', steel: 'Aço', fairy: 'Fada'
};

// abreviações oficiais de 3 letras (padrão de charts/telas de status dos jogos)
const ABBR = {
    normal: 'NRM', fire: 'FIR', water: 'WTR', electric: 'ELC', grass: 'GRS',
    ice: 'ICE', fighting: 'FGT', poison: 'PSN', ground: 'GRD', flying: 'FLY',
    psychic: 'PSY', bug: 'BUG', rock: 'RCK', ghost: 'GHO', dragon: 'DRG',
    dark: 'DRK', steel: 'STL', fairy: 'FRY'
};

// mapeia o id numérico de tipo usado pelo jogo para a chave de tipo (string)
const TYPE_MAPPER = {
    0: 'normal', 1: 'fighting', 2: 'flying', 3: 'poison', 4: 'ground',
    5: 'rock', 6: 'bug', 7: 'ghost', 8: 'steel', 10: 'fire',
    11: 'water', 12: 'grass', 13: 'electric', 14: 'psychic', 15: 'ice',
    16: 'dragon', 17: 'dark', 18: 'fairy'
};

// opts.colored usa o ícone com o círculo colorido (standalone); por padrão
// usa o glifo branco transparente, pensado pra ficar dentro do pill colorido.
function typeIconHTML(type, opts = {}) {
    const variant = opts.colored ? 'colored/' : '';
    const title = opts.title ? ` title="${LABELS[type]}"` : '';
    return `<img class="type-icon-img" src="icons/types/${variant}${type}.png" alt=""${title}>`;
}

// ---- componente de tag: uma única pill, sólida (1 tipo) ou com fundo em
// gradiente meio a meio (2 tipos) — mesma estrutura/classes pros dois casos,
// só muda o fundo e a quantidade de ícones/abreviações dentro.
// opts.abbr troca o nome completo pela abreviação de 3 letras
// opts.stack empilha ícone(s) (em cima) + abreviação (embaixo), como na tabela de referência
// opts.title troca o tooltip padrão (nome do tipo) por um texto customizado
function typeTagHTML(types, opts = {}) {
    if (!Array.isArray(types)) types = [types];
    const stacked = !!opts.stack;
    const dict = (opts.abbr || stacked) ? ABBR : LABELS;
    const cls = `type-tag${stacked ? ' mini' : ''}`;
    const background = types.length === 2
        ? `linear-gradient(135deg, var(--t-${types[0]}) 50%, var(--t-${types[1]}) 50%)`
        : `var(--t-${types[0]})`;
    const title = opts.title ?? types.map((type) => LABELS[type]).join(' / ');
    const icons = types.map((type) => typeIconHTML(type)).join('');
    const label = opts.label ?? types.map((type) => dict[type]).join(' / ');
    const labelHtml = stacked ? `<span class="abbr">${label}</span>` : label;
    return `<span class="${cls}" style="background:${background}" title="${title}">` +
        `<span class="icon">${icons}</span>${labelHtml}` +
        `</span>`;
}
