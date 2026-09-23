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
        // 600 breit, 800 hoch
        super(700, 900, 1);
        erzeugeStartbelegung();
    }

    /**
     * Platziert den Shooter unten in der Mitte.
     */
    public void erzeugeStartbelegung()
    {
        addObject(new Shooter(), getWidth() / 2, getHeight() - 50);
    }
}