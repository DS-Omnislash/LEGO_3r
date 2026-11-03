# ⚡ SUPERPOWERED · Seguiment FLL

Aplicació local per gestionar una lliga d'aula de **FIRST® LEGO® League Challenge — SUPERPOWERED℠**: equips, missions oficials, sessions setmanals, puntuació automàtica i classificacions.

- Interfície en **català**. El text oficial del llibre de regles (castellà) es conserva literalment i es pot mostrar al costat de cada condició.
- Funciona **sense internet** un cop instal·lada. No calen comptes, serveis de pagament ni base de dades externa.
- Les dades es desen al navegador (IndexedDB) i **persisteixen** entre recàrregues i reinicis.

---

## 1. Instal·lació i arrencada

**Requisit:** [Node.js](https://nodejs.org) 18 o posterior (versió LTS recomanada).

### Opció ràpida (Windows)
Feu doble clic a **`Inicia.bat`**. El primer cop instal·la les dependències (cal internet); després obre l'aplicació al navegador.

### Des del terminal
```bash
npm install      # només el primer cop
npm start        # obre http://localhost:5173
```

Deixeu la finestra del terminal oberta mentre feu servir l'aplicació; tanqueu-la (o `Ctrl+C`) per aturar-la.

Altres ordres:

| Ordre | Què fa |
|---|---|
| `npm test` | Executa els tests del motor de puntuació, classificacions, importació i base de dades (87 tests) |
| `npm run build` | Comprova els tipus i genera una versió optimitzada a `dist/` |
| `npm run preview` | Serveix la versió de `dist/` al mateix port |

> **Important sobre les dades:** el navegador desa les dades per a l'adreça `http://localhost:5173`. Feu servir **sempre el mateix navegador i el mateix port**, no feu servir mode privat i no esborreu les «dades de llocs» de localhost. Feu una **còpia de seguretat** cada setmana (Configuració → Descarrega còpia).

---

## 2. Ús setmanal (guia ràpida)

1. **Equips** → «＋ Nou equip» o «📥 Importar» (CSV/JSON). Hi ha plantilles descarregables i exemples a [`examples/`](examples/).
2. **Sessions** → «＋ Nova sessió»: data, títol, tipus (*pràctica* o *oficial*), **les missions que trieu** i els equips participants.
3. A la sessió, seleccioneu un equip → «▶ Comença a puntuar» i marqueu el que ha aconseguit el robot. La puntuació es calcula sola. «Següent equip →» passa al següent.
   - Cada canvi es desa automàticament (la sessió queda com a esborrany i hi podeu tornar quan vulgueu).
   - «＋ Intent» afegeix un altre intent: es conserven tots.
4. «✅ Marca com a completada» quan acabeu. Només les sessions completades compten a la classificació acumulada.
5. **Classificació** → «📽️ Mode projector» per mostrar-la a la pissarra digital.
6. Per corregir un error: obriu la sessió → «🔓 Reobre per corregir». L'estat anterior de cada intent es desa a l'historial.

---

## 3. Seccions

| Secció | Contingut |
|---|---|
| **Tauler** | Resum: equips, sessions, líder i podi, sessions pendents, últims resultats, progrés, assoliment per missió, millora |
| **Equips** | Alta, edició, arxivament, eliminació, importació i exportació (CSV/JSON) amb validació |
| **Missions** | Fitxes cercables, mapa del terreny, regles generals, punts per revisar; detall amb desglossament i simulador |
| **Sessions** | Creació, puntuació en directe, intents múltiples, ajustos manuals, completar/reobrir, historial |
| **Classificació** | 4 mètodes, abast pràctica/oficial, filtres (equip, missió, dates), taules per sessió i per missió, mode projector |
| **Estadístiques** | Evolució per sessió (punts o % del màxim), acumulats, assoliment per missió, detall per equip |
| **Configuració** | Mètode de classificació, desempat, ajustos, còpies de seguretat, instantànies automàtiques, reinici |

---

## 4. Regles oficials i puntuació

La font de veritat és **`Reglas-Robot-SUPERPOWERED-FLL-2023.pdf`**. Tota la informació s'ha extret a un fitxer de dades estructurat:

**[`src/data/superpowered.json`](src/data/superpowered.json)** — per a cada missió: nom oficial, pàgines del PDF, història, objectiu, configuració, i cada condició de puntuació amb els punts, el text oficial literal, els requisits (dependències) i les restriccions.

El motor ([`src/scoring/engine.ts`](src/scoring/engine.ts)) és independent de la interfície i interpreta aquestes regles:

- **Tipus de condició:** sí/no, recompte (amb màxim), opció, *verificació de l'àrbitre* (no puntua però pot bloquejar punts) i *bonificació automàtica*.
- **Dependències explícites:** p. ex. la bonificació de M02 requereix ≥1 unitat de combustible; el contingut de M09 només puntua amb la tapa tancada; M01 requereix les tres condicions del model; si les unitats toquen l'equipament (M03, M05, M08, M12, M14, M15) no puntuen. Quan una condició no puntua, la pantalla explica **per què**.
- **Restriccions:** màxims per condició, M12 (embassament + ganxos ≤ 3 unitats) i un límit global de **12 unitats d'energia** col·locades en destinacions.
- **Màxims calculats automàticament** (per enumeració): 410 punts per al joc complet (415 si s'ignorés el límit de 12 unitats d'energia).
- **Gracious Professionalism®** (2/3/4) es registra a part i **no suma** al joc del robot (forma part de Core Values, p. 6).
- **Ajustos manuals:** només amb motiu obligatori, i sempre separats dels punts oficials de missió.

| Missió | Màx. | | Missió | Màx. |
|---|---|---|---|---|
| Inspecció de l'equipament | 20 | | 08 Televisió | 20 |
| 01 Model del projecte d'innovació | 10 | | 09 Dinosaure de joguina | 30 |
| 02 Plataforma petroliera | 25 | | 10 Planta d'energia | 25 |
| 03 Emmagatzematge d'energia | 35 | | 11 Central hidroelèctrica | 20 |
| 04 Granja solar | 20 | | 12 Embassament d'aigua | 25 |
| 05 Xarxa intel·ligent | 30 | | 13 Power-to-X | 15 |
| 06 Automòbil híbrid | 20 | | 14 Fàbrica de joguines | 25 |
| 07 Turbina eòlica | 30 | | 15 Bateria recarregable | 15 |
| Fitxes de precisió | 50 | | | |

### ⚠️ Punts per revisar (no inventats: marcats)
L'aplicació no inventa regles. Quan el PDF no és del tot clar, el valor es marca com a *deduït* i apareix a **Missions → Punts per revisar**. Els principals:

1. **M02:** la fitxa (p. 8) diu «unidad de combustible» per a la bonificació; la full de puntuació (p. 30) diu «unidad de energía». S'ha seguit la p. 8.
2. **M02, M04, M07, M10, M12:** el màxim d'unitats s'ha deduït de l'inventari i la configuració (p. 23–28), no d'un màxim escrit.
3. **M05:** la bonificació depèn de la taula contrària; en pràctiques amb una sola taula, decideix l'organitzador.
4. **M09:** «unitat d'energia (10) o bateria (20)» es tracta com a opcions excloents.
5. **M12:** una mateixa unitat no pot puntuar alhora a l'embassament i en un ganxo.
6. **Fitxes de precisió:** amb 0 fitxes → 0 punts (la taula només dona valors per a 1–6).
7. **Límit de 12 unitats d'energia:** deduït de l'inventari (p. 23, p. 25).
8. **Viatges de l'energia** i **posicions del mapa**: aproximats/informatius; no afecten la puntuació.
9. **Challenge Updates:** les actualitzacions oficials de la temporada poden modificar regles (p. 16) i no són al PDF.

Per canviar qualsevol valor, editeu `src/data/superpowered.json` i executeu `npm test`.

---

## 5. Classificacions

Configurables a **Configuració** (també des de la pàgina de Classificació). El mètode actiu i l'abast (pràctica / oficial / tots dos) es mostren **sempre etiquetats**; no es barregen.

| Mètode | Càlcul |
|---|---|
| **Puntuació acumulada** | Suma de la puntuació de cada sessió completada |
| **Millor intent per missió** | Suma de la millor puntuació de cada missió (sense ajustos manuals) |
| **Sessió individual** | Classificació d'una sessió (també en curs, marcada com a *provisional*) |
| **Millor partida (format oficial)** | Només compta l'intent més alt (p. 6, p. 21) |

- **Puntuació d'un equip en una sessió:** millor intent (per defecte, coherent amb la regla oficial) o últim intent.
- **Empats:** per defecte es mostren com a **EMPAT** (mateixa posició). Opcionalment, desempat per la 2a i 3a millor partida (criteri oficial, p. 21).
- **Pràctica vs. oficial:** cada sessió té un tipus i les classificacions poden filtrar-lo.

---

## 6. Importar equips

CSV (separat per comes o punt i coma) o JSON. Capçaleres acceptades en català, castellà o anglès.

```csv
numero,nom,membres,notes,color
101,Els Energètics,Anna; Pau; Martina; Jan,Grup de 3r A,#e3000b
102,Robo-Volts,Laia; Marc; Noa,,#006cb7
```

```json
{ "teams": [ { "number": "101", "name": "Els Energètics", "members": ["Anna", "Pau"], "notes": "", "color": "#e3000b" } ] }
```

- `nom` és obligatori; la resta és opcional.
- Es detecten noms buits, **números o noms duplicats** i colors no vàlids, amb el número de fila.
- Si un equip ja existeix (mateix número o nom), podeu **actualitzar-lo** o **ometre'l**.

---

## 7. Còpies de seguretat

- **Configuració → Descarrega còpia**: un fitxer `.json` amb equips, sessions, intents (amb historial de correccions) i configuració.
- **Restaura una còpia**: es valida el fitxer i, abans de substituir les dades, es desa una **instantània automàtica** (es guarden les 5 últimes i es poden restaurar o descarregar).
- Per moure l'aplicació a un altre ordinador: copieu la carpeta del projecte, executeu `Inicia.bat` i restaureu la còpia.

---

## 8. Estructura del projecte

```
src/
  data/superpowered.json   Regles oficials estructurades (font de veritat de l'aplicació)
  scoring/                 Motor de puntuació pur (types.ts, engine.ts, rules.ts)
  db/                      IndexedDB (Dexie): models, repositori, consultes reactives
  lib/                     Classificacions i estadístiques, importació d'equips, còpies, formats
  components/              Peces d'interfície (formulari de puntuació, mapa, gràfics, projector…)
  pages/                   Tauler, Equips, Missions, Sessions, Classificació, Estadístiques, Configuració
tests/                     Tests (Vitest): motor, classificacions, importació, flux complet amb IndexedDB
examples/                  Fitxers d'equips d'exemple (CSV i JSON)
Inicia.bat                 Arrencada amb doble clic a Windows
```

**Tecnologia:** React 18 + TypeScript + Vite, Dexie (IndexedDB), Recharts, Vitest. Les fonts tipogràfiques s'inclouen localment (sense CDN).

**Model de dades:** `Team` · `Session` (data, títol, tipus, missions, equips, estat, registre d'accions) · `Attempt` (sessió, equip, número, valors de cada condició, ajustos, GP, notes, revisions) · `Settings`. Les puntuacions **no es desen**: es recalculen sempre a partir dels valors introduïts i de les regles, de manera que una correcció de les regles s'aplica a tot l'historial.

---

*FIRST®, FIRST® LEGO® League, SUPERPOWERED℠ i Gracious Professionalism® són marques de FIRST i del LEGO Group. Aquesta aplicació és una eina d'aula no oficial.*
