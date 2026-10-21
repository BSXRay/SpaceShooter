/**
 * The player's spaceship.
 * Move it left and right with the arrow keys (or A/D),
 * move it up and down with W/S or the arrow keys,
 * press space to shoot upwards.
 * Shows the current lives top left.
 */
import greenfoot.*;

public class Shooter extends Actor
{
    private int lives;
    private int speed;
    private int shotCooldown;
    private int score;

    private static final int SHOT_DELAY = 10;
    private static final int MAX_LIVES = 5;

    public Shooter()
    {
        lives = 5;
        speed = 10;
        shotCooldown = 0;
        score = 0;

        setImage("shooter.png");
        getImage().scale(100, 120);
    }

    public void act()
    {
        move();
        shoot();
    }

    private void move()
    {
        int x = getX();
        int y = getY();

        // Move left
        if (Greenfoot.isKeyDown("left") || Greenfoot.isKeyDown("a"))
        {
            x -= speed;
        }

        // Move right
        if (Greenfoot.isKeyDown("right") || Greenfoot.isKeyDown("d"))
        {
            x += speed;
        }

        // Move up
        if (Greenfoot.isKeyDown("up") || Greenfoot.isKeyDown("w"))
        {
            y -= speed;
        }

        // Move down
        if (Greenfoot.isKeyDown("down") || Greenfoot.isKeyDown("s"))
        {
            y += speed;
        }

        setLocation(x, y);

        checkEdge();
    }

    private void shoot()
    {
        // Wait until the cooldown is over
        if (shotCooldown > 0)
        {
            shotCooldown--;
        }

        // Shoot when space is pressed
        if (Greenfoot.isKeyDown("space") && shotCooldown == 0)
        {
            getWorld().addObject(
                new Bullet(),
                getX(),
                getY() - getImage().getHeight() / 2 - 5
            );

            shotCooldown = SHOT_DELAY;
        }
    }

    private void checkEdge()
    {
        int halfWidth = getImage().getWidth() / 2;
        int halfHeight = getImage().getHeight() / 2;

        int worldWidth = getWorld().getWidth();
        int worldHeight = getWorld().getHeight();

        int x = getX();
        int y = getY();

        // Left edge
        if (x < halfWidth)
        {
            x = halfWidth;
        }

        // Right edge
        if (x > worldWidth - halfWidth)
        {
            x = worldWidth - halfWidth;
        }

        // Top edge
        if (y < halfHeight)
        {
            y = halfHeight;
        }

        // Bottom edge
        if (y > worldHeight - halfHeight)
        {
            y = worldHeight - halfHeight;
        }

        setLocation(x, y);
    }

    public void loseLives(int amount)
    {
        lives -= amount;
    }

    public int getLives()
    {
        return lives;
    }

    public int getScore()
    {
        return score;
    }

    public void addLife(int amount)
    {
        lives += amount;

        // Never go above the maximum
        if (lives > MAX_LIVES)
        {
            lives = MAX_LIVES;
        }
    }

    public void addScore(int amount)
    {
        score += amount;

        // Score never goes below zero
        if (score < 0)
        {
            score = 0;
        }
    }
}
