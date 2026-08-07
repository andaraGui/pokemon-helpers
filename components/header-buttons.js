// ---------------------------------------------------------------------------
// Barra de abas do overlay (content.js): botões 30×26 com ícone pixel 7×7
// (encontro / calculadora / meus pokémons / config) + expandir + minimizar.
// ---------------------------------------------------------------------------

// items: [{ icon: chave de PokemonPixelIcons.UI_ICONS, tip, view }]
function buildHeaderButtons(header, items, collapseItem, maximizeItem = { tip: 'Expandir — F' }) {
    const iconSpan = (name, color) => PokemonPixelIcons.iconHTML(PokemonPixelIcons.UI_ICONS[name], color);

    items.forEach((item) => {
        const btn = document.createElement('button');
        btn.className = 'ph-icon-btn ph-view-btn';
        btn.dataset.view = item.view;
        btn.dataset.icon = item.icon;
        btn.dataset.tip = item.tip;
        btn.innerHTML = iconSpan(item.icon, '#7a7a92');
        header.appendChild(btn);
    });

    const spacer = document.createElement('div');
    spacer.className = 'ph-spacer';
    header.appendChild(spacer);

    const maximizeBtn = document.createElement('button');
    maximizeBtn.className = 'ph-icon-btn ph-maximize-btn';
    maximizeBtn.dataset.tip = maximizeItem.tip;
    maximizeBtn.innerHTML = iconSpan('tbl', '#7a7a92');
    header.appendChild(maximizeBtn);

    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'ph-icon-btn ph-collapse-btn';
    collapseBtn.dataset.tip = collapseItem.tip;
    collapseBtn.textContent = '_';
    header.appendChild(collapseBtn);

    return { collapseBtn, maximizeBtn };
}

// repinta os ícones conforme a view ativa (chamado por setActiveView)
function paintHeaderButtons(container, activeView) {
    container.querySelectorAll('.ph-view-btn').forEach((btn) => {
        const active = btn.dataset.view === activeView;
        btn.classList.toggle('active', active);
        btn.innerHTML = PokemonPixelIcons.iconHTML(
            PokemonPixelIcons.UI_ICONS[btn.dataset.icon],
            active ? '#0c0c11' : '#7a7a92'
        );
    });
}
