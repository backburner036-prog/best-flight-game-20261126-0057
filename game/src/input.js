// input.js — keyboard + mouse. Every action is on the keyboard; the menu
// also answers mouse clicks, and dragging steers the aircraft.
export function makeInput() {
  return {
    keys: new Set(),
    // Held-flight inputs, recomputed each frame from keys + drag.
    throttleUp: false, throttleDown: false,
    pitchUp: false, pitchDown: false,
    rollLeft: false, rollRight: false,
    brake: false, flaps: false,
    dragPitch: 0, dragRoll: 0,
    dragging: false,
    mouse: { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 },
    pressed: new Set(), // keys pressed since last frame (edge-triggered)
  };
}

const KEYMAP = {
  KeyW: 'throttleUp', KeyS: 'throttleDown',
  ArrowUp: 'pitchDown', ArrowDown: 'pitchUp',
  ArrowLeft: 'rollLeft', ArrowRight: 'rollRight',
  Space: 'brake',
};

export function attachInput(input, canvas, onFirstGesture) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
    if (onFirstGesture) onFirstGesture();
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    input.dragging = true;
    input.dragStartX = input.mouse.x; input.dragStartY = input.mouse.y;
    if (onFirstGesture) onFirstGesture();
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    if (input.dragging) {
      input.dragRoll = Math.max(-1, Math.min(1, (input.mouse.x - input.dragStartX) / 180));
      input.dragPitch = Math.max(-1, Math.min(1, (input.mouse.y - input.dragStartY) / 140));
    }
  });
  const endDrag = (e) => {
    if (input.dragging) {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * (canvas.width / r.width);
      const y = (e.clientY - r.top) * (canvas.height / r.height);
      // A short click (not a drag) counts as a menu click.
      if (Math.hypot(x - input.dragStartX, y - input.dragStartY) < 8) {
        input.mouse.clicked = true; input.mouse.clickX = x; input.mouse.clickY = y;
      }
    }
    input.dragging = false; input.dragRoll = 0; input.dragPitch = 0;
  };
  canvas.addEventListener('mouseup', endDrag);
  canvas.addEventListener('mouseleave', () => { input.dragging = false; input.dragRoll = 0; input.dragPitch = 0; });
}

// Recompute held inputs from the key set; call once per frame.
export function pollInput(input) {
  const k = input.keys;
  input.throttleUp = k.has('KeyW');
  input.throttleDown = k.has('KeyS');
  input.pitchUp = k.has('ArrowDown') || input.dragPitch > 0.25;
  input.pitchDown = k.has('ArrowUp') || input.dragPitch < -0.25;
  input.rollLeft = k.has('ArrowLeft') || input.dragRoll < -0.25;
  input.rollRight = k.has('ArrowRight') || input.dragRoll > 0.25;
  input.brake = k.has('Space');
  input.flaps = k.has('KeyF');
}

// True once when a key goes down; the set is cleared by main.js each frame.
export function wasPressed(input, code) {
  return input.pressed.has(code);
}

export function clearPressed(input) {
  input.pressed.clear();
  input.mouse.clicked = false;
}

// Menu click helper: true when the last click landed inside the rect.
export function clickedIn(input, x, y, w, h) {
  return input.mouse.clicked
    && input.mouse.clickX >= x && input.mouse.clickX <= x + w
    && input.mouse.clickY >= y && input.mouse.clickY <= y + h;
}
