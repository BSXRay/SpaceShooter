/**
 * Der Shooter ist das Raumschiff des Spielers.
 * Er wird mit den Pfeiltasten (links/rechts) gesteuert
 * und kann am unteren Rand von Rand zu Rand fahren.
 */
import greenfoot.*;

public class Shooter extends Actor
{
    private int Leben;
    private int Geschwindigkeit;
    private int SchussCooldown;
    private static final int SCHUSS_ABSTAND = 12;

    public Shooter()
    {
        Leben = 3;
        Geschwindigkeit = 4;
        SchussCooldown = 0;
        setImage("raumschiff.png");
        getImage().scale(40, 30);
    }

    public void act()
    {
        bewegen();
        schiessen();
    }

    private void schiessen()
    {
        if (SchussCooldown > 0)
        {
            SchussCooldown--;
        }
        if (Greenfoot.isKeyDown("space") && SchussCooldown == 0)
        {
            getWorld().addObject(new Geschosse(), getX(), getY() - getImage().getHeight() / 2 - 5);
            SchussCooldown = SCHUSS_ABSTAND;
        }
    }

    private void bewegen()
    {
        if (Greenfoot.isKeyDown("left"))
        {
            setLocation(getX() - Geschwindigkeit, getY());
        }
        if (Greenfoot.isKeyDown("right"))
        {
            setLocation(getX() + Geschwindigkeit, getY());
        }
        anGrenzePruefen();
    }

    private void anGrenzePruefen()
    {
        int halbeBreite = getImage().getWidth() / 2;
        int weltBreite = getWorld().getWidth();

        if (getX() < halbeBreite)
        {
            setLocation(halbeBreite, getY());
        }
        else if (getX() > weltBreite - halbeBreite)
        {
            setLocation(weltBreite - halbeBreite, getY());
        }
    }

    public int getLeben()
    {
        return Leben;
    }
}