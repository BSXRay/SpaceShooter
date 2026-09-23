/**
 * A meteor that falls down from the top.
 * It is not controlled by the player and
 * costs 2 lives when it hits the ship.
 */
import greenfoot.*;

public class Meteoriten extends Actor
{
    private int speed;
    private int damage;

    public Meteoriten()
    {
        speed = 3;
        damage = 2;
        setImage("meteorite.png");
        getImage().scale(60, 60);
    }

    public void act()
    {
        moveDown();
        checkShipHit();
        // after a hit the meteor is already removed, so skip the rest
        if (getWorld() != null)
        {
            removeAtBottom();
        }
    }

    private void moveDown()
    {
        // move straight downwards
        setLocation(getX(), getY() + speed);
    }

    private void checkShipHit()
    {
        // if it touches the ship, take lives and remove the meteor
        Shooter ship = (Shooter) getOneIntersectingObject(Shooter.class);
        if (ship != null)
        {
            ship.verliereLeben(damage);
            getWorld().removeObject(this);
        }
    }

    private void removeAtBottom()
    {
        // below the bottom edge, the meteor is gone
        if (getY() > getWorld().getHeight() + getImage().getHeight() / 2)
        {
            getWorld().removeObject(this);
        }
    }
}