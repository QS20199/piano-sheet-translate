import cv, { Mat, Rect, imread } from "@u4/opencv4nodejs";
import net from "net";
import fs from "fs";
import path from "path";
import { binaryImage, getSocketPath } from "../util";
import debug from "debug";

const socketIdx = process.argv[2];
const socketPath = getSocketPath(`note-model-calc-match_${socketIdx}`);
const log = debug("note-model-calc-match");

if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);

const server = net.createServer((socket) => {
  let inputData = "";
  socket.on("data", (data) => {
    inputData += data;
    if (inputData.endsWith("\n\n")) {
      const inputJson = JSON.parse(inputData);
      run(inputJson)
        .then((rst) => {
          socket.write(JSON.stringify(rst) + "\n\n");
        })
        .catch((e) => {
          socket.write(JSON.stringify(e));
        });
    }
  });
});

server.listen(socketPath, () => {
  log(`worker listen on ${socketPath}`);
});

server.on("error", (err) => {
  console.error("worker error:", err);
});

async function run(input: {
  originalImagePath: string;
  modelName: string;
  scaleFactor: number;
  threshold: number;
}) {
  const { originalImagePath, modelName, scaleFactor, threshold } = input;
  let matched: number[][] = [];
  const imageBin = binaryImage(cv.imread(originalImagePath));
  let noteModel = binaryImage(
    cv.imread(path.resolve(__dirname, "../../model/note", modelName))
  );
  noteModel = noteModel.resize(
    Math.round(noteModel.rows * scaleFactor),
    Math.round(noteModel.cols * scaleFactor)
  );

  // 模板匹配
  const data = await imageBin.matchTemplateAsync(noteModel, cv.TM_CCORR_NORMED);

  for (let row = 0; row < data.rows; row++) {
    for (let col = 0; col < data.cols; col++) {
      const value = data.at(row, col);
      if (value > threshold) {
        // 检查当前遍历到的匹配结果矩阵中的元素（value）是否为其邻域内的最大值
        const region = data.getRegion(new cv.Rect(col - 5, row - 5, 11, 11));
        const regionArray = region.getDataAsArray();
        const isLocalMax = Math.max(...regionArray.flat()) === value;

        if (isLocalMax) {
          matched.push([col, row, noteModel.cols, noteModel.rows]);
        }
      }
    }
  }
  return matched;
}
