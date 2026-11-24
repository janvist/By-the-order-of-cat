# By Order of the Cat 🐱👑

A cozy 3D story game built with Three.js. The human has left the house. You, a cat of great ambition, must convince Bruno, a loyal and very literal golden retriever, that you are in charge.

## Run it

Needs Node.js 18+.

```bash
cd by-order-of-the-cat
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## How it plays

1. **Explore the room.** Move with WASD or the arrow keys and jump with Space. Glowing rings mark things you can use with **E**.
2. **Find leverage.** A sticky note, a crown, Bruno's ball, the robot vacuum… everything you find **unlocks new lines** to say.
3. **Talk to Bruno.** Walk up and press **E**. Each conversation, you pick one line (keys 1–9). Good lines raise his **belief**, and rude ones backfire. Locked lines show a hint of what to look for. Walking away (Esc) is free.
4. **Reach 100% belief** before you run out of conversations and Bruno obeys the decree, with a little cutscene.
5. **Grow your kingdom.** Decrees earn Authority 👑, which you spend on Royal Court upgrades. The treasury keeps earning while you're away (up to 8 hours). Some rewards become **royal regalia** (crown, permit) that carry into later decrees and unlock new lines there.

## Decrees

| # | Decree | Bruno has to… | Things to find |
| - | --- | --- | --- |
| 1 | The Golden Seat | give you the golden couch seat | sticky note, crown, tennis ball, robot vacuum |
| 2 | The Dinner Permit | hand over a dinner biscuit | napkin + pen → write a permit, dispenser lever, squeaky bone |
| 3 | The Royal Fetch | fetch the golden toy for your treasury | blue cushion (hiding the toy), sock, laser pointer on top of the couch |

## Royal Court upgrades

Extra Audience (+1 conversation), Royal Reputation (+10 starting belief), Royal Purr (praise lines stronger), Spy Network (see each line's effect before choosing), Treasury Clerk (idle income).

## Project structure

```
index.html          Screens: title, court, level intro, HUD, talk panel, results
src/content.ts      ALL story content: decrees, objects, dialogue choices, upgrades
src/adventure.ts    Level runtime: exploring, using objects, talking, cutscenes
src/main.ts         Renderer, camera (zooms in during conversations), UI, court, game loop
src/save.ts         Progress, Authority, upgrades, idle treasury (localStorage)
src/world.ts        The living room: furniture + collision
src/characters.ts   Procedural cat and dog with animations
src/physics.ts      Small custom physics for walking and jumping
src/dialogue.ts     Subtitles
src/audio.ts        Synthesised sound effects
src/input.ts        Keyboard bindings
src/style.css       Cozy UI
```

## Adding a decree

Add an entry to `LEVELS` in `src/content.ts`: where Bruno sits, the objects to find (`spots`), and the dialogue `choices` with what each one requires. No engine changes are needed unless you want a new object model (`spotMesh` in `adventure.ts`) or a new win cutscene (`startWin` in `adventure.ts`).

`src/game.ts` is left over from the earlier chase version. Nothing uses it any more, so you can delete it.
# By-the-order-of-cat
