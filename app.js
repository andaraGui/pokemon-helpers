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

        const ICONS = {
            normal: '⭐', fire: '🔥', water: '💧', electric: '⚡', grass: '🌿',
            ice: '❄️', fighting: '👊', poison: '☠️', ground: '🌍', flying: '🌪️',
            psychic: '🔮', bug: '🐛', rock: '🪨', ghost: '👻', dragon: '🐉',
            dark: '🌙', steel: '⚙️', fairy: '✨'
        };

        // ---- componente de tag: 1 tipo = pill sólida; 2 tipos = pill cortada na cor ----
        function typeTagHTML(types) {
            if (!Array.isArray(types)) types = [types];
            const isCombo = types.length === 2;
            const bg = isCombo
                ? `linear-gradient(90deg, var(--t-${types[0]}) 50%, var(--t-${types[1]}) 50%)`
                : `var(--t-${types[0]})`;
            const icons = types.map(t => ICONS[t]).join('');
            const names = types.map(t => LABELS[t]).join('/');
            return `<span class="type-tag${isCombo ? ' combo' : ''}" style="background:${bg}">` +
                `<span class="icon">${icons}</span>${names}` +
                `</span>`;
        }

        const CHART = {
            normal: { rock: 0.5, ghost: 0, steel: 0.5 },
            fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
            water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
            electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
            grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
            ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
            fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
            poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
            ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
            flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
            psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
            bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
            rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
            ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
            dragon: { dragon: 2, steel: 0.5, fairy: 0 },
            dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
            steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
            fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
        };

        // multiplicador de dano de UM tipo atacante contra um defensor (1 ou 2 tipos)
        function defMultiplier(attacker, defenderTypes) {
            const table = CHART[attacker] || {};
            return defenderTypes.reduce((acc, def) => acc * (table[def] ?? 1), 1);
        }

        // todos os tipos possíveis: 18 puros + 153 combinações duplas
        function allCombos() {
            const combos = TYPES.map(t => [t]);
            for (let i = 0; i < TYPES.length; i++) {
                for (let j = i + 1; j < TYPES.length; j++) combos.push([TYPES[i], TYPES[j]]);
            }
            return combos;
        }
        const COMBOS = allCombos();

        function multClass(v) {
            if (v === 4) return 'mult-4';
            if (v === 2) return 'mult-2';
            if (v === 1) return 'mult-1';
            if (v === 0.5) return 'mult-0-5';
            if (v === 0.25) return 'mult-0-25';
            return 'mult-0';
        }
        function multLabel(v) {
            if (v === 0.5) return '½×';
            if (v === 0.25) return '¼×';
            return v + '×';
        }
        function multBadge(v) {
            return `<span class="mult ${multClass(v)}">${multLabel(v)}</span>`;
        }

        // ---------- grid de checkboxes ----------
        const grid = document.getElementById('type-grid');
        TYPES.forEach(t => {
            const chip = document.createElement('div');
            chip.className = 'type-chip';
            chip.innerHTML = `
    <input type="checkbox" id="chk-${t}" value="${t}">
    <label for="chk-${t}">${typeTagHTML(t)}</label>
  `;
            grid.appendChild(chip);
        });

        const hint = document.getElementById('hint');
        const typePanelTitle = document.getElementById('type-panel-title');

        function getSelectedTypes() {
            return TYPES.filter(t => document.getElementById(`chk-${t}`).checked);
        }
        function getMode() {
            return document.querySelector('input[name="mode"]:checked').value;
        }

        // Aplica as regras de seleção de cada modo:
        // - "ataque": no máx. 2 tipos marcados (representam o(s) tipo(s) do ALVO, um único Pokémon)
        // - "defesa": qualquer quantidade (representam tipos de ataque INDEPENDENTES a enfrentar)
        function enforceModeConstraints() {
            const mode = getMode();
            const selected = getSelectedTypes();
            const dualCheckbox = document.getElementById('include-dual');
            const dualLabel = document.getElementById('include-dual-label');

            if (mode === 'ataque') {
                typePanelTitle.textContent = 'Tipo do alvo (até 2)';
                // se tiver mais de 2 marcados (ex: veio do modo defesa), desmarca os excedentes
                if (selected.length > 2) {
                    selected.slice(2).forEach(t => { document.getElementById(`chk-${t}`).checked = false; });
                }
                const nowSelected = getSelectedTypes();
                const atLimit = nowSelected.length >= 2;
                TYPES.forEach(t => {
                    const chk = document.getElementById(`chk-${t}`);
                    chk.disabled = atLimit && !chk.checked;
                });
                // um golpe é sempre mono-tipo: combinações não existem no modo Ataque
                dualCheckbox.disabled = true;
                dualCheckbox.checked = false;
                dualLabel.classList.add('disabled-note');
            } else {
                typePanelTitle.textContent = 'Tipos de ataque a enfrentar';
                TYPES.forEach(t => { document.getElementById(`chk-${t}`).disabled = false; });
                dualCheckbox.disabled = false;
                dualLabel.classList.remove('disabled-note');
            }

            const n = getSelectedTypes().length;
            if (n === 0) {
                hint.textContent = 'Selecione ao menos um tipo acima.';
            } else if (mode === 'ataque') {
                hint.textContent = n === 1
                    ? '1 tipo selecionado (alvo mono-tipo).'
                    : '2 tipos selecionados (alvo dual-type).';
            } else {
                hint.textContent = `${n} tipo(s) de ataque selecionado(s).`;
            }
            hint.classList.remove('warn');

            calculate();
        }

        grid.addEventListener('change', enforceModeConstraints);
        document.getElementById('mode-ataque').addEventListener('change', enforceModeConstraints);
        document.getElementById('mode-defesa').addEventListener('change', enforceModeConstraints);
        document.getElementById('include-dual').addEventListener('change', calculate);
        enforceModeConstraints();

        function includeDual() {
            return document.getElementById('include-dual').checked;
        }

        function calculate() {
            const selected = getSelectedTypes();
            const mode = getMode();

            if (selected.length === 0) {
                document.getElementById('results').style.display = 'none';
                return;
            }

            if (mode === 'ataque') {
                // "selected" = o(s) tipo(s) do ALVO. Um golpe é sempre de 1 tipo só, então
                // combinações não existem nesse modo — a checkbox de duplos não se aplica aqui.
                const entries = TYPES.map(t => {
                    const dano = defMultiplier(t, selected);
                    const recebe = Math.max(...selected.map(s => defMultiplier(s, [t])));
                    return { combo: [t], dano, recebe };
                });
                renderAtaque(entries, selected);
            } else {
                // "selected" = lista de tipos de ATAQUE independentes a enfrentar.
                // Aqui os tipos duplos combinam de verdade na defesa. COMBOS já inclui os
                // 18 tipos puros + 153 duplos — ligar a checkbox nunca remove os puros,
                // só adiciona os duplos à lista.
                const candidates = includeDual() ? COMBOS : TYPES.map(t => [t]);
                const entries = candidates.map(combo => {
                    // recebe: PIOR multiplicador que esse combo toma de qualquer um dos tipos selecionados
                    const recebe = Math.max(...selected.map(s => defMultiplier(s, combo)));
                    return { combo, recebe };
                });
                renderDefesa(entries, selected);
            }
        }

        function renderAtaque(entries, target) {
            const body = document.getElementById('results-body');
            const title = document.getElementById('results-title');
            title.textContent = 'Resultado — tipos agrupados por dano causado no alvo';

            const banner = `<div class="target-banner">Alvo: ${typeTagHTML(target)}</div>`;

            const TIERS = [4, 2, 1, 0.5, 0.25, 0];
            const tierRows = TIERS.map(tierValue => {
                const group = entries
                    .filter(e => e.dano === tierValue)
                    .sort((a, b) => a.recebe - b.recebe); // dentro da faixa, quem recebe menos vem primeiro

                if (group.length === 0) return '';

                const tags = group.map(e => `<span class="tier-entry">${typeTagHTML(e.combo)}</span>`).join('');

                return `
      <div class="tier-row">
        <div class="tier-label">${multBadge(tierValue)}</div>
        <div class="tier-list">${tags}</div>
      </div>
    `;
            }).join('');

            body.innerHTML = banner + tierRows;
            document.getElementById('results').style.display = 'block';
        }

        // mesmas faixas de multiplicador do Ataque, mas cores invertidas:
        // aqui, multiplicador BAIXO é bom (você recebe pouco dano) e ALTO é ruim.
        function multClassDefesa(v) {
            if (v === 0 || v === 0.25) return 'mult-4';   // melhor caso: imune ou 1/4
            if (v === 0.5) return 'mult-2';                // resiste
            if (v === 1) return 'mult-1';                  // neutro
            if (v === 2) return 'mult-0-5';                // fraco contra
            return 'mult-0-25';                            // v === 4, pior caso
        }
        function multBadgeDefesa(v) {
            return `<span class="mult ${multClassDefesa(v)}">${multLabel(v)}</span>`;
        }

        function renderDefesa(entries, selected) {
            const body = document.getElementById('results-body');
            const title = document.getElementById('results-title');
            title.textContent = 'Resultado — tipos agrupados pelo pior dano recebido';

            const banner = `<div class="target-banner">Enfrentando: ${selected.map(t => typeTagHTML(t)).join(' ')}</div>`;

            // ordem do melhor pro pior caso de defesa
            const TIERS = [0, 0.25, 0.5, 1, 2, 4];

            const tierRows = TIERS.map(tierValue => {
                const group = entries.filter(e => e.recebe === tierValue);
                if (group.length === 0) return '';

                const tags = group.map(e => typeTagHTML(e.combo)).join('');

                return `
      <div class="tier-row">
        <div class="tier-label">${multBadgeDefesa(tierValue)}</div>
        <div class="tier-list">${tags}</div>
      </div>
    `;
            }).join('');

            body.innerHTML = banner + tierRows;
            document.getElementById('results').style.display = 'block';
        }

        // ---------- tabela completa interativa ----------
        function iconOnlyTag(type) {
            return `<span class="type-tag mini" style="background:var(--t-${type})" title="${LABELS[type]}">` +
                `<span class="icon">${ICONS[type]}</span></span>`;
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
