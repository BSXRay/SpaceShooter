import greenfoot.*;

/**
 * The game world. Shows the difficulty menu on the first start
 * and then spawns the meteors and UFOs from the top.
 */
public class ShooterWorld extends World
{
    private GreenfootSound music;
    private boolean musicStarted = false;
    private boolean pWasPressed = false;
    private int difficulty = 0; // 0 = menu, 1 = easy, 2 = hard
    private int gameTicks = 0;
    private int meteorSpawnTimer = 0;

    public ShooterWorld()
    {
        // 600 wide, 900 tall
        super(600, 900, 1);

        // menu background, the game background is set later
        GreenfootImage background = new GreenfootImage("backg2.png");
        background.scale(getWidth(), getHeight());
        setBackground(background);

        // menu shown on the first start
        showText("SPACE SHOOTER", getWidth() / 2, 180);
        showText("press 1 for EASY", getWidth() / 2, 320);
        showText("press 2 for HARD", getWidth() / 2, 370);
        showText("TIP: in hard mode you can shoot the meteors", getWidth() / 2, 420);
    }

    public void act()
    {
        // nothing starts until a difficulty is chosen
        if (difficulty == 0)
        {
            chooseDifficulty();
            return;
        }

        gameTicks++;

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

        boolean isHard = (difficulty == 2);

        // meteors fall in a steady rhythm, so they don't come in clumps
        // in easy mode they are rarer than in hard mode
        int meteorSpawnGap = isHard ? 25 : 50;
        meteorSpawnTimer++;
        if (meteorSpawnTimer >= meteorSpawnGap)
        {
            meteorSpawnTimer = 0;
            // only in hard mode you can shoot the meteors
            addObject(new Meteor(isHard), Greenfoot.getRandomNumber(getWidth()), 10);
        }

        // and now and then a UFO alien comes down
        // in easy mode fewer aliens, in hard mode it stays like before
        int alienSpawn = isHard ? 2 : 1;
        if (Greenfoot.getRandomNumber(100) < alienSpawn)
        {
            // in hard mode the aliens get faster over time, in easy mode the speed stays constant
            int fallBoost = isHard ? gameTicks / 300 : 0;
            addObject(new Alien(isHard, fallBoost), Greenfoot.getRandomNumber(getWidth()), 10);
        }
    }

    private void chooseDifficulty()
    {
        if (Greenfoot.isKeyDown("1"))
        {
            difficulty = 1;
            startGame();
        }
        else if (Greenfoot.isKeyDown("2"))
        {
            difficulty = 2;
            startGame();
        }
    }

    private void startGame()
    {
        // remove the menu texts
        showText("", getWidth() / 2, 180);
        showText("", getWidth() / 2, 320);
        showText("", getWidth() / 2, 370);
        showText("", getWidth() / 2, 420);

        // switch to the game background
        GreenfootImage gameBackground = new GreenfootImage("backg.png");
        gameBackground.scale(getWidth(), getHeight());
        setBackground(gameBackground);

        setupStart();

        music = new GreenfootSound("Background_music.mp3");
        music.setVolume(40);
    }

    /**
     * Places the ship at the bottom, nicely centered.
     */
    public void setupStart()
    {
        addObject(new Shooter(), getWidth() / 2, getHeight() - 60);
    }
}