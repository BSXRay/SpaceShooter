/**
 * A meteor that falls down from the top.
 * It is not controlled by the player and
 * costs 1 live when it hits the ship.
 */
import greenfoot.*;

public class Meteor extends Actor
{
    private int speed;
    private int damage;
    private boolean shootable; // only in hard mode you can shoot them
    // smaller hitbox: only counts as a hit when really close to the ship's center
    private static final int HIT_RANGE_X = 35;
    private static final int HIT_RANGE_Y = 45;

    public Meteor()
    {
        this(false);
    }

    public Meteor(boolean canBeShot)
    {
        speed = 3;
        damage = 1;
        shootable = canBeShot;
        setImage("meteorite.png");
        getImage().scale(60, 60);
    }

    public void act()
    {
        moveDown();
        checkBulletHit();
        // after a hit the meteor is already removed, so skip the rest
        if (getWorld() != null)
        {
            checkShipHit();
        }
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

    private void checkBulletHit()
    {
        // a bullet destroys the meteor (only possible in hard mode)
        Bullet bullet = (Bullet) getOneIntersectingObject(Bullet.class);
        if (shootable && bullet != null)
        {
            getWorld().removeObject(bullet);
            getWorld().removeObject(this);
        }
    }

    private void checkShipHit()
    {
        // if it touches the ship AND is close to its center, take lives
        Shooter ship = (Shooter) getOneIntersectingObject(Shooter.class);
        if (ship != null && isCloseToShip(ship))
        {
            ship.loseLives(damage);
            getWorld().removeObject(this);
        }
    }

    private boolean isCloseToShip(Shooter ship)
    {
        // small collision box around the middle of the ship
        int dx = getX() - ship.getX();
        int dy = getY() - ship.getY();
        return Math.abs(dx) <= HIT_RANGE_X && Math.abs(dy) <= HIT_RANGE_Y;
    }

    private void removeAtBottom()
    {
        // despawn as soon as the meteor hits the bottom edge
        if (getY() + getImage().getHeight() / 2 >= getWorld().getHeight())
        {
            getWorld().removeObject(this);
        }
    }
}