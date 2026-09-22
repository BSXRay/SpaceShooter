/**
 * Ein Geschoss, das vom Shooter abgefeuert wird.
 * Es bewegt sich gerade nach oben, bis es die Welt verlaesst.
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
        getImage().scale(40, 30);
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
        if (getY() <= getImage().getHeight() / 2)
        {
            getWorld().removeObject(this);
        }
    }

    public int getStaerke()
    {
        return Staerke;
    }
}