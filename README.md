# IMS Creators Desktop

![GitHub License](https://img.shields.io/github/license/ImStocker/ims-creators)
[![GitHub Release](https://img.shields.io/github/v/release/ImStocker/ims-creators)](https://github.com/ImStocker/ims-creators/releases)

Local application to develop and store your game ideas: **edit documents, add cross-references, create dialogues, prototype levels, easily export data to game engines** to speed up the path from concept to release.

🌍[Web version](https://ims.cr5.space/) | 🎥[Watch video](https://youtu.be/5PG4eOL0Xoc) | Download builds: 🔗[site](https://ims.cr5.space/desktop) 🔗[itch.io](https://nordth.itch.io/imsc-desktop) 🔗[github](https://github.com/ImStocker/ims-creators/releases)

## Main features

### Write wiki docs

<img width="600" alt="image" src="https://github.com/user-attachments/assets/ea60bc2d-9845-4c9a-9d1b-a2a0aed280e1" />

Use the block editor to maintain a wiki on the game, use cross-references, Markdown and more.

### Design dialogues and scripts

<img width="600" alt="image" src="https://github.com/user-attachments/assets/0dbd3f54-79ee-4ae9-a819-01b748ef478a" />

Use the built-in dialogue editor to easily create branching dialogues, write storylines, and integrate them into the game's overall structure.

### Create levels and maps

<img width="600" alt="image" src="https://github.com/user-attachments/assets/b63f3d29-468d-4279-afdd-369ecae8da9f" />

Design locations, place objects and plan gameplay using visual diagrams and descriptions.

### Manage game data

<img width="600" alt="screen1" src="https://github.com/user-attachments/assets/27335c99-6528-4394-a250-a94dcb5cae53" />

Describe mechanics, characters, items, and other game elements using a user-friendly block editor. Build a database of game objects and integrate it with your engine.

### Synchronize with your game engine

<img width="600" alt="image" src="https://github.com/user-attachments/assets/3dd378ce-8710-4937-bc98-7e37b6492129" />

The created objects can be uploaded directly to the game engine in custom JSON or CSV formats and their changes can be tracked via Git.

## Run from source

Download repo and it's submodule:

```bash
git clone --recurse-submodules https://github.com/ImStocker/ims-creators.git
```

Install dependencies in 3 folders:

```
cd ims-app-base
npm i
cd ../creators
npm i
cd ../desktop
npm i
```

Copy default env:

```
cp .env.example .env
```

Run application

```
npm run dev
```

## License

[MIT license](./LICENSE)
