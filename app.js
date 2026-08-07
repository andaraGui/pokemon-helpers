// TYPES, LABELS, ABBR, typeIconHTML e typeTagHTML vêm de components/type-tag.js
// CHART, defMultiplier, multClass e multLabel vêm de components/type-chart-data.js

// todos os tipos possíveis: 18 puros + 153 combinações duplas
function allCombos() {
    const combos = TYPES.map(t => [t]);
    for (let i = 0; i < TYPES.length; i++) {
        for (let j = i + 1; j < TYPES.length; j++) combos.push([TYPES[i], TYPES[j]]);
    }
    return combos;
}
const COMBOS = allCombos();

// ---------- grid de tipos (botões pixel) ----------
const grid = document.getElementById('type-grid');
TYPES.forEach((type) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'type-cell';
    btn.dataset.type = type;
    btn.dataset.tip = LABELS[type];
    grid.appendChild(btn);
});

// pinta a grade conforme a seleção atual (cor do tipo, ícone, borda de destaque)
function paintGrid() {
    const selected = getSelectedTypes();
    grid.querySelectorAll('.type-cell').forEach((btn) => {
        const type = btn.dataset.type;
        const bg = PokemonPixelIcons.typeColor(type);
        const on = selected.includes(type);
        const fg = on ? PokemonPixelIcons.onColor(bg) : PokemonPixelIcons.mix(bg, '#ffffff', .45);
        btn.classList.toggle('selected', on);
        btn.style.background = on ? bg : PokemonPixelIcons.mix(bg, '#11111a', .2);
        btn.style.color = fg;
        btn.innerHTML = `${PokemonPixelIcons.typeIcon(type, fg)}<span>${ABBR[type]}</span>`;
    });
}

const hint = document.getElementById('hint');

// ---------- seleção do ALVO em memória (máx. 2 — o mais antigo cai) ----------
let selectedTypes = [];

function getSelectedTypes() {
    return selectedTypes;
}
function getMode() {
    return document.querySelector('.mode-btn.active').dataset.mode;
}
function includeDual() {
    return document.getElementById('include-dual').getAttribute('aria-pressed') === 'true';
}

// Aplica as regras de cada modo (só o botão 2T muda: combinações de dois
// tipos só existem no modo Defesa, já que um golpe é sempre mono-tipo) e
// atualiza chips/hint antes de recalcular.
function enforceModeConstraints() {
    const mode = getMode();
    const dualBtn = document.getElementById('include-dual');

    if (mode === 'ataque') {
        // aria-disabled (não a propriedade `disabled`) pra manter o botão
        // focável/hover-ável — senão o data-tip explicando o motivo nunca
        // dispara, já que elementos disabled não recebem eventos de mouse.
        dualBtn.setAttribute('aria-disabled', 'true');
        dualBtn.setAttribute('aria-pressed', 'false');
        dualBtn.dataset.tip = 'Só disponível no modo Defesa — um golpe é sempre de um tipo só.';
    } else {
        dualBtn.setAttribute('aria-disabled', 'false');
        dualBtn.dataset.tip = 'Incluir combinações de dois tipos (ex: Água/Voador)';
    }

    paintGrid();
    renderTargetChips();

    const n = selectedTypes.length;
    if (n === 0) {
        hint.textContent = 'Selecione ao menos um tipo acima.';
    } else if (mode === 'ataque') {
        hint.textContent = n === 1
            ? '1 tipo selecionado (alvo mono-tipo).'
            : '2 tipos selecionados (alvo dual-type).';
    } else {
        hint.textContent = `${n}/2 tipos de ataque selecionados (até 2).`;
    }

    calculate();
}

// preenche os chips do ALVO e o tooltip da linha com o resumo da seleção
function renderTargetChips() {
    const chips = document.getElementById('target-chips');
    const row = document.getElementById('target-row');
    chips.innerHTML = selectedTypes.map((type) => typeTagHTML(type)).join('');
    if (selectedTypes.length === 0) {
        row.dataset.tip = 'Selecione até 2 tipos do alvo.';
    } else {
        const names = selectedTypes.map((type) => LABELS[type]).join(' / ');
        row.dataset.tip = selectedTypes.length === 2 ? `Alvo: ${names} (duplo)` : `Alvo: ${names}`;
    }
}

grid.addEventListener('click', (event) => {
    const btn = event.target.closest('.type-cell');
    if (!btn) return;
    const type = btn.dataset.type;
    const idx = selectedTypes.indexOf(type);
    if (idx >= 0) {
        selectedTypes.splice(idx, 1);
    } else {
        selectedTypes.push(type);
        if (selectedTypes.length > 2) selectedTypes.shift(); // descarta o mais antigo
    }
    enforceModeConstraints();
});

function setMode(mode) {
    document.getElementById('mode-ataque').classList.toggle('active', mode === 'ataque');
    document.getElementById('mode-defesa').classList.toggle('active', mode === 'defesa');
    enforceModeConstraints();
}
document.getElementById('mode-ataque').addEventListener('click', () => setMode('ataque'));
document.getElementById('mode-defesa').addEventListener('click', () => setMode('defesa'));

document.getElementById('include-dual').addEventListener('click', (event) => {
    const btn = event.currentTarget;
    if (btn.getAttribute('aria-disabled') === 'true') return;
    const on = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', String(!on));
    calculate();
});

document.getElementById('clear-selection').addEventListener('click', () => {
    selectedTypes = [];
    enforceModeConstraints();
});

enforceModeConstraints();

function calculate() {
    const selected = getSelectedTypes();
    const mode = getMode();
    const results = document.getElementById('results');

    if (selected.length === 0) {
        results.style.display = 'none';
        return;
    }

    let entries;
    if (mode === 'ataque') {
        // "selected" = o(s) tipo(s) do ALVO. Um golpe é sempre de 1 tipo só, então
        // combinações não existem nesse modo — o botão 2T não se aplica aqui.
        entries = TYPES.map((t) => ({ combo: [t], value: defMultiplier(t, selected) }));
    } else {
        // "selected" = lista de tipos de ATAQUE independentes a enfrentar.
        // Aqui os tipos duplos combinam de verdade na defesa. COMBOS já inclui os
        // 18 tipos puros + 153 duplos — ligar o 2T nunca remove os puros, só
        // adiciona os duplos à lista.
        const candidates = includeDual() ? COMBOS : TYPES.map((t) => [t]);
        entries = candidates.map((combo) => ({
            // pior multiplicador que esse combo toma de qualquer um dos tipos selecionados
            combo,
            value: Math.max(...selected.map((s) => defMultiplier(s, combo))),
        }));
    }

    document.getElementById('results-body').innerHTML = renderGroupedResults(entries);
    results.style.display = 'block';
}

// agrupa as entradas já calculadas (ataque: dano causado; defesa: pior dano
// recebido) por valor de multiplicador e renderiza uma linha por faixa
function renderGroupedResults(entries) {
    const order = [4, 2, 1, .5, .25, 0];
    const byValue = new Map(order.map((value) => [value, []]));
    entries.forEach(({ combo, value }) => { if (byValue.has(value)) byValue.get(value).push(combo); });
    return `<div class="calc-rows">` + order
        .filter((value) => byValue.get(value).length)
        .map((value) => {
            const combos = byValue.get(value);
            const overflow = combos.length > 24
                ? `<span class="calc-more" data-tip="Mais ${combos.length - 24} combinações neste grupo">+${combos.length - 24}</span>`
                : '';
            return `<div class="calc-row">
            <span class="calc-mult ${multClass(value)}">${multLabel(value)}</span>
            <span class="calc-types">${combos.slice(0, 24).map((combo) => typeTagHTML(combo)).join('')}${overflow}</span>
        </div>`;
        }).join('') + `</div>`;
}

// atalhos do painel: repassa a tecla pro shell (iframe -> parent) trocar de aba
window.addEventListener('keydown', (event) => {
    if (/INPUT|TEXTAREA/.test(event.target.tagName)) return;
    const key = event.key.toLowerCase();
    if (['e', 'c', 't', 'm', ',', 'f', 'escape'].includes(key)) {
        window.parent.postMessage({ type: 'panel-shortcut', key }, '*');
    }
});
