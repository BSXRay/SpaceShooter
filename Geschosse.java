/**
 * Das Projektil des Spielers.
 * Wird vom Shooter abgefeuert und fliegt gerade nach oben,
 * bis es den oberen Rand erreicht.
 */
import greenfoot.*;

public class Geschosse extends Actor
{
    private int Geschwindigkeit;
    private int Staerke;

    public Geschosse()
    {
        Geschwindigkeit = 10;
        Staerke = 1;
        setImage("geschoss.png");
        getImage().scale(80, 60);
    }

    public void act()
    {
        bewegeNachOben();
        amRandEntfernen();
    }

    private void bewegeNachOben()
    {
        setLocation(getX(), getY() - Geschwindigkeit);
    }

    private void amRandEntfernen()
    {
        // oben angekommen, dann loeschen
        if (getY() <= getImage().getHeight() / 2)
        {
            getWorld().removeObject(this);
        }
    }

    public int getStaerke()
    {
        // wird spaeter fuer den Schaden gebraucht
        return Staerke;
    }
}