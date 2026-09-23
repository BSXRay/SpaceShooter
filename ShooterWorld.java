import greenfoot.*;

/**
 * @author Bastian, Lenius
 * @version 0.0.1-alpha
 */
public class ShooterWorld extends World
{
    private GreenfootSound musik;
    private boolean musikGestartet = false;
    private boolean pWarGedrueckt = false;

    public ShooterWorld()
    {
        // 600 breit, 900 hoch
        super(600, 900, 1);

        erzeugeStartbelegung();

        GreenfootImage hintergrund = new GreenfootImage("backg.png");
        hintergrund.scale(getWidth(), getHeight());
        setBackground(hintergrund);

        musik = new GreenfootSound("Background_music.mp3");
        musik.setVolume(40);
    }

    public void act()
    {
        // Musik beim ersten act() starten
        if (!musikGestartet)
        {
            musik.playLoop();
            musikGestartet = true;
        }

        // P-Taste zum Pausieren / Fortsetzen
        if (Greenfoot.isKeyDown("p") && !pWarGedrueckt)
        {
            if (musik.isPlaying())
            {
                musik.pause();
            }
            else
            {
                musik.playLoop();
            }

            pWarGedrueckt = true;
        }

        // Warten, bis P losgelassen wurde
        if (!Greenfoot.isKeyDown("p"))
        {
            pWarGedrueckt = false;
        }
    }

    /**
     * Platziert den Shooter unten in der Mitte.
     */
    public void erzeugeStartbelegung()
    {
        addObject(new Shooter(), getWidth() / 2, getHeight() - 50);
    }
}