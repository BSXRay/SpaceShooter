# SpaceShooter
SpaceShooter ist für meine schule und ist ein goofy ahh greenfoot game
## 🚀 Play SpaceShooter

Play the game directly in your browser!

[![Play SpaceShooter](https://img.shields.io/badge/PLAY-SPACE%20SHOOTER-00d4ff?style=for-the-badge&logo=github)](https://bsxray.github.io/SpaceShooter/)

**Controls**
- `WASD` / Arrow Keys — Move
- `Space` — Shoot
- `P` — Toggle music
- `1` / `2` — Select difficult

# How to play
1. Install [Greenfoot](https://www.greenfoot.org/download)
2. Clone the repo to your local machine or download it
```
git clone https://github.com/BSXRay/SpaceShooter
```
4. Unzip the downloaded file
5. Open the **`greenfoot`** folder in Greenfoot

The original Greenfoot project lives in `greenfoot/` and is self-contained:
the Java sources, the compiled classes, `project.greenfoot` and its own
copies of the `images/` and `sounds/` folders (Greenfoot only finds
resources next to `project.greenfoot`).

## Repository structure

```
web/          the browser game (index.html, css, js) - shared by website and app
images/       shared image assets
sounds/       shared sound assets
android-app/  Capacitor Android app, loader and OTA update tooling
greenfoot/    the original Greenfoot project
doc/ -> greenfoot/doc/   generated Javadoc of the Greenfoot classes
```

The website and the Android app ship the exact same `web/`, `images/` and
`sounds/` files. See [ANDROID_SETUP.md](ANDROID_SETUP.md) for the app, the
signed OTA updates and the release process.

# Releases & Auto-Update

The Android app updates itself: it checks GitHub Releases on startup, verifies
the download with a signature and installs the new version. To publish a change:

```powershell
git add -A
git commit -m "feat: ..."
git push origin main
git tag v1.2.0
git push origin v1.2.0
```

The tag makes GitHub Actions build the game, sign it, build the signed APK and
publish the release. Installed apps pick the new version up on their next
start — nothing has to be re-installed. Only changes to the native app
(permissions, name, icon) require the new APK from
[Releases](https://github.com/BSXRay/SpaceShooter/releases/latest).

# Controls
* **A** | **<-** Left
* **D** | **->** Right
* **W** | **arrow up** Up
* **S** | **arrow down** Down
* **P** | Pause/resume the music

# Class Diagram - SpaceShooter

**Info:** `+` public, `-` private, `#` protected

## Shooter *(extends Actor)*

### Attributes

| Visibility | Type | Name |
|------------|------|------|
| `-` | int | lives |
| `-` | int | speed |
| `-` | int | shotCooldown |
| `-` | int | SHOT_DELAY |

### Methods

| Visibility | Return | Signature |
|------------|--------|-----------|
| `+` | - | Shooter() |
| `+` | void | act() |
| `-` | void | move() |
| `-` | void | shoot() |
| `-` | void | checkEdge() |
| `-` | void | updateLivesDisplay() |
| `+` | void | loseLives(int amount) |
| `+` | int | getLives() |

## Bullet *(extends Actor)*

### Attributes

| Visibility | Type | Name |
|------------|------|------|
| `-` | int | speed |
| `-` | int | strength |

### Methods

| Visibility | Return | Signature |
|------------|--------|-----------|
| `+` | - | Bullet() |
| `+` | void | act() |
| `-` | void | moveUp() |
| `-` | void | playSound() |
| `-` | void | removeAtTop() |
| `+` | int | getStrength() |

## Meteor *(extends Actor)*

### Attributes

| Visibility | Type | Name |
|------------|------|------|
| `-` | int | speed |
| `-` | int | damage |

### Methods

| Visibility | Return | Signature |
|------------|--------|-----------|
| `+` | - | Meteor() |
| `+` | void | act() |
| `-` | void | moveDown() |
| `-` | void | checkShipHit() |
| `-` | void | removeAtBottom() |

## Alien *(extends Actor, placeholder)*

### Attributes

| Visibility | Type | Name |
|------------|------|------|
| `-` | int | lives |
| `-` | int | posX |
| `-` | int | posY |

### Methods

| Visibility | Return | Signature |
|------------|--------|-----------|
| `+` | - | Alien() |
| `+` | void | testMethod() |

## ShooterWorld *(extends World)*

### Attributes

| Visibility | Type | Name |
|------------|------|------|
| `-` | GreenfootSound | music |
| `-` | boolean | musicStarted |
| `-` | boolean | pWasPressed |

### Methods

| Visibility | Return | Signature |
|------------|--------|-----------|
| `+` | - | ShooterWorld() |
| `+` | void | act() |
| `+` | void | setupStart() |

## Relationships

```
Shooter      --|> Actor
Bullet       --|> Actor
Meteor       --|> Actor
Alien        --|> Actor
ShooterWorld --|> World

ShooterWorld --> Shooter  (places ship on start)
ShooterWorld --> Meteor   (spawns falling meteors)
Shooter      --> Bullet   (fires when space is pressed)
Meteor       --> Shooter  (calls loseLives on collision)
```
# License
MIT
