// TYPES, LABELS, typeTagHTML vêm de components/type-tag.js
// CHART, defMultiplier, multClass, multLabel vêm de components/type-chart-data.js

// ---------- tabela completa interativa ----------
function iconOnlyTag(type) {
    return typeTagHTML(type, { stack: true });
}

function buildChart() {
    const table = document.getElementById('type-chart');

    const thead = `<thead><tr>
    <th class="corner"></th>
    ${TYPES.map(def => `<th class="col-head" data-col="${def}">${iconOnlyTag(def)}</th>`).join('')}
  </tr></thead>`;

    const tbody = `<tbody>${TYPES.map(atk => {
        const cells = TYPES.map(def => {
            const v = defMultiplier(atk, [def]);
            return `<td class="chart-cell ${multClass(v)}" data-row="${atk}" data-col="${def}">${multLabel(v)}</td>`;
        }).join('');
        return `<tr><th class="row-head" data-row="${atk}">${iconOnlyTag(atk)}</th>${cells}</tr>`;
    }).join('')}</tbody>`;

    table.innerHTML = thead + tbody;
}

const chartTable = document.getElementById('type-chart');
let pinnedType = null;

function chartMode() {
    return document.querySelector('input[name="chart-mode"]:checked').value;
}

function applyChartHighlight(type) {
    const cells = chartTable.querySelectorAll('td, th.row-head, th.col-head');
    if (!type) {
        cells.forEach(el => el.classList.remove('dim', 'hl'));
        return;
    }
    const attr = chartMode() === 'ataque' ? 'row' : 'col';
    cells.forEach(el => {
        const matches = el.dataset[attr] === type;
        el.classList.toggle('hl', matches);
        el.classList.toggle('dim', !matches);
    });
}

chartTable.addEventListener('mouseover', (e) => {
    if (pinnedType) return; // não sobrepõe um destaque fixado por clique
    const th = e.target.closest('th.row-head, th.col-head');
    if (!th) return;
    applyChartHighlight(th.dataset.row || th.dataset.col);
});
chartTable.addEventListener('mouseout', (e) => {
    if (pinnedType) return;
    if (!e.target.closest('th.row-head, th.col-head')) return;
    applyChartHighlight(null);
});
chartTable.addEventListener('click', (e) => {
    const th = e.target.closest('th.row-head, th.col-head');
    if (!th) return;
    const type = th.dataset.row || th.dataset.col;
    pinnedType = (pinnedType === type) ? null : type;
    applyChartHighlight(pinnedType);
});

document.getElementById('chart-mode-ataque').addEventListener('change', onChartModeChange);
document.getElementById('chart-mode-defesa').addEventListener('change', onChartModeChange);

function onChartModeChange() {
    updateFilterLabel();
    rebuildChartWithFilter();
}

// ---------- filtro por tags (tipos comuns e/ou combinações de dois tipos) ----------
const filterInput = document.getElementById('chart-filter-input');
const filterDropdown = document.getElementById('chart-filter-dropdown');
const filterChipsEl = document.getElementById('chart-filter-chips');
const filterLabelEl = document.getElementById('chart-filter-label');
const optComum = document.getElementById('filter-opt-comum');
const optMultiplo = document.getElementById('filter-opt-multiplo');

let filterTags = []; // cada tag é um array: ['fire'] (comum) ou ['water','flying'] (múltiplo)

function tagKey(tag) { return tag.slice().sort().join('+'); }
function comboLabel(tag) { return tag.map(t => LABELS[t]).join('/'); }

function searchableOptions() {
    let opts = [];
    if (optComum.checked) opts = opts.concat(TYPES.map(t => [t]));
    if (optMultiplo.checked) {
        for (let i = 0; i < TYPES.length; i++) {
            for (let j = i + 1; j < TYPES.length; j++) opts.push([TYPES[i], TYPES[j]]);
        }
    }
    return opts;
}

function updateFilterLabel() {
    filterLabelEl.textContent = chartMode() === 'ataque'
        ? 'Mostrar só estas linhas (deixe vazio pra ver todas)'
        : 'Mostrar só estas colunas (deixe vazio pra ver todas)';
    filterInput.placeholder = 'Digite um tipo...';
}

function renderFilterChips() {
    filterChipsEl.innerHTML = filterTags.map(tag => `
    <span class="filter-chip">
      ${typeTagHTML(tag)}
      <button type="button" class="remove-chip" data-key="${tagKey(tag)}" aria-label="Remover ${comboLabel(tag)}">×</button>
    </span>
  `).join('');
}

function addFilterTag(tag) {
    if (filterTags.some(f => tagKey(f) === tagKey(tag))) return;
    filterTags.push(tag);
    renderFilterChips();
    rebuildChartWithFilter();
}

function removeFilterTag(key) {
    filterTags = filterTags.filter(f => tagKey(f) !== key);
    renderFilterChips();
    rebuildChartWithFilter();
}

filterChipsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-chip');
    if (!btn) return;
    removeFilterTag(btn.dataset.key);
});

function renderDropdown(query) {
    const q = query.trim().toLowerCase();
    if (!q) { filterDropdown.innerHTML = ''; filterDropdown.classList.remove('open'); filterDropdown._matches = []; return; }

    const matches = searchableOptions()
        .filter(tag => !filterTags.some(f => tagKey(f) === tagKey(tag)))
        .filter(tag => comboLabel(tag).toLowerCase().includes(q))
        .slice(0, 8);

    filterDropdown._matches = matches;

    if (matches.length === 0) {
        filterDropdown.innerHTML = '<div class="autocomplete-empty">Nenhum tipo encontrado</div>';
    } else {
        filterDropdown.innerHTML = matches.map(tag => `
      <div class="autocomplete-option" data-key="${tagKey(tag)}">${typeTagHTML(tag)}</div>
    `).join('');
    }
    filterDropdown.classList.add('open');
}

filterInput.addEventListener('input', () => renderDropdown(filterInput.value));
filterInput.addEventListener('focus', () => { if (filterInput.value) renderDropdown(filterInput.value); });
filterInput.addEventListener('blur', () => setTimeout(() => filterDropdown.classList.remove('open'), 150));
filterInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const first = (filterDropdown._matches || [])[0];
        if (first) addFilterTag(first);
        filterInput.value = '';
        filterDropdown.innerHTML = '';
        filterDropdown.classList.remove('open');
    } else if (e.key === 'Escape') {
        filterDropdown.classList.remove('open');
    }
});
// mousedown (não click) pra disparar antes do blur do input fechar o dropdown
filterDropdown.addEventListener('mousedown', (e) => {
    const opt = e.target.closest('.autocomplete-option');
    if (!opt) return;
    e.preventDefault();
    const tag = (filterDropdown._matches || []).find(t => tagKey(t) === opt.dataset.key);
    if (tag) addFilterTag(tag);
    filterInput.value = '';
    filterDropdown.innerHTML = '';
    filterDropdown.classList.remove('open');
});

function syncTogglePillClass(checkbox) {
    checkbox.closest('.toggle-pill').classList.toggle('active', checkbox.checked);
}
[optComum, optMultiplo].forEach(cb => {
    syncTogglePillClass(cb);
    cb.addEventListener('change', () => {
        syncTogglePillClass(cb);
        renderDropdown(filterInput.value);
    });
});

// adiciona uma linha extra (modo Ataque) representando um combo como atacante:
// dano = melhor STAB dos seus 2 tipos contra cada defensor puro
function appendExtraRow(tag) {
    const tbody = chartTable.querySelector('tbody');
    const key = tagKey(tag);
    const cells = TYPES.map(def => {
        const v = Math.max(...tag.map(t => defMultiplier(t, [def])));
        return `<td class="chart-cell extra ${multClass(v)}" data-row="${key}" data-col="${def}">${multLabel(v)}</td>`;
    }).join('');
    const tr = document.createElement('tr');
    tr.className = 'extra-row';
    tr.innerHTML = `<th class="row-head extra" data-row="${key}" title="${comboLabel(tag)}">${typeTagHTML(tag)}</th>${cells}`;
    tbody.appendChild(tr);
}

// adiciona uma coluna extra (modo Defesa) representando um combo como defensor:
// recebe = multiplicador combinado real dos seus 2 tipos contra cada atacante puro
function appendExtraCol(tag) {
    const key = tagKey(tag);
    const headerRow = chartTable.querySelector('thead tr');
    const th = document.createElement('th');
    th.className = 'col-head extra';
    th.dataset.col = key;
    th.title = comboLabel(tag);
    th.innerHTML = typeTagHTML(tag);
    headerRow.appendChild(th);

    chartTable.querySelectorAll('tbody tr').forEach(tr => {
        const rowType = tr.querySelector('th.row-head').dataset.row;
        const v = defMultiplier(rowType, tag);
        const td = document.createElement('td');
        td.className = `chart-cell extra ${multClass(v)}`;
        td.dataset.row = rowType;
        td.dataset.col = key;
        td.textContent = multLabel(v);
        tr.appendChild(td);
    });
}

function applyChartFilter(pureTags, mode) {
    const rows = chartTable.querySelectorAll('tbody tr:not(.extra-row)');
    const colHeads = chartTable.querySelectorAll('th.col-head:not(.extra)');
    const cells = chartTable.querySelectorAll('td.chart-cell:not(.extra)');

    if (mode === 'ataque') {
        // filtra LINHAS puras (tipos que atacam); colunas sempre visíveis
        rows.forEach(tr => {
            const rowType = tr.querySelector('th.row-head').dataset.row;
            tr.classList.toggle('row-hidden', pureTags.length > 0 && !pureTags.includes(rowType));
        });
        colHeads.forEach(th => th.classList.remove('col-hidden'));
        cells.forEach(td => td.classList.remove('col-hidden'));
    } else {
        // filtra COLUNAS puras (tipos que defendem); linhas sempre visíveis
        rows.forEach(tr => tr.classList.remove('row-hidden'));
        colHeads.forEach(th => {
            th.classList.toggle('col-hidden', pureTags.length > 0 && !pureTags.includes(th.dataset.col));
        });
        cells.forEach(td => {
            td.classList.toggle('col-hidden', pureTags.length > 0 && !pureTags.includes(td.dataset.col));
        });
    }
}

function rebuildChartWithFilter() {
    const mode = chartMode();
    const pureTags = filterTags.filter(t => t.length === 1).map(t => t[0]);
    const dualTags = filterTags.filter(t => t.length === 2);

    buildChart(); // reconstrói a base 18x18 limpa

    if (mode === 'ataque') {
        dualTags.forEach(appendExtraRow);
    } else {
        dualTags.forEach(appendExtraCol);
    }

    applyChartFilter(pureTags, mode);
    applyChartHighlight(pinnedType);
}

rebuildChartWithFilter();
