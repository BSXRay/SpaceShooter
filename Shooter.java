/**
 * The player's spaceship.
 * Move it left and right with the arrow keys (or A/D) at the bottom,
 * press space to shoot upwards. Shows the current lives top left.
 */
import greenfoot.*;

public class Shooter extends Actor
{
    private int lives;
    private int speed;
    private int shotCooldown;
    private int score;
    private static final int SHOT_DELAY = 12;
    private static final int MAX_LIVES = 3;

    public Shooter()
    {
        lives = 3;
        speed = 4;
        shotCooldown = 0;
        score = 0;
        setImage("shooter.png");
        getImage().scale(100, 120);
    }

    public void act()
    {
        // called every simulation step
        move();
        shoot();
        updateLivesDisplay();
    }

    private void move()
    {
        // arrow keys, and A/D as a bonus
        if (Greenfoot.isKeyDown("left") || Greenfoot.isKeyDown("a"))
        {
            setLocation(getX() - speed, getY());
        }
        if (Greenfoot.isKeyDown("right") || Greenfoot.isKeyDown("d"))
        {
            setLocation(getX() + speed, getY());
        }
        checkEdge();
    }

    private void shoot()
    {
        // wait until the cooldown is over
        if (shotCooldown > 0)
        {
            shotCooldown--;
        }
        if (Greenfoot.isKeyDown("space") && shotCooldown == 0)
        {
            // spawn the shot right above the ship
            getWorld().addObject(new Bullet(), getX(), getY() - getImage().getHeight() / 2 - 5);
            shotCooldown = SHOT_DELAY;
        }
    }

    private void checkEdge()
    {
        // keeps the ship inside the world
        int halfWidth = getImage().getWidth() / 2;
        int worldWidth = getWorld().getWidth();

        if (getX() < halfWidth)
        {
            setLocation(halfWidth, getY());
        }
        else if (getX() > worldWidth - halfWidth)
        {
            setLocation(worldWidth - halfWidth, getY());
        }
    }

    private void updateLivesDisplay()
    {
        // shows the current lives, top left corner
        getWorld().showText("LIVES: " + lives, 70, 30);
        // shows the score, top right corner
        getWorld().showText("SCORE: " + score, getWorld().getWidth() - 70, 30);

        // no lives left, so the game is over
        if (lives <= 0)
        {
            getWorld().showText("GAME OVER", getWorld().getWidth() / 2, getWorld().getHeight() / 2);
            getWorld().showText("SCORE: " + score, getWorld().getWidth() / 2, getWorld().getHeight() / 2 + 30);
            Greenfoot.stop();
        }
    }

    public void loseLives(int amount)
    {
        lives = lives - amount;
    }

    public int getLives()
    {
        return lives;
    }

    public void addLife(int amount)
    {
        lives = lives + amount;
        // never go above the maximum
        if (lives > MAX_LIVES)
        {
            lives = MAX_LIVES;
        }
    }

    public void addScore(int amount)
    {
        score = score + amount;
        // the score never goes below zero
        if (score < 0)
        {
            score = 0;
        }
    }
}