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
    private GreenfootImage gameBackground;
    private int lastLives = -1;
    private int lastScore = -1;

    public ShooterWorld()
    {
        // 600 wide, 900 tall
        super(600, 900, 1);

        // menu background, the game background is set later
        GreenfootImage background = new GreenfootImage("backg2.png");
        background.scale(getWidth(), getHeight());

        // big text drawn directly on the menu background
        background.setFont(new Font("Arial", true, false, 46));
        background.setColor(Color.WHITE);
        background.drawString("SPACE SHOOTER", centerX(background, "SPACE SHOOTER"), 150);

        background.setFont(new Font("Arial", true, false, 26));
        background.drawString("press 1 for EASY", centerX(background, "press 1 for EASY"), 320);
        background.drawString("press 2 for HARD", centerX(background, "press 2 for HARD"), 370);

        // the tip is a long text, so it gets a smaller font to fit
        background.setFont(new Font("Arial", true, false, 20));
        background.drawString("TIP: in hard mode you can shoot the meteors", centerX(background, "TIP: in hard mode you can shoot the meteors"), 430);

        setBackground(background);
    }

    private int centerX(GreenfootImage image, String text)
    {
        // rough estimate to center the text horizontally
        int textWidth = text.length() * (image.getFont().getSize() * 6 / 10);
        return (image.getWidth() - textWidth) / 2;
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

        updateHud();

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

    private void updateHud()
    {
        // redraws the HUD text onto a fresh copy of the game background
        Shooter ship = getObjects(Shooter.class).isEmpty()
                ? null
                : (Shooter) getObjects(Shooter.class).get(0);
        if (ship == null)
        {
            return;
        }

        // only redraw when lives or score changed, that saves a lot of work
        if (ship.getLives() == lastLives && ship.getScore() == lastScore)
        {
            return;
        }
        lastLives = ship.getLives();
        lastScore = ship.getScore();

        GreenfootImage hud = new GreenfootImage(gameBackground);

        hud.setFont(new Font("Arial", true, false, 24));
        hud.setColor(Color.WHITE);
        hud.drawString("LIVES: " + ship.getLives(), 15, 30);

        String scoreText = "SCORE: " + ship.getScore();
        int scoreWidth = scoreText.length() * (24 * 6 / 10);
        hud.drawString(scoreText, getWidth() - 15 - scoreWidth, 30);

        // no lives left, so the game is over
        if (ship.getLives() <= 0)
        {
            hud.setFont(new Font("Arial", true, false, 46));
            hud.drawString("GAME OVER", centerX(hud, "GAME OVER"), getHeight() / 2);

            hud.setFont(new Font("Arial", true, false, 30));
            hud.drawString("SCORE: " + ship.getScore(), centerX(hud, scoreText), getHeight() / 2 + 60);

            Greenfoot.stop();
        }

        setBackground(hud);
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
        // switch to the game background (removes the menu texts too)
        gameBackground = new GreenfootImage("backg.png");
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