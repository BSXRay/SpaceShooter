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
    private static final int SHOT_DELAY = 12;

    public Shooter()
    {
        lives = 3;
        speed = 4;
        shotCooldown = 0;
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
    }

    public void loseLives(int amount)
    {
        lives = lives - amount;
    }

    public int getLives()
    {
        return lives;
    }
}