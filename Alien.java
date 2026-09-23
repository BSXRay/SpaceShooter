/**
 * A UFO that flies left and right on the x axis
 * while moving slowly down towards the player.
 * Shooting it gives one life back and adds one point.
 */
import greenfoot.*;

public class Alien extends Actor
{
    private int speedX;
    private int speedY;

    public Alien()
    {
        speedX = 3;
        speedY = 2;
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
    }

    private void bounceAtEdges()
    {
        // change direction when reaching the left or right edge
        int halfWidth = getImage().getWidth() / 2;
        int worldWidth = getWorld().getWidth();
        if (getX() <= halfWidth || getX() >= worldWidth - halfWidth)
        {
            speedX = -speedX;
        }
    }

    private void checkBulletHit()
    {
        // a hit bullet removes the alien and rewards the player
        Bullet bullet = (Bullet) getOneIntersectingObject(Bullet.class);
        if (bullet != null)
        {
            Shooter ship = getWorld().getObjects(Shooter.class).isEmpty()
                    ? null
                    : (Shooter) getWorld().getObjects(Shooter.class).get(0);
            if (ship != null)
            {
                ship.addLife(1);
                ship.addScore(1);
            }
            getWorld().removeObject(bullet);
            getWorld().removeObject(this);
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