/**
 * Das Raumschiff des Spielers.
 * Mit den Pfeiltasten faehrt es am unteren Rand von links nach rechts,
 * mit der Leertaste schiesst es nach oben.
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
        Leben = 5;
        Geschwindigkeit = 4;
        SchussCooldown = 0;
        setImage("shooter.png");
        getImage().scale(100, 120);
    }

    public void act()
    {
        // wird bei jedem Simulationsschritt aufgerufen
        bewegen();
        schiessen();
        lebenAnzeigen();
    }

    private void schiessen()
    {
        // warten bis der Cooldown abgelaufen ist
        if (SchussCooldown > 0)
        {
            SchussCooldown--;
        }
        if (Greenfoot.isKeyDown("space") && SchussCooldown == 0)
        {
            // Geschoss direkt ueber dem Schiff spawnen
            getWorld().addObject(new Geschosse(), getX(), getY() - getImage().getHeight() / 2 - 5);
            SchussCooldown = SCHUSS_ABSTAND;
        }
    }

    private void bewegen()
    {
        // Pfeiltasten links/rechts
        if (Greenfoot.isKeyDown("left"))
        {
            setLocation(getX() - Geschwindigkeit, getY());
        }
        else if (Greenfoot.isKeyDown("a"))
        {
            setLocation(getX() - Geschwindigkeit, getY());
        }
        if (Greenfoot.isKeyDown("right"))
        {
            setLocation(getX() + Geschwindigkeit, getY());
        }
        else if (Greenfoot.isKeyDown("d"))
        {
            setLocation(getX() + Geschwindigkeit, getY());
        }
        anGrenzePruefen();
    }

    private void anGrenzePruefen()
    {
        // verhindert, dass das Schiff aus dem Bild faehrt
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

    private void lebenAnzeigen()
    {
        // der aktuelle Lebenstand oben links
        getWorld().showText("LIVES: " + Leben, 70, 30);
    }

    public void verliereLeben(int anzahl)
    {
        Leben = Leben - anzahl;
    }

    public int getLeben()
    {
        return Leben;
    }
}