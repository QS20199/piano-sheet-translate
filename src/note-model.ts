// 识别音符

import cv, { Contour, Mat, Point, Point2, Rect, Vec4 } from "@u4/opencv4nodejs";
import {
  binaryImage,
  coverPngToImage,
  drawContours,
  generateStep,
  getLinePoints,
  getNoteNameModel,
  writeFile,
} from "./util";
import debug from "debug";
import path from "path";
import fs from "fs";
import { config } from "./config";
import { workerRun } from "./worker/worker-pool";

const log = debug("[note-model]");
const threshold = config.noteMatchThreshold;
const noteModelList = fs
  .readdirSync(path.resolve(__dirname, "../model/note"))
  .filter((v) => /\.(png|jpg|jpeg|bmp)$/i.test(v));

export const detectNoteModel = async (
  originalImagePath: string,
  scaleFactor: number
) => {
  const image = cv.imread(originalImagePath);

  let matched: Rect[] = [];
  await Promise.all(
    noteModelList.map(async function __subDetectNoteModel(modelName, idx) {
      const calcResult = await workerRun({
        originalImagePath: originalImagePath,
        modelName: modelName,
        scaleFactor: scaleFactor,
        threshold: threshold,
      });

      matched.push(
        ...(calcResult as number[][]).map((v) => {
          const [x, y, w, h] = v;
          return new Rect(x, y, w, h);
        })
      );
    })
  );

  // 位置相近的点做去重
  const flag4Center = new Mat(image.rows, image.cols, cv.CV_8U, 0);
  const halfSideLength = Math.round((25 * scaleFactor) / 2); // 取边长大约为(25*系数)的矩形做去重检测
  matched = matched.filter((note) => {
    const centerPointX = note.width / 2 + note.x;
    const centerPointY = note.height / 2 + note.y;
    if (
      flag4Center
        .getRegion(
          new Rect(
            centerPointX - halfSideLength,
            centerPointY - halfSideLength,
            halfSideLength * 2 + 1,
            halfSideLength * 2 + 1
          )
        )
        .getDataAsArray()
        .flat()
        .some((v) => v > 0)
    ) {
      log(`note point (${centerPointX}, ${centerPointY}) skip`);
      return false;
    }
    flag4Center.getRegion(new Rect(centerPointX, centerPointY, 1, 1)).setTo(1);
    return true;
  });

  // 排序, 从左到右, 从上到下
  matched = matched.sort((v1, v2) => {
    if (Math.abs(v1.x - v2.x) < halfSideLength) { // x坐标的差值如果小于这个范围, 则认为x近似相等, 则比较y值
      return v1.y - v2.y;
    } else {
      return v1.x - v2.x;
    }
  });

  // debug
  // let result = image.copy();
  // matched.forEach((rect) => {
  //   const topLeft = new cv.Point2(rect.x, rect.y);
  //   const bottomRight = new cv.Point2(
  //     rect.x + rect.width,
  //     rect.y + rect.height
  //   );
  //   result.drawRectangle(topLeft, bottomRight, new cv.Vec3(0, 255, 0), 2);
  // });
  // cv.imshow("Matched Shapes", result);
  // cv.waitKey();

  return matched;
};
