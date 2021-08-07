# katago-analyze-sgf

Add analysis to SGF files using KataGo.

## Usage

```
node main.js <FILE..>

Process SGF files using the KataGo analysis engine.

Positionals:
  FILE  The SGF files to process.                                       [string]

Options:
  --help             Show help                                         [boolean]
  --version          Show version number                               [boolean]
  --analysis-config  Path to the analysis configuration file.           [string]
  --katago-path      Path to the KataGo executable. [string] [default: "katago"]
  --max-variations   Maximum number of variations to add to each move.
                                                    [number] [default: Infinity]
```

For each SGF file passed in, a new SGF file will be created with filename
constructed by appending the string "-analyzed" to the original filename. This
SGF file will have additional non-standard properties added to the original SGF
nodes, as well as additional variations provided by KataGo. Currently, the
following properties are added:

- VISITS: number of visits invested in the move
- WINRATE: probability of black winning as a floating point number between 0 and
  1
- SCORELEAD: number of points black is winning by
- SCORESTDEV: standard deviation of the score lead
