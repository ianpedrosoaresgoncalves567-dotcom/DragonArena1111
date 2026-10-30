#!/usr/bin/env python3
"""Gera public/index.html (cliente) e server/sim.js (simulação autoritativa) a partir de src/."""
import os, re
root = os.path.dirname(os.path.abspath(__file__)); d = os.path.join(root, 'src') + '/'
rd = lambda f: open(d + f, encoding='utf-8').read()

CLIENT = ['a_data.js', 'a1_palette.js', 'a3_arenas.js', 'a2_sound.js', 'b_fx_sprites.js', 'c_combat.js', 'f_online.js', 'd_render_ui.js']
js = ''.join(rd(f) for f in CLIENT)
html = rd('template.html').replace('/*__SCRIPT__*/', js)
os.makedirs(os.path.join(root, 'public'), exist_ok=True)
open(os.path.join(root, 'public', 'index.html'), 'w', encoding='utf-8').write(html)
open(os.path.join(root, 'game.client.js'), 'w', encoding='utf-8').write(js)   # só para `node --check`

# --- servidor: mesmos módulos de dados e combate, com FX/Sound/UI substituídos por stubs que registram eventos
data = rd('a_data.js')
assert data.startswith('"use strict";\n(() => {'), 'a_data.js mudou de formato'
data = data[len('"use strict";\n(() => {'):]
body = data + rd('a1_palette.js') + rd('a3_arenas.js') + rd('s_stubs.js') + rd('c_combat.js') + rd('e_pvp.js')
body += '\nreturn { CFG, RACES, CLANS, ARENAS, BODY, StatBuilder, Save, MOVES, AIR_MOVE, Fighter, Combat, FX, NetRec, RANKED_LEVEL, makePvP, pvpInput, pvpPress, pvpSnap };'
sim = '"use strict";\n/* ARQUIVO GERADO por build.py — não edite. */\nmodule.exports = (() => {\n' + body + '\n})();\n'
os.makedirs(os.path.join(root, 'server'), exist_ok=True)
open(os.path.join(root, 'server', 'sim.js'), 'w', encoding='utf-8').write(sim)
print('cliente', len(html), 'bytes | sim', len(sim), 'bytes')
