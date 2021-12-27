# katago-analyze-sgf

Add analysis to SGF files using [KataGo](https://github.com/lightvector/KataGo).

## Usage

1. Start the daemon

```
katago-analyze-sgf-daemon.js ANALYSIS_CONFIG [OPTIONS]

Process SGF files using the KataGo analysis engine - daemon.

Positionals:
  ANALYSIS_CONFIG  Path to the analysis configuration file.             [string]

Options:
  --help             Show help                                         [boolean]
  --version          Show version number                               [boolean]
  --katago-path      Path to the KataGo executable. [string] [default: "katago"]
  --source-dir       Directory containing the original SGF files.       [string]
  --destination-dir  Directory to save the generated SGF files.         [string]
```

2. Submit jobs using the command line interface

```
katago-analyze-sgf-cli.js COMMAND [PARAMS]

Process SGF files using the KataGo analysis engine - client.

Positionals:
  COMMAND  The command. Options: "submit", "list-jobs"                  [string]
  PARAMS   Parameters to the command.                                   [string]

Options:
  --help     Show help                                                 [boolean]
  --version  Show version number                                       [boolean]
```

The parameters to a command should be a JSON dictionary. The following commands
are supported:

-   `submit` Submit an SGF file for processing. Parameters:
    -   `filename`: The name of the SGF file to process
    -   `maxVariations`: The maximum number of variations to add to each move
        (default: 10)
    -   `maxVisits`: The maximum number of root visits per search
        (default: 1000)
-   `terminate` Stop processing a file. Parameters:
    -   `filename`: The name of the SGF file to stop processing
-   `clear-cache` Clear the neural network cache
-   `list-jobs` List files currently being processed.

For each SGF file processed, a new SGF file will be created with filename
constructed by appending the string "-analyzed" to the original filename. This
SGF file will have additional non-standard properties added to the original SGF
nodes, as well as additional variations provided by KataGo. Currently, the
following properties are added:

-   `VISITS`: number of visits invested in the move
-   `WINRATE`: probability of black winning as a floating point number between 0
    and 1
-   `SCORELEAD`: number of points black is winning by
-   `SCORESTDEV`: standard deviation of the score lead

## Example

1. Start the daemon

```
./katago-analyze-sgf-daemon.js katago_analysis.cfg --katago-path /usr/bin/katago --source-dir /sgf_files/ --destination-dir /sgf_files_analyzed/
```

2. Submit a job

```
./katago-analyze-sgf-cli.js submit '{"filename": "game.sgf", "maxVariations": 8, "maxVisits": 5000}'
```
