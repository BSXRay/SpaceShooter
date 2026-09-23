# SpaceShooter
SpaceShooter ist für meine schule und ist ein goofy ahh greenfoot game

# How to play
1. Install [Greenfoot](https://www.greenfoot.org/download)
2. Clone the repo to your local machine or download it
```
git clone https://github.com/BSXRay/SpaceShooter
```
4. Unzip the downloaded file
5. Open the folder in Greenfoot
# Controls
* **A** | **<-** Left
* **D** | **->** Right
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
