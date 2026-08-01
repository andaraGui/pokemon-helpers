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
    <label for="chk-${t}">${typeTagHTML(t, { stack: true })}</label>
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

            const banner = `<div class="target-banner">Alvo: ${typeTagHTML(target, { stack: true })}</div>`;

            const TIERS = [4, 2, 0.5, 0.25, 0];
            const tierRows = TIERS.map(tierValue => {
                const group = entries
                    .filter(e => e.dano === tierValue)
                    .sort((a, b) => a.recebe - b.recebe); // dentro da faixa, quem recebe menos vem primeiro

                if (group.length === 0) return '';

                const tags = group.map(e => `<span class="tier-entry">${typeTagHTML(e.combo, { stack: true })}</span>`).join('');

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

            const banner = `<div class="target-banner">Enfrentando: ${selected.map(t => typeTagHTML(t, { stack: true })).join(' ')}</div>`;

            // ordem do melhor pro pior caso de defesa
            const TIERS = [0, 0.25, 0.5, 2, 4];

            const tierRows = TIERS.map(tierValue => {
                const group = entries.filter(e => e.recebe === tierValue);
                if (group.length === 0) return '';

                const tags = group.map(e => typeTagHTML(e.combo, { stack: true })).join('');

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
