/* ---------- Paleta (compartilhada entre cliente e servidor) ---------- */
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = a => "#" + a.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
const shade = (h, amt) => { const c = hex(h); return toHex(amt < 0 ? c.map(v => v * (1 + amt)) : c.map(v => v + (255 - v) * amt)); };
function makePalette(look, race) {
  const o = look.outfit, h = look.hair, a = look.aura, sk = (look.body && look.body.skin) || race.look.skin;
  return {
    skin: sk, skinD: shade(sk, -.24), skinL: shade(sk, .2), outfit: o, outfitD: shade(o, -.35), outfitL: shade(o, .28),
    hair: h, hairD: shade(h, -.3), hairL: shade(h, .32), aura: a, auraL: shade(a, .55), auraD: shade(a, -.3),
    accent: race.look.accent, accentD: shade(race.look.accent, -.35), white: "#e8eeff", wrap: shade(o, .45), eye: (look.body && look.body.eye) || race.look.eye, belt: "#1a2038"
  };
}
