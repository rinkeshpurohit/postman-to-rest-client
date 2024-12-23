const fs = require('fs');
const path = require('path');
const mimeTypes = require('./mime-types.json');

/** @typedef {object} Header
  * @property {string} key
  * @property {string} value
*/

/** @typedef {object} FormData
  * @property {string} key
  * @property {string} type
  * @property {string} src
  * @property {string} [value]
*/

/** @typedef {object} URLEndodedData
  * @property {string} key
  * @property {string} type
  * @property {string} value
*/

/** @typedef {object} RequestBody
  * @property {('raw' | 'formdata' | 'urlencoded')} mode
  * @property {string} [raw]
  * @property {FormData[]} [formdata]
  * @property {URLEndodedData[]} [urlencoded]
*/

/** @typedef {object} RequestQuery
  * @property {string} key
  * @property {string} value
*/

/** @typedef {object} RequestURL
  * @property {string} raw
  * @property {string[]} host
  * @property {string[]} path
  * @property {RequestQuery[]} [query]
*/

/** @typedef {object} Request
  * @property {('GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE')} method
  * @property {Header[]} header
  * @property {RequestBody} [body]
  * @property {RequestURL} url
*/

/** @typedef {object} Item
 * @property {string} name
 * @property {Request} [request]
 * @property {Item[]} [item]
*/

/** @typedef {Object} LeafNode
  * @property {string[]} folders
  * @property {(Item | Item[])} item
*/

const REQUESTS_DIR = "Requests";
const POSTMAN_DIR = "Postman";
const BASE_PATH = path.join(__dirname, REQUESTS_DIR);
const DELIMITER = "----WebKitFormBoundary7MA4YWxkTrZu0gW";

String.prototype.urlEscape = function () {
  return this.replace(/[^a-z0-9\s-]/gi, "_");
};

const ensureSettingsFileExistense = () => {
  if (!fs.existsSync(path.join(__dirname, ".vscode"))) {
    console.log("VS Code settings folder does not exist");
    fs.mkdirSync(path.join(__dirname, ".vscode"));
  }
  if(!fs.existsSync(path.join(__dirname, ".vscode/settings.json"))) {
    console.log("VS Code settings file does not exist");
    fs.writeFileSync(path.join(__dirname, ".vscode/settings.json"), JSON.stringify({}));
  } else {
    console.log("VS Code settings file exists");
  }
};

/**
 * @param {Header[]} headerArray
 * @returns {string}
 */
const generateHeaderString = (headerArray) => {
  return headerArray.reduce(
    (acc, header) => {
      if(header.key.length) {
        return `${acc.length > 0 ? acc + "\n" : ""}${header.key}: ${
          header.value
        }`;
      } else {
        return acc;
      }
    },
    ""
  );
};

const getFormBodydata = (formData) =>
  formData.map((data) => {
    let disposition = `Content-Disposition: form-data; name="${data.key}"`;
    if (data.type === "file") {
      let fileName = data.src.split("/").slice(-1)[0];
      disposition += `; filename="${fileName}"`;
      disposition += `\nContent-Type: ${
        mimeTypes["." + fileName.split(".").slice(-1)[0]]
      }\n\n< ${data.src}`;
    } else {
      disposition += `\n\n${data.value}`;
    }
    return `\n--${DELIMITER}\n${disposition}`;
  });

/**
 * @param {Item} item
 * @param {string} name
 * @param {Request} request
 * @returns {string}
 */
const generateRequest = ({name, request}) => {
  let requestString = `###\n// ${name.toUpperCase()}\n${request.method} ${request.url.raw} HTTP/1.1`;
  let header = "", body = "";
  if(request.header.length){
    header = generateHeaderString(request.header);
  }
  if (request.body) {
    try {
      let bodyData = '';
      if(header.length > 0){
        header += '\n';
      }
      switch (request.body.mode) {
        case "formdata":
          header += `Host: ${request.url.host.join(
            "."
          )}\nContent-Type: multipart/form-data;boundary=${DELIMITER}`;
          bodyData = getFormBodydata(request.body.formdata);
          body = bodyData.join("") + "\n--" + DELIMITER + "--";
          break;
        case "urlencoded":
          bodyData = request.body.urlencoded
            .map(
              (val) =>
                `${encodeURIComponent(val.key)}=${encodeURIComponent(
                  val.value
                )}`
            )
            .join("&");
          body = "\n" + bodyData;
          header += `Host: ${request.url.host.join(
            "."
          )}\nContent-Type: application/x-www-form-urlencoded\nContent-Length: ${
            bodyData.length
          }`;
          break;
        case "raw":
        default:
          body = request.body.raw ? `\n${request.body.raw}` : "";
          break;
      }
    } catch (error) {
      console.error(`Failed parsing ${name}. Empty request body\n`, error);
    }
  }
  requestString = [requestString, header, body].join('\n');
  requestString += '\n###\n';
  return requestString;
};

/**
 * 
 * @param {Item} item 
 * @param {string[]} folders 
 * @returns {LeafNode} out
 */
const getLeafNode = (item, folders = []) => {
  let leaf = {};
  if(item.item){
    folders.push(item.name);
    let out = getLeafNode(item.item, folders);
    Object.assign(leaf, out);
  } else {
    leaf = {
      folders,
      item
    }
  }
  return leaf;
};

/**
 * 
 * @param {string} p 
 * @param {Item} item 
 * @param {string} requests 
 */
const generateRequestFile = (p, item, requests) => {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
  filePath = path.join(p, item.name.urlEscape() + ".http");
  fs.writeFileSync(filePath, requests);
};

const main = () => {
  const collections = fs.readdirSync(
    path.join(__dirname, POSTMAN_DIR,  "collections"),
    { withFileTypes: true }
  );
  collections
    .filter((d) => d.isFile())
    .forEach((collectionDirent) => {
      const collection = JSON.parse(
        fs.readFileSync(
          collectionDirent.parentPath + "/" + collectionDirent.name,
          "utf8"
        )
      );
      const collectionPath = path.join(BASE_PATH, collection.info.name);
      if (!fs.existsSync(collectionPath)) {
        fs.mkdirSync(collectionPath);
      }
      collection.item?.forEach((item) => {
        let requests = "";
        let filePath;
        if (item.item) {
          for (const requestItem of item.item) {
            let { folders, item: leafItem } = getLeafNode(requestItem);
            if (leafItem.length) {
              for (const r of leafItem) {
                requests = generateRequest(r);
                const p = path.join(
                  BASE_PATH,
                  collection.info.name,
                  item.name,
                  ...folders
                );
                generateRequestFile(p, r, requests);
              }
            } else {
              const p = path.join(BASE_PATH, collection.info.name, item.name);
              requests = generateRequest(leafItem);
              generateRequestFile(p, leafItem, requests);
            }
          }
        } else {
          filePath = path.join(
            BASE_PATH,
            collection.info.name.urlEscape() +
              "/" +
              item.name.urlEscape() +
              ".http"
          );
          requests = generateRequest(item);
          fs.writeFileSync(filePath, requests);
        }
      });
    });
};

const generateGlobalVariables = () => {
  const collections = fs.readdirSync(
    path.join(__dirname, POSTMAN_DIR, "/environments"),
    { withFileTypes: true }
  );
  const envs = {};
  collections
    .filter((f) => f.isFile())
    .forEach((collectionDirent) => {
      const collection = JSON.parse(
        fs.readFileSync(
          collectionDirent.parentPath + "/" + collectionDirent.name,
          "utf8"
        )
      );
      try {
        envs[collection.name] = collection.values.reduce((acc, curr) => {
          acc[curr.key] = curr.value;
          return acc;
        }, {});
      } catch (error) {
        console.error(`Failed to parse: ${collection.name}\n`, error);
      }
    });
  ensureSettingsFileExistense();
  const vsCodeSettings = JSON.parse(fs.readFileSync(path.join(__dirname, '.vscode/settings.json'), 'utf8'));
  if (vsCodeSettings["rest-client.environmentVariables"]) {
    Object.assign(vsCodeSettings["rest-client.environmentVariables"], envs);
  } else {
    vsCodeSettings["rest-client.environmentVariables"] = envs;
  }
    fs.writeFileSync(
      path.join(__dirname, ".vscode/settings.json"),
      JSON.stringify(
        vsCodeSettings,
        null,
        4
      )
    );
}

if (!fs.existsSync(path.join(__dirname, REQUESTS_DIR))) {
  fs.mkdirSync(path.join(__dirname, REQUESTS_DIR));
}
console.log(`
    ================================================  
    Requests HTTP file generation START
    ================================================
  `);
main();
console.log(`
    ================================================  
    Requests HTTP file generation END
    ================================================
  `);

console.log(`
    ================================================  
    Env Variables generation START
    ================================================
  `);
// generateGlobalVariables();
console.log(`
    ================================================  
    Env Variables generation END
    ================================================
  `);