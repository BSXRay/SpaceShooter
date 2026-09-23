import greenfoot.*;

/**
 * The game world. Holds the background, the music
 * and spawns the meteors from the top.
 */
public class ShooterWorld extends World
{
    private GreenfootSound music;
    private boolean musicStarted = false;
    private boolean pWasPressed = false;

    public ShooterWorld()
    {
        // 600 wide, 900 tall
        super(600, 900, 1);

        setupStart();

        GreenfootImage background = new GreenfootImage("backg.png");
        background.scale(getWidth(), getHeight());
        setBackground(background);

        music = new GreenfootSound("Background_music.mp3");
        music.setVolume(40);
    }

    public void act()
    {
        // start the music on the first act()
        if (!musicStarted)
        {
            music.playLoop();
            musicStarted = true;
        }

        // P toggles pause / resume
        if (Greenfoot.isKeyDown("p") && !pWasPressed)
        {
            if (music.isPlaying())
            {
                music.pause();
            }
            else
            {
                music.playLoop();
            }

            pWasPressed = true;
        }

        // wait until P is released again
        if (!Greenfoot.isKeyDown("p"))
        {
            pWasPressed = false;
        }

        // from time to time drop a meteor at a random x position
        if (Greenfoot.getRandomNumber(100) < 2)
        {
            addObject(new Meteor(), Greenfoot.getRandomNumber(getWidth()), 10);
        }

        // and now and then a UFO alien comes down
        if (Greenfoot.getRandomNumber(100) < 2)
        {
            addObject(new Alien(), Greenfoot.getRandomNumber(getWidth()), 10);
        }
    }

    /**
     * Places the ship at the bottom, nicely centered.
     */
    public void setupStart()
    {
        addObject(new Shooter(), getWidth() / 2, getHeight() - 60);
    }
}