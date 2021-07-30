const {spawn} = require('child_process')
const sgf = require('@sabaki/sgf')
const Engine = require('./Engine')

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

function sgfToGtpMove(move) {
  if (move === '' || move === 'tt') {
    return 'pass'
  }
  const [col, row] = move
  return SGF_TO_GTP_COL[col] + SGF_TO_GTP_ROW[row]
}

function listMainNodes(rootNode) {
  const mainNodes = [rootNode]
  let curr = rootNode
  while (curr.children.length) {
    curr = curr.children[0]
    mainNodes.push(curr)
  }
  return mainNodes
}

function constructQuery(id, rootNode) {
  const mainNodes = listMainNodes(rootNode)
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
      case 'aga':
        rules = 'aga'
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

  mainNodes.forEach((node) => {
    if (node.data.B) {
      moves.push(['B', sgfToGtpMove(node.data.B[0])])
    }
    if (node.data.W) {
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

function main() {
  const argv = require('yargs').command(
    '$0 INPUT_FILE',
    'Process SGF files using the KataGo analysis engine.',
    (yargs) => {
      yargs.positional('INPUT_FILE', {
        describe: 'The SGF file to process.',
        type: 'string',
      })
      yargs.option('file', {
        describe: 'A file containing the names of the SGF files to process.',
        type: 'string',
      })
      yargs.option('katago-path', {
        describe: 'Path to the KataGo executable.',
        type: 'string',
      })
      yargs.option('analysis-config', {
        describe: 'Path to the analysis configuration file.',
        type: 'string',
      })
    }
  ).argv

  const {INPUT_FILE, katagoPath, analysisConfig} = argv

  const rootNodes = sgf.parseFile(INPUT_FILE)

  const engine = new Engine(katagoPath, analysisConfig)

  engine.on('ready', () => {
    const promiseLists = []
    const promises = []
    for (let i = 0; i < rootNodes.length; i += 1) {
      const query = constructQuery(String(i), rootNodes[i])
      promiseLists.push(engine.sendQuery(query))
    }
    promiseLists.forEach((promiseList) => {
      promises.push(
        Promise.all(promiseList).then((responses) => {
          console.log(responses)
        })
      )
    })
    return Promise.all(promises)
  })
}

if (module === require.main) {
  main()
}
