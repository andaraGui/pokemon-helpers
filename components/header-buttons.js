// ---------------------------------------------------------------------------
// Componente do cabeçalho do overlay (content.js): linha de ícones de view
// (calculadora / encontro / meus pokémons / tabela / config) + botão de
// recolher. Mantém os mesmos ícones/estilos, só centraliza a criação deles
// pra não duplicar markup entre views.
// ---------------------------------------------------------------------------

// items: [{ icon, title, view }]
// collapseItem: { icon, title }
// Retorna o botão de recolher, já anexado ao header (o chamador cuida do listener).
function buildHeaderButtons(header, items, collapseItem) {
    items.forEach((item) => {
        const btn = document.createElement('button');
        btn.className = 'ph-icon-btn ph-view-btn pxl-icon-btn';
        btn.textContent = item.icon;
        btn.title = item.title;
        btn.dataset.view = item.view;
        header.appendChild(btn);
    });

    const spacer = document.createElement('div');
    spacer.className = 'ph-spacer';
    header.appendChild(spacer);

    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'ph-icon-btn pxl-icon-btn';
    collapseBtn.textContent = collapseItem.icon;
    collapseBtn.title = collapseItem.title;
    header.appendChild(collapseBtn);

    return collapseBtn;
}
