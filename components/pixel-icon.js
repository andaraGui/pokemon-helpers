// ---------------------------------------------------------------------------
// Ícones pixel-art 7×7 do design system: cada glifo é um bitmap de '0'/'1'
// renderizado como box-shadow de um quadrado 2×2 dentro de uma âncora 14×14.
// Também centraliza o contraste automático de texto sobre cores de tipo.
// ---------------------------------------------------------------------------
var PokemonPixelIcons = globalThis.PokemonPixelIcons || (() => {
    const TYPE_ICONS = {
        NRM: '0011100/0100010/1000001/1000001/1000001/0100010/0011100',
        FIR: '0010100/0011100/0111010/0111110/1111111/1101111/0111110',
        WTR: '0001000/0011100/0011100/0111110/1111111/1111111/0111110',
        ELC: '0000110/0001100/0011000/0111110/0001100/0011000/0110000',
        GRS: '0000111/0001111/0011110/0111100/1111000/0110100/1100010',
        ICE: '1001001/0101010/0011100/1111111/0011100/0101010/1001001',
        FGT: '0000000/0110110/1111111/1111111/1111111/0111110/0011100',
        PSN: '0111110/1111111/1011101/1111111/0111110/0010100/0101010',
        GRD: '0000000/0001000/0011100/0111110/1111111/0000000/1111111',
        FLY: '0000000/1100000/1111000/0111110/0011111/0000110/0000000',
        PSY: '0000000/0111110/1000001/1001101/1000001/0111110/0000000',
        BUG: '1000001/0100010/0111110/1111111/0111110/1111111/0100010',
        RCK: '0001100/0011110/0111111/1111111/1111110/0111100/0000000',
        GHO: '0011100/0111110/1101011/1111111/1111111/1111111/1010101',
        DRG: '0001000/0011100/0111110/1111111/0111110/0011100/0001000',
        DRK: '0011100/0111110/1111000/1110000/1111000/0111110/0011100',
        STL: '0011100/0111110/1110111/1100011/1110111/0111110/0011100',
        FRY: '0001000/0001000/0101010/0011100/1110111/0011100/0101010'
    };
    const UI_ICONS = {
        enc:  '0001000/0011100/0110110/1110111/0110110/0011100/0001000',
        calc: '1111111/1000001/1011101/1000001/1010101/1010101/1111111',
        tbl:  '1111111/1001001/1111111/1001001/1111111/1001001/1111111',
        team: '0011100/0100010/1111111/1000001/1010101/1000001/1111111',
        cfg:  '0101010/1111111/1110111/1100011/1110111/1111111/0101010'
    };
    const TYPE_COLORS = {
        normal: '#9a9a80', fire: '#f0803c', water: '#4a90e2', electric: '#f5cd35',
        grass: '#63bb5b', ice: '#7fd6d6', fighting: '#d3425f', poison: '#b763cf',
        ground: '#d9a642', flying: '#8f7fe0', psychic: '#f56a8a', bug: '#92bc2c',
        rock: '#c9b787', ghost: '#7b62a3', dragon: '#5f6fe8', dark: '#6f6880',
        steel: '#8fa5b8', fairy: '#ee90c0'
    };

    function px(map, color, scale) {
        const out = [];
        map.split('/').forEach((rowBits, y) => rowBits.split('').forEach((bit, x) => {
            if (bit === '1') out.push(`${x * scale}px ${y * scale}px 0 0 ${color}`);
        }));
        return out.join(',');
    }

    function iconHTML(map, color, scale = 2) {
        const size = 7 * scale;
        return `<span class="px-icon" style="position:relative;display:inline-block;width:${size}px;height:${size}px;flex:0 0 auto;">` +
            `<span style="position:absolute;left:0;top:0;width:${scale}px;height:${scale}px;box-shadow:${px(map, color, scale)};"></span>` +
            `</span>`;
    }

    function lum(hex) {
        const channel = (i) => {
            const c = parseInt(hex.slice(i, i + 2), 16) / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
    }
    function ratio(a, b) {
        const x = lum(a), y = lum(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    }
    function onColor(bg) {
        return ratio('#0c0c11', bg) >= ratio('#f4f4fa', bg) ? '#0c0c11' : '#f4f4fa';
    }
    function mix(hex, base, amount) {
        const part = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
        const a = part(hex), b = part(base);
        return '#' + a.map((v, i) => Math.round(b[i] + (v - b[i]) * amount).toString(16).padStart(2, '0')).join('');
    }

    function typeIcon(typeKey, color) {
        // ABBR vem de components/type-tag.js (carregado antes deste arquivo? não:
        // este arquivo não depende da ordem — usa o próprio mapa de abreviações)
        const ab = ({ normal:'NRM', fire:'FIR', water:'WTR', electric:'ELC', grass:'GRS',
            ice:'ICE', fighting:'FGT', poison:'PSN', ground:'GRD', flying:'FLY',
            psychic:'PSY', bug:'BUG', rock:'RCK', ghost:'GHO', dragon:'DRG',
            dark:'DRK', steel:'STL', fairy:'FRY' })[typeKey] || typeKey;
        return iconHTML(TYPE_ICONS[ab] || TYPE_ICONS.NRM, color);
    }

    return Object.freeze({
        TYPE_ICONS, UI_ICONS, px, iconHTML, typeIcon, onColor, mix,
        typeColor: (typeKey) => TYPE_COLORS[typeKey] || '#9a9a80'
    });
})();
globalThis.PokemonPixelIcons = PokemonPixelIcons;
