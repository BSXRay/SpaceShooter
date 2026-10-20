"use strict";

// --------------------------------------------------
// GAME LOOP
// --------------------------------------------------

function frame(time) {
  if (!lastTime) {
    lastTime = time;
  }

  accumulator += Math.min(time - lastTime, 100);
  lastTime = time;

  // 50 updates per second
  while (accumulator >= 20) {
    update();
    accumulator -= 20;
  }

  if (mode === "menu") {
    drawMenu();
  } else {
    drawGame();
  }

  requestAnimationFrame(frame);
}

reset();
requestAnimationFrame(frame);
