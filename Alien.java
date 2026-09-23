/**
 * A UFO that flies left and right on the x axis
 * while moving slowly down towards the player.
 * It needs 3 hits to be destroyed, shooting it
 * then gives one life back and adds one point.
 */
import greenfoot.*;

public class Alien extends Actor
{
    private int speedX;
    private int speedY;
    private int lives;

    public Alien()
    {
        speedX = 3;
        speedY = 2;
        lives = 3;
        // random starting direction, so it looks a bit chaotic
        if (Greenfoot.getRandomNumber(2) == 0)
        {
            speedX = -speedX;
        }
        setImage("alien_1.png");
        getImage().scale(80, 50);
    }

    public void act()
    {
        move();
        bounceAtEdges();
        checkBulletHit();
        if (getWorld() != null)
        {
            checkShipHit();
        }
        if (getWorld() != null)
        {
            removeAtBottom();
        }
    }

    private void move()
    {
        // fly sideways and slowly downwards
        setLocation(getX() + speedX, getY() + speedY);

        // a bit of chaos: sometimes the alien suddenly turns around
        if (Greenfoot.getRandomNumber(150) == 0)
        {
            speedX = -speedX;
        }
    }

    private void bounceAtEdges()
    {
        // push the alien back inside and point it the right way
        int halfWidth = getImage().getWidth() / 2;
        int worldWidth = getWorld().getWidth();

        if (getX() < halfWidth)
        {
            speedX = Math.abs(speedX);
        }
        else if (getX() > worldWidth - halfWidth)
        {
            speedX = -Math.abs(speedX);
        }
    }

    private void checkBulletHit()
    {
        // each hit takes one life, the alien dies after 3 hits
        Bullet bullet = (Bullet) getOneIntersectingObject(Bullet.class);
        if (bullet != null)
        {
            getWorld().removeObject(bullet);
            lives = lives - bullet.getStrength();
            if (lives <= 0)
            {
                // destroyed: reward the player
                Shooter ship = getWorld().getObjects(Shooter.class).isEmpty()
                        ? null
                        : (Shooter) getWorld().getObjects(Shooter.class).get(0);
                if (ship != null)
                {
                    ship.addLife(1);
                    ship.addScore(1);
                }
                getWorld().removeObject(this);
            }
        }
    }

    private void checkShipHit()
    {
        // touching the ship costs one life
        Shooter ship = (Shooter) getOneIntersectingObject(Shooter.class);
        if (ship != null)
        {
            penalizePlayer();
            getWorld().removeObject(this);
        }
    }

    private void removeAtBottom()
    {
        // an unshot alien at the bottom also punishes the player
        if (getY() + getImage().getHeight() / 2 >= getWorld().getHeight())
        {
            penalizePlayer();
            getWorld().removeObject(this);
        }
    }

    private void penalizePlayer()
    {
        // player loses a life and 10 points
        Shooter ship = getWorld().getObjects(Shooter.class).isEmpty()
                ? null
                : (Shooter) getWorld().getObjects(Shooter.class).get(0);
        if (ship != null)
        {
            ship.loseLives(1);
            ship.addScore(-10);
        }
    }
}