# Dragon Arena — online ranqueado

Jogo de luta 2D em pixel art (HTML5 Canvas, sem bibliotecas no navegador) com **modo offline completo** e **modo online ranqueado**: cada jogador no seu aparelho, contas, fila, partidas decididas pelo servidor e ranking por pontos.

## Como funciona

```
 navegador A ──┐                         ┌── navegador B
   (só envia   │   WebSocket (wss://)    │   (só envia
   entradas e  ├──►  servidor Node  ◄────┤   entradas e
   desenha)    │   roda a MESMA luta     │   desenha)
               └── 60 Hz, autoritativo ──┘
                   contas · fila · pontos
```

* **Servidor autoritativo**: o servidor roda a mesma simulação de combate do jogo offline (`server/sim.js`, gerado a partir de `src/`). Os clientes mandam só *entradas* (andar, defender, golpes) e recebem *fotos do estado* 30 vezes por segundo, mais os eventos de efeitos/sons. Não dá para forjar dano, vida ou resultado pelo navegador.
* **Ranqueada justa**: todos lutam com atributos iguais (nível 10, sem melhorias da loja). Corpo, cores e acessórios são só visuais.
* **Contas**: usuário + senha (scrypt com sal), sessão por token (30 dias), limite de tentativas de login e de cadastros.
* **Fila**: junta jogadores com pontuação próxima; a faixa de busca aumenta com o tempo (100 + 40 pts por segundo).
* **Quedas de conexão**: a luta pausa até 20 s esperando o jogador voltar (mesma conta, mesmo token). Se não voltar, perde por abandono. Sair de propósito também conta como abandono.

### Sistema de pontos

Cada luta gera uma **nota de 0 a 100** para cada jogador:

| Parte | Peso | O que mede |
|---|---|---|
| Resultado | 70% | KO vale 85–100 (quanto mais cedo, mais); vitória por tempo vale 60–75 (pela vantagem de vida); empate 50; o perdedor recebe o complemento |
| Domínio de dano | 30% | (dano causado − dano sofrido) ÷ (dano causado + dano sofrido) |

Os pontos vêm do Elo: `Δ = K · (nota − esperada)`, onde a nota esperada depende da diferença de pontos dos dois (vencer um rival mais forte rende mais). `K = 48` nas 5 primeiras partidas e `32` depois.

Garantias: vencer rende no mínimo **+5**; perder custa no mínimo −2 e no máximo −60; abandonar custa **−10 a mais**; repetir o mesmo rival 3 vezes na mesma hora corta o ganho pela metade; pontos nunca ficam abaixo de 0.

Faixas (cada uma, exceto Lenda, tem divisões III → II → I): Bronze · Prata (1150) · Ouro (1300) · Platina (1450) · Diamante (1600) · Mestre (1750) · Lenda (1950). Todo mundo começa com 1000 (Bronze II). Ajuste tudo em `server/rating.js`.

## Rodar no seu computador

```bash
npm install
npm start            # http://localhost:3000
```
Abra `http://localhost:3000` em duas abas (ou dois aparelhos na mesma rede), crie duas contas na aba **🌐 Online** e clique em *Buscar partida ranqueada* nas duas.

## Publicar (GitHub + Render)

1. **GitHub**: crie um repositório e envie esta pasta inteira (`git init`, `git add .`, `git commit`, `git push`). Os arquivos gerados `public/index.html` e `server/sim.js` já vão no repositório, então o Render não precisa de Python.
2. **Banco de dados permanente (importante)**: o disco do Render gratuito é apagado a cada deploy/reinício, então sem banco as contas somem. Crie um Postgres gratuito (por exemplo no **Neon** ou **Supabase**; o Postgres gratuito do próprio Render expira em ~30 dias) e copie a *connection string* (`postgres://usuario:senha@host/banco`).
3. **Render**: *New +* → **Blueprint** → escolha o repositório (usa o `render.yaml`) — ou *New +* → *Web Service* com `npm install --omit=dev` e `node server/index.js`. Em *Environment*, defina `DATABASE_URL` com a string do passo 2.
4. Pronto: abra `https://SEU-APP.onrender.com`. O jogo é servido pelo próprio servidor e conecta sozinho (wss). Para jogar a partir de outro endereço (por exemplo GitHub Pages), abra a aba Online e digite `wss://SEU-APP.onrender.com` em *Servidor*.

> **Plano gratuito do Render**: o serviço "dorme" após ~15 min sem acesso e leva de 30 a 60 s para acordar. O jogo reconecta sozinho, mas a primeira conexão do dia é lenta. As partidas em andamento mantêm o serviço acordado.

### Variáveis de ambiente
| Variável | Para quê |
|---|---|
| `PORT` | porta HTTP (o Render define sozinho) |
| `DATABASE_URL` | Postgres; sem ela usa arquivo `data/db.json` |
| `DATA_DIR` | pasta do arquivo quando não há Postgres |
| `ALLOWED_ORIGINS` | lista (separada por vírgulas) de origens aceitas no WebSocket, ex.: `https://seu-app.onrender.com,https://seuusuario.github.io`. Vazio = qualquer uma |
| `PGSSL=disable` | desliga SSL na conexão com o Postgres (só para bancos locais) |

## Desenvolvimento

* O código do jogo fica em `src/` (módulos). `python3 build.py` gera `public/index.html` (cliente) e `server/sim.js` (simulação do servidor, com FX/Som/UI trocados por *stubs* que registram eventos). **Edite `src/`, nunca os arquivos gerados**, e rode o build antes de commitar.
* Testes: `npm test` (pontuação + servidor com clientes WebSocket reais: cadastro, login, fila, luta completa, abandono, reconexão, matchmaking). `node test/e2e.js` abre dois navegadores reais (precisa do Playwright instalado).

## Limitações conhecidas
* Sem previsão/rollback de rede: a ação aparece depois de ~1 viagem de ida e volta ao servidor. Funciona bem com ping até ~120 ms; acima disso o controle fica "pesado".
* Sem recuperação de senha (não há e-mail); sem moderação de nomes além de limitar a letras, números e `_`.
* O servidor é uma única instância (as partidas ficam na memória). Para várias instâncias seria preciso um balanceador com afinidade de sessão.
* O adaptador de Postgres usa o pacote `pg`; o SQL foi validado, mas o adaptador em si não foi exercitado com o driver neste ambiente.
