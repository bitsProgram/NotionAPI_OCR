var settingProperties;

function SchoolPrintOCR() {
  let updateCount = 0;
  settingProperties = PropertiesService.getScriptProperties();

  let pages = getPages();
  pages.forEach((page) => {
    let blocks = getBlocks(page);
    let contents = getOcrText(blocks);
    let isUpdate = updateOcrProperty(page, contents);
    if (isUpdate) updateCount++;
  })

  console.log(`updated ${updateCount} page.`)
}

function getPages() {
  let endpoint = `/databases/${settingProperties.getProperty("notionDbId")}/query`;
  let payload = {
    filter: {
      or: [
        { property: settingProperties.getProperty("ocrProperty"), text: { "is_empty": true } },
      ]
    },
    page_size: 10,
  };
  let res = notionAPI(endpoint, "POST", payload);
  if (isError(res)) return [];

  let pages = res.results;
  return pages;
}

function updateOcrProperty(page, contents) {
  if (contents.length == 0) {
    contents.push("no-image");
  }

  let endpoint = `/pages/${page.id}`
  let properties = {};
  properties[settingProperties.getProperty("ocrProperty")] = { rich_text: [{ text: { content: contents.join("\n").substr(0, 2000) } }] };
  let payload = { properties: properties };

  let res = notionAPI(endpoint, "PATCH", payload);
  if (isError(res)) return false;

  return true;
}

function getOcrText(blocks) {
  if (blocks.length == 0) return [];

  let contents = [];
  blocks
    .filter((block) => block.image)
    .forEach((block) => {
      let text = getText(block.image[block.image.type].url);
      contents.push(text);
    });

  return contents;;
}

function getBlocks(page) {
  let endpoint = `/blocks/${page.id}/children`;
  let res = notionAPI(endpoint);
  if (isError(res)) return [];

  let blocks = res.results;
  return blocks;
}

function getPlainText(paragraph) {
  return paragraph && paragraph.text.length > 0 && paragraph.text[0].plain_text || "";
}

function getText(url) {
  let res = UrlFetchApp.fetch(url);
  let fileBlob = res.getBlob();
  fileBlob.setName("download-image");
  let srcFile = DriveApp.createFile(fileBlob);
  let options = { ocr: true, ocrLanguage: "ja" };
  let distFile = Drive.Files.copy({ title: "ocr-image" }, srcFile.getId(), options);
  let text = DocumentApp.openById(distFile.id).getBody().getText();

  Drive.Files.remove(srcFile.getId());
  Drive.Files.remove(distFile.id);

  return text;
}

function notionAPI(endpoint, method, payload) {
  let api = "https://api.notion.com/v1" + endpoint;
  let headers = {
    "Authorization": "Bearer " + settingProperties.getProperty("notionToken"),
    "Content-Type": method == undefined ? null : "application/json",
    "Notion-Version": "2021-08-16"
  };

  let res = UrlFetchApp.fetch(
    api,
    {
      headers: headers,
      method: method == undefined ? "GET" : method,
      payload: payload == undefined ? null : JSON.stringify(payload),
      "muteHttpExceptions": true,
    },
  );

  let json = JSON.parse(res.getContentText());
  return json;
}

function isError(res) {
  if (res.object != "error") return false;

  console.log(`PAGE: ${page.id}`)
  console.error(res);
  return true;
}