/**
 * A meteor that falls down from the top.
 * It is not controlled by the player and
 * costs 2 lives when it hits the ship.
 */
import greenfoot.*;

public class Meteor extends Actor
{
    private int speed;
    private int damage;

    public Meteor()
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
            ship.loseLives(damage);
            getWorld().removeObject(this);
        }
    }

    private void removeAtBottom()
    {
        // as soon as the meteor reaches the bottom edge, remove it
        if (getY() - getImage().getHeight() / 2 >= getWorld().getHeight())
        {
            getWorld().removeObject(this);
        }
    }
}