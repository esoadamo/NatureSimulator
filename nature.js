const $ = document.querySelector.bind(document);
const tickCounter = $("#tickCounter");
const musicPlayer = $("#audioPlayer");

/**
 * Dictionary of all possible tiles. Loaded from nature/blocks.json
 * @type {Object}
 */
const tiles = {};

let map = []; // 2D array of tiles / null
let tick = -1; // current tick number
let music = null;

let timerTick = null;

/**
 * Start loading all tiles
 * @return {[type]} [description]
 */
async function init() {
  Object.assign(tiles, JSON.parse(await new Promise(resolve => {
    let request = new XMLHttpRequest();
    request.open('GET', 'nature/blocks.json');
    request.onload = () => {
      if (request.readyState === 4)
        resolve(request.responseText);
    }
    request.send(null);
  })));

  for (let tileName of Object.keys(tiles)) {
    tiles[tileName].name = tileName;
    tiles[tileName].img = new Image();
    tiles[tileName].img.src = tiles[tileName].imgSrc;
    tiles[tileName].img.onload = drawMap;
  }

  map = generateMap();

  nextTick(); // init GUI

  drawMap();

  timerTick = setInterval(nextTick, 500);
}

/**
 * Increment tick and evolve the map
 */
function nextTick(repaint = true) {
  tick++;
  if (repaint)
    tickCounter.textContent = `Tick ${tick}`;
  if (tick === 0) return; // this is just the init, do not evolve anything yet

  let newFields = []; // all previously null fields in format [x, y, tiles.type]

  for (let y = 0; y < map.length; y++)
    for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] === null) // this block is empty, it cannot be evolved
        continue;

      let changeMe = {};

      for (let neighbor of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1]
        ]) {
        let nX = neighbor[0];
        let nY = neighbor[1];

        if (nX < 0 || nX >= map[0].length || nY < 0 || nY >= map.length || map[nY][nX] === null) {
          if (randomWithWeight({
              spread: map[y][x].spread
            }, 200) !== null)
            newFields.push([nX, nY, map[y][x]]);
        } else if (map[y][x].name in map[nY][nX].clone) {
          if (!(map[nY][nX].name in changeMe)) changeMe[map[nY][nX].name] = 0;
          changeMe[map[nY][nX].name] += map[nY][nX].clone[map[y][x].name];
        }
      }

      if ('canChangeInto' in map[y][x])
        for (let option of Object.keys(map[y][x].canChangeInto)) {
          if (!(option in changeMe))
            changeMe[option] = 0;
          changeMe[option] += map[y][x].canChangeInto[option];
        }

      let changeMeInto = randomWithWeight(changeMe, 100 * Object.keys(changeMe).length);
      if (changeMeInto !== null) map[y][x] = tiles[changeMeInto];
    }

  if (newFields) {
    let newRow = [];
    for (let i = 0; i < map[0].length; i++) newRow.push(null);

    for (let i = 0; i < newFields.length; i++) {
      let nX = newFields[i][0];
      let nY = newFields[i][1];

      if (nY === -1) {
        map.splice(0, 0, newRow.slice());
        nY = 0;
        for (let ii = i + 1; ii < newFields.length; ii++)
          if (newFields[ii][1] === -1)
            newFields[ii][1] = 0;
      } else if (nY >= map.length)
        map.push(newRow.slice());

      if (nX === -1) {
        for (let y = 0; y < map.length; y++)
          map[y].splice(0, 0, null);
        nX = 0;
        for (let ii = i + 1; ii < newFields.length; ii++)
          if (newFields[ii][0] === -1)
            newFields[ii][0] = 0;
        newRow.push(null);
      } else if (nX >= map[0].length) {
        newRow.push(null);
        for (let y = 0; y < map.length; y++)
          map[y].push(null);
      }

      map[nY][nX] = newFields[i][2];
    }
  }

  if (repaint)
    drawMap();
}

function randomWithWeight(dict, optionOtherWeight = 0) {
  let total = 0;
  let borders = [];
  for (let item of Object.keys(dict)) {
    total += dict[item];
    borders.push([item, total]);
  }
  total += optionOtherWeight;
  let rNum = Math.random() * total;

  function find_smaller_than(
    array,
    x,
    left_boundary = 0,
    right_boundary = null
  ) {
    if (right_boundary === null) {
      if (!array.length) return null;
      right_boundary = array.length - 1;
    }

    let middle = Math.floor((left_boundary + right_boundary) / 2);

    if (left_boundary === right_boundary)
      return array[left_boundary][1] < x ? left_boundary : null;
    let middle_value = array[middle][1];
    if (middle_value >= x)
      return find_smaller_than(array, x, left_boundary, middle);
    if (middle_value < x)
      if (middle == right_boundary || array[middle + 1][1] >= x) return middle;
    return find_smaller_than(array, x, middle + 1, right_boundary);
  }

  let selectedItem = find_smaller_than(borders, rNum);
  if (selectedItem === null) selectedItem = 0;
  else selectedItem++;

  return selectedItem === borders.length ? null : borders[selectedItem][0];
}

function drawMap() {
  // create the canvas context
  let mapCanvas = $("#map");
  let ctx = mapCanvas.getContext("2d");

  // Set as your tile pixel sizes, alter if you are using larger tiles.
  let tileH = 25;
  let tileW = 52;

  mapCanvas.width = tileW * map[0].length + tileW;
  mapCanvas.height = tileH * map.length;

  let drawTile;

  ctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);

  // loop through our map and draw out the image represented by the number.
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      drawTile = map[y][x];
      if (drawTile === null || drawTile.img === null) continue;

      ctx.drawImage(
        drawTile.img,
        (y - x) * tileH + (map[0].length * tileW / 2),
        (y + x) * tileH / 2
      );
    }
  }
}

function choose(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fieldFilled(x, y, mapOverride = null) {
  if (mapOverride === null)
    mapOverride = map;
  return y >= 0 && y < mapOverride.length && x >= 0 && x < mapOverride[0].length && mapOverride[y][x] !== null;
}

function generateMap() {
  let size = [20, 20];
  let map = [];

  // Make everything grass
  for (let y = 0; y < size[1]; y++) {
    let row = [];
    for (let x = 0; x < size[0]; x++) row.push(tiles.grass);
    map.push(row);
  }

  let blocksTotal = size[0] * size[1];

  // Add lakes and rivers
  let waterBlocks = Math.floor(blocksTotal * (5 + (Math.random() * 50)) / 100);

  while (waterBlocks) {
    let y = Math.floor(Math.random() * size[1]);
    let x = Math.floor(Math.random() * size[0]);

    let riverLength = Math.floor(Math.random() * waterBlocks) + 1;
    for (let i = 0; i < riverLength; i++) {
      map[y][x] = tiles.water;

      let nX = x
      let nY = y;

      if (choose(['v', 'h']) === 'v')
        nY += choose([1, -1]);
      else
        nX += choose([1, -1]);

      if (fieldFilled(nX, nY, map)) {
        x = nX;
        y = nY;
        waterBlocks--;
      }
    }

    // Add mountains
    let mountainBlocks = Math.floor(blocksTotal * Math.random() * 10 / 100);

    while (mountainBlocks) {
      let y = Math.floor(Math.random() * size[1]);
      let x = Math.floor(Math.random() * size[0]);

      let riverLength = Math.floor(Math.random() * mountainBlocks) + 1;
      for (let i = 0; i < riverLength; i++) {
        map[y][x] = tiles.mountain;

        let nX = x
        let nY = y;

        if (choose(['v', 'h']) === 'v')
          nY += choose([1, -1]);
        else
          nX += choose([1, -1]);

        if (fieldFilled(nX, nY, map))
          if (map[nY][nX].name === "grass") {
            x = nX;
            y = nY;
          }
        mountainBlocks--;
      }
    }

    // Add forests
    let forestBlocks = Math.floor(blocksTotal * Math.random() * 15 / 100);

    while (forestBlocks) {
      let y = Math.floor(Math.random() * size[1]);
      let x = Math.floor(Math.random() * size[0]);

      let riverLength = Math.floor(Math.random() * forestBlocks) + 1;
      for (let i = 0; i < riverLength; i++) {
        map[y][x] = tiles.forest;

        let nX = x
        let nY = y;

        if (choose(['v', 'h']) === 'v')
          nY += choose([1, -1]);
        else
          nX += choose([1, -1]);

        if (fieldFilled(nX, nY, map))
          if (map[nY][nX].name === "grass") {
            x = nX;
            y = nY;
          }
        forestBlocks--;
      }
    }

    // Add sand
    let sandBlocks = Math.floor(blocksTotal * Math.random() * 5 / 100);

    while (sandBlocks) {
      let y = Math.floor(Math.random() * size[1]);
      let x = Math.floor(Math.random() * size[0]);

      let riverLength = Math.floor(Math.random() * sandBlocks) + 1;
      for (let i = 0; i < riverLength; i++) {
        map[y][x] = tiles.sand;

        let nX = x
        let nY = y;

        if (choose(['v', 'h']) === 'v')
          nY += choose([1, -1]);
        else
          nX += choose([1, -1]);

        if (fieldFilled(nX, nY, map))
          if (map[nY][nX].name === "grass") {
            x = nX;
            y = nY;
          }
        sandBlocks--;
      }
    }

    // Add house
    let houseBlocks = Math.floor(blocksTotal * Math.random() * 5 / 100);

    while (houseBlocks) {
      let y = Math.floor(Math.random() * size[1]);
      let x = Math.floor(Math.random() * size[0]);

      let riverLength = Math.floor(Math.random() * houseBlocks) + 1;
      for (let i = 0; i < riverLength; i++) {
        map[y][x] = tiles.house;

        let nX = x
        let nY = y;

        if (choose(['v', 'h']) === 'v')
          nY += choose([1, -1]);
        else
          nX += choose([1, -1]);

        if (fieldFilled(nX, nY, map))
          if (["grass", "forest"].indexOf(map[nY][nX].name) !== -1) {
            x = nX;
            y = nY;
          }
        houseBlocks--;
      }
    }
  }

  return map;
}

window.onload = init;

musicPlayer.onclick = () => {
  // Start music
  if (music === null) {
    /*
    Music by Eric Matyas
    www.soundimage.org
     */
    music = new Audio("https://soundimage.org/wp-content/uploads/2018/11/Valley-Sunrise_Looping.mp3");
    music.addEventListener('ended', () => {
      music.currentTime = 0;
      music.play();
    }, false);
    music.play();
    musicPlayer.textContent = '🔇';
  } else {
    if (music.paused) {
      music.play();
      musicPlayer.textContent = '🔇';
    } else {
      music.pause();
      musicPlayer.textContent = '🔊';
    }
  }
};
