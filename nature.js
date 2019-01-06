const $ = document.querySelector.bind(document);
const menu = $("#menu");

/**
 * Dictionary of all possible tiles
 * @type {Object}
 */
const tiles = {
  grass: {
    name: "grass",
    imgSrc: "nature/grass.png",
    img: null,  // this will  be replaced when the image is loaded
    spread: 4,  // % of chance that this tile will spread into void
    clone: {
      water: 5  // % change of cloning grass tile over water
    }
  },
  water: {
    name: "water",
    imgSrc: "nature/water.png",
    img: null,
    spread: 5,
    clone: {
      grass: 10
    }
  }
};

let map = [];  // 2D array of tiles / null
let tick = -1;  // current tick number

/**
 * Start loading all tiles
 * @return {[type]} [description]
 */
function init() {
  for (let tileData of Object.values(tiles)) {
    tileData.img = new Image();
    tileData.img.src = tileData.imgSrc;
    tileData.img.onload = drawMap;
  }
  nextTick();  // init GUI
}

/**
 * Increment tick and evolve the map
 */
function nextTick() {
  tick++;
  menu.textContent = `Tick ${tick}`;
  if (tick === 0) return;  // this is just the init, do not evolve anything yet

  let newFields = []; // all previously null fields in format [x, y, tiles.type]

  for (let y = 0; y < map.length; y++)
    for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] === null) // this block is empty, it cannot be evolved
        continue;

      let changeMe = {};

      for (let neighbor of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        let nX = neighbor[0];
        let nY = neighbor[1];

        if (nX < 0 || nX >= map[0].length || nY < 0 || nY >= map.length || map[nY][nX] === null) {
          if (Math.random() * 100 <= map[y][x].spread)
            newFields.push([nX, nY, map[y][x]]);
        } else if (map[y][x].name in map[nY][nX].clone) {
          if (!(map[nY][nX].name in changeMe)) changeMe[map[nY][nX].name] = 0;
          changeMe[map[nY][nX].name] += map[nY][nX].clone[map[y][x].name];
        }
      }

      let stayTheSameWeight = 0;
      for (let changeWeight of Object.values(changeMe))
        stayTheSameWeight += 100 - changeWeight;

      let changeMeInto = randomWithWeight(changeMe, stayTheSameWeight);
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
      } else if(nY >= map.length)
        map.push(newRow.slice());

      if (nX === -1){
        for (let y = 0; y < map.length; y++)
          map[y].splice(0, 0, null);
        nX = 0;
        for (let ii = i + 1; ii < newFields.length; ii++)
          if (newFields[ii][0] === -1)
            newFields[ii][0] = 0;
      } else if (nX >= map[0].length)
        for (let y = 0; y < map.length; y++)
          map[y].push(null);

      map[nY][nX] = newFields[i][2];
    }
  }

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

function generateMap() {
  let size = [20, 20];
  let map = [];

  for (let y = 0; y < size[1]; y++) {
    let row = [];
    for (let x = 0; x < size[0]; x++) row.push(tiles.grass);
    map.push(row);
  }

  map[2][2] = tiles.water;
  map[2][1] = tiles.water;
  map[2][0] = tiles.water;

  return map;
}

window.onload = () => {
  map = generateMap();
  init();
  drawMap();

  //setInterval(nextTick, 100);
}
