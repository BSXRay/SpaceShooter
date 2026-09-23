/**
 * The shot fired by the player.
 * Flies straight upwards until it reaches the top edge.
 */
import greenfoot.*;

public class Bullet extends Actor
{
    private int speed;
    private int strength;

    public Bullet()
    {
        speed = 10;
        strength = 1;
        setImage("geschoss.png");
        getImage().scale(80, 60);
        playSound(); // play shooting sound
    }

    public void act()
    {
        moveUp();
        removeAtTop();
    }

    private void moveUp()
    {
        setLocation(getX(), getY() - speed);
    }

    private void playSound()
    {
        Greenfoot.playSound("pew.mp3");
    }

    private void removeAtTop()
    {
        // reached the top, so remove it
        if (getY() <= getImage().getHeight() / 2)
        {
            getWorld().removeObject(this);
        }
    }

    public int getStrength()
    {
        // will be used for the damage later
        return strength;
    }
}