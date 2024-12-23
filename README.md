# postman-to-rest-client

Migration script for Postman to VSCode REST client

## Pre-requisites

1. Node version 18+.
2. Directories required at root:
  1. `Postman/collections`
  2. `Postman/environments`

## Getting Started

1. Export your collections from Postman and put the JSON files in `Postman/collections` directory.
2. If you need environments then export `environments` from Postman and put the JSON files in `Postman/environments` directory.
3. Environments in REST client are handled from `settings.json` in `.vscode` directory. This file will be auto generated and if it exists then variables will be added to it.
4. By default the script generates collections and env variables both. You can disable either one by commenting the functions at the end of `porter.js` file.
5. Command to run the script : `node porter.js`.
