const fsPromises = require('fs/promises')
const path = require('path')
const sgf = require('@sabaki/sgf')
const Engine = require('./Engine')

let ID = 0

function getId() {
  return ID++
}

const KATAGO_FIELD_TO_SGF_PROP = {
  scoreLead: 'SCORELEAD',
  scoreStdev: 'SCORESTDEV',
  visits: 'VISITS',
  winrate: 'WINRATE',
}

const SGF_TO_GTP_COL = {
  a: 'A',
  b: 'B',
  c: 'C',
  d: 'D',
  e: 'E',
  f: 'F',
  g: 'G',
  h: 'H',
  i: 'J',
  j: 'K',
  k: 'L',
  l: 'M',
  m: 'N',
  n: 'O',
  o: 'P',
  p: 'Q',
  q: 'R',
  r: 'S',
  s: 'T',
}

const GTP_TO_SGF_COL = {
  A: 'a',
  B: 'b',
  C: 'c',
  D: 'd',
  E: 'e',
  F: 'f',
  G: 'g',
  H: 'h',
  J: 'i',
  K: 'j',
  L: 'k',
  M: 'l',
  N: 'm',
  O: 'n',
  P: 'o',
  Q: 'p',
  R: 'q',
  S: 'r',
  T: 's',
}

const SGF_TO_GTP_ROW = {
  a: '1',
  b: '2',
  c: '3',
  d: '4',
  e: '5',
  f: '6',
  g: '7',
  h: '8',
  i: '9',
  j: '10',
  k: '11',
  l: '12',
  m: '13',
  n: '14',
  o: '15',
  p: '16',
  q: '17',
  r: '18',
  s: '19',
}

const GTP_TO_SGF_ROW = {
  1: 'a',
  2: 'b',
  3: 'c',
  4: 'd',
  5: 'e',
  6: 'f',
  7: 'g',
  8: 'h',
  9: 'i',
  10: 'j',
  11: 'k',
  12: 'l',
  13: 'm',
  14: 'n',
  15: 'o',
  16: 'p',
  17: 'q',
  18: 'r',
  19: 's',
}

function sgfToGtpMove(move) {
  if (move === '' || move === 'tt') {
    return 'pass'
  }
  const [col, row] = move
  return SGF_TO_GTP_COL[col] + SGF_TO_GTP_ROW[row]
}

function gtpToSgfMove(move) {
  const col = move[0]
  const row = move.slice(1)
  return GTP_TO_SGF_COL[col] + GTP_TO_SGF_ROW[row]
}

function listMoveNodes(rootNode) {
  const moveNodes = [rootNode]
  let curr = rootNode
  while (curr.children.length) {
    curr = curr.children[0]
    if (curr.data.B || curr.data.W) {
      moveNodes.push(curr)
    }
  }
  return moveNodes
}

function constructQuery(id, rootNode) {
  const moveNodes = listMoveNodes(rootNode)
  const initialStones = []
  const moves = []
  const analyzeTurns = []
  let rules = 'tromp-taylor'
  let [boardXSize, boardYSize] = rootNode.data.SZ[0].split(':')
  boardYSize = boardYSize || boardXSize

  if (rootNode.data.RU && rootNode.data.RU.length) {
    switch (rootNode.data.RU[0].toLowerCase()) {
      case 'chinese':
        rules = 'chinese-ogs'
        break
      case 'japanese':
        rules = 'japanese'
        break
      case 'korean':
        rules = 'korean'
        break
      case 'aga':
        rules = 'aga'
        break
    }
  }

  if (rootNode.data.AB) {
    rootNode.data.AB.forEach((move) => {
      initialStones.push(['B', sgfToGtpMove(move)])
    })
  }
  if (rootNode.data.AW) {
    rootNode.data.AW.forEach((move) => {
      initialStones.push(['W', sgfToGtpMove(move)])
    })
  }

  moveNodes.forEach((node) => {
    if (node.data.B) {
      moves.push(['B', sgfToGtpMove(node.data.B[0])])
    } else if (node.data.W) {
      moves.push(['W', sgfToGtpMove(node.data.W[0])])
    }
  })

  for (let i = 0; i <= moves.length; i += 1) {
    analyzeTurns.push(i)
  }

  return {
    id: id,
    moves: moves,
    initialStones: initialStones,
    rules: rules,
    komi: Number(rootNode.data.KM[0]),
    boardXSize: Number(boardXSize),
    boardYSize: Number(boardYSize),
    analyzeTurns,
  }
}

function createVariationNode(moveInfo, currentPlayer, parentId) {
  const {move, pv, scoreLead, scoreStdev, visits, winrate} = moveInfo
  if (!pv.length) {
    pv.push(move)
  }
  const id = getId()
  const data = {
    [currentPlayer]: [gtpToSgfMove(pv[0])],
    [KATAGO_FIELD_TO_SGF_PROP.scoreLead]: [scoreLead],
    [KATAGO_FIELD_TO_SGF_PROP.scoreStdev]: [scoreStdev],
    [KATAGO_FIELD_TO_SGF_PROP.visits]: [visits],
    [KATAGO_FIELD_TO_SGF_PROP.winrate]: [winrate],
  }
  const rootNode = {
    id,
    data,
    parentId,
    children: [],
  }
  let parent = rootNode
  parentId = id
  currentPlayer = currentPlayer === 'B' ? 'W' : 'B'
  for (const move of pv.slice(1)) {
    const id = getId()
    const data = {[currentPlayer]: [gtpToSgfMove(move)]}
    const node = {
      id,
      data,
      parentId,
      children: [],
    }
    if (parent) {
      parent.children.push(node)
    }
    parent = node
    parentId = id
    currentPlayer = currentPlayer === 'B' ? 'W' : 'B'
  }
  return rootNode
}

function addResponsesToTree(rootNode, responses, maxVariations) {
  const moveNodes = listMoveNodes(rootNode)
  for (const response of responses) {
    let {moveInfos, rootInfo, turnNumber} = response
    const node = moveNodes[turnNumber]
    const {currentPlayer, scoreLead, scoreStdev, winrate} = rootInfo

    if (!node.data[KATAGO_FIELD_TO_SGF_PROP.visits]) {
      node.data[KATAGO_FIELD_TO_SGF_PROP.scoreLead] = [scoreLead]
      node.data[KATAGO_FIELD_TO_SGF_PROP.scoreStdev] = [scoreStdev]
      // root visits don't accurately represent move value
      node.data[KATAGO_FIELD_TO_SGF_PROP.visits] = [0]
      node.data[KATAGO_FIELD_TO_SGF_PROP.winrate] = [winrate]
    }

    const gameMoveNode = node.children && node.children[0]
    let gameMove =
      gameMoveNode &&
      ((gameMoveNode.data.B && gameMoveNode.data.B[0]) ||
        (gameMoveNode.data.W && gameMoveNode.data.W[0]))
    gameMove = gameMove && sgfToGtpMove(gameMove)
    moveInfos = moveInfos
      .filter(
        (moveInfo) => moveInfo.move === gameMove || !moveInfo.isSymmetryOf
      )
      .sort((a, b) => a.order - b.order)
      .slice(0, maxVariations)
    for (const moveInfo of moveInfos) {
      if (gameMoveNode && moveInfo.move === gameMove) {
        const {scoreLead, scoreStdev, visits, winrate} = moveInfo
        gameMoveNode.data[KATAGO_FIELD_TO_SGF_PROP.scoreLead] = [scoreLead]
        gameMoveNode.data[KATAGO_FIELD_TO_SGF_PROP.scoreStdev] = [scoreStdev]
        gameMoveNode.data[KATAGO_FIELD_TO_SGF_PROP.visits] = [visits]
        gameMoveNode.data[KATAGO_FIELD_TO_SGF_PROP.winrate] = [winrate]
      } else {
        node.children.push(
          createVariationNode(moveInfo, currentPlayer, node.id)
        )
      }
    }
  }
}

function main() {
  const argv = require('yargs').command(
    '$0 <FILE..>',
    'Process SGF files using the KataGo analysis engine.',
    (yargs) => {
      yargs.positional('FILE', {
        describe: 'The SGF files to process.',
        type: 'string',
      })
      yargs.option('analysis-config', {
        describe: 'Path to the analysis configuration file.',
        type: 'string',
      })
      yargs.option('katago-path', {
        describe: 'Path to the KataGo executable.',
        type: 'string',
        default: 'katago',
      })
      yargs.option('max-variations', {
        describe: 'Maximum number of variations to add to each move.',
        type: 'number',
        default: Infinity,
      })
    }
  ).argv

  const {FILE, katagoPath, analysisConfig, maxVariations} = argv

  const rootNodeLists = {}
  for (const file of FILE) {
    rootNodeLists[file] = sgf.parseFile(file, {getId})
  }

  const engine = new Engine(katagoPath, analysisConfig)

  engine.on('ready', async () => {
    const promises = []
    for (const [file, rootNodes] of Object.entries(rootNodeLists)) {
      const filePromises = []
      for (const [i, rootNode] of rootNodes.entries()) {
        const query = constructQuery(`${file}-${i}`, rootNode)
        const responsePromises = engine.sendQuery(query)
        const promise = Promise.all(responsePromises).then((responses) => {
          addResponsesToTree(rootNode, responses, maxVariations)
        })
        filePromises.push(promise)
      }
      const promise = Promise.all(filePromises).then(() => {
        const {dir, name, ext} = path.parse(file)
        const outputFile = path.join(dir, `${name}-analyzed${ext}`)
        return fsPromises.writeFile(outputFile, sgf.stringify(rootNodes))
      })
      promises.push(promise)
    }
    await Promise.all(promises)
    engine.stop()
  })

  engine.start()
}

if (module === require.main) {
  main()
}
