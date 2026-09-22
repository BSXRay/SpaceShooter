import greenfoot.*;  // (World, Actor, GreenfootImage, Greenfoot und MouseInfo)

/**
 * @author Bastian, Lenius 
 * @version 0.0.1-alpha
 */
public class ShooterWorld extends World
{

    /**
     * Konstruktor für Objekte der Klasse ShooterWorld
     * 
     */
    public ShooterWorld()
    {    
        // Erstellt eine neue Welt mit 600x800 Zellen und einer Zell-Größe von 1x1 Pixeln.
        super(600, 800, 1);
        erzeugeStartbelegung();
    }

    /**
     * Erzeugt den Shooter unten mittig, 20 Pixel vom unteren Rand entfernt.
     */
    public void erzeugeStartbelegung()
    {
        addObject(new Shooter(), getWidth() / 2, getHeight() - 20);
    }
}