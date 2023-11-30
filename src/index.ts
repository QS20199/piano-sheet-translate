import "source-map-support/register";
import cv, { Mat, Rect } from "@u4/opencv4nodejs";
import path from "path";
import {
  calcTune,
  coverPngToImage,
  getLinePoints,
  getNoteNameModel,
  getScaleFactor,
  mapNoteWithTone,
  writeFile,
} from "./util";
import { detectLine } from "./line";
import { detectNoteModel } from "./note-model";
import fs from "fs";
import { config } from "./config";

const staffConfig: { riseOrReduce: "rise" | "reduce"; markCount: number } = {
  riseOrReduce: config.markRiseOrReduce as any,
  markCount: config.markCount,
};

(async () => {
  const fileList = fs
    .readdirSync(path.resolve(__dirname, "../input"))
    .filter((v) => /\.(jpg|jpeg|png|bmp)$/.test(v));

  for (const fileName of fileList) {
    if (config.files?.length && !config.files.includes(fileName)) {
      console.log(`${fileName} not in files field, skip`);
      continue;
    }

    try {
      const startTime = Date.now();
      console.log(`handling file: ${fileName}`);
      const originalImagePath = path.resolve(__dirname, "../input", fileName);
      const originalImage = cv.imread(originalImagePath);
      const scaleFactor = getScaleFactor(originalImage); // 入参图片和模版的缩放系数
      console.log(`detect scaleFactor: ${scaleFactor}`);
      const { lines, firstLineIdx, gridHeight } = detectLine(originalImage);

      const noteModels = await detectNoteModel(originalImagePath, scaleFactor);

      // 筛选每组五线谱的最顶上那条线的Y坐标
      const staffStartYList: number[] = [];
      lines.slice(firstLineIdx).forEach((line, idx) => {
        if (idx % 5 === 0) {
          staffStartYList.push(getLinePoints(line).y1);
        }
      });

      // 判断某个音符的纵坐标是否属于某个五线谱的顶部y坐标
      const inStaffRange = (y: number, staffStartY: number) => {
        const range0 = staffStartY - 5 * gridHeight;
        const range1 = staffStartY + 7 * gridHeight;
        return y >= range0 && y <= range1;
      };

      const flag4Draw = new Mat(
        originalImage.rows,
        originalImage.cols,
        cv.CV_8U,
        0
      );
      let result = originalImage.copy();
      noteModels.forEach((note) => {
        const centerPointY = note.height / 2 + note.y;
        const staffStartY = staffStartYList.find((v) =>
          inStaffRange(centerPointY, v)
        );
        if (!staffStartY) return;

        let offset = Math.round(
          ((staffStartY - centerPointY) / gridHeight) * 2
        ); // 和第一行相差几度的音
        while (offset < 0) {
          offset += 7;
        }
        while (offset >= 7) {
          offset -= 7;
        }

        const lowStaffNote = ["A", "B", "C", "D", "E", "F", "G"];
        const highStaffNote = ["F", "G", "A", "B", "C", "D", "E"];
        // 简单判断 偶数的谱为高音谱表
        const isHighStaff = staffStartYList.indexOf(staffStartY) % 2 === 0;

        const noteName = isHighStaff
          ? highStaffNote[offset]
          : lowStaffNote[offset];
        const tune = calcTune(staffConfig.riseOrReduce, staffConfig.markCount);
        const noteImage = getNoteNameModel(
          mapNoteWithTone(noteName, tune, staffConfig.riseOrReduce),
          isHighStaff ? "high" : "low",
          scaleFactor * config.fontScale
        );

        let x = 0,
          y = 0;
        let tryCount = 0,
          maxTryCount = 10,
          stepUnit = Math.round(10 * scaleFactor);
        while (true) {
          // init && reset
          if (tryCount % maxTryCount === 0) {
            x = note.x - noteImage.cols;
            y = note.y;
          }

          // 检测是否有区域已经被绘画过, 如果有则尝试对x或y坐标进行偏移再尝试检测
          if (
            flag4Draw
              .getRegion(new Rect(x, y, note.width, note.height))
              .getDataAsArray()
              .flat()
              .every((v) => v === 0)
          ) {
            break;
          }

          if (tryCount <= maxTryCount) {
            y += stepUnit;
          } else if (tryCount <= 2 * maxTryCount) {
            y -= stepUnit;
          } else if (tryCount <= 3 * maxTryCount) {
            x -= stepUnit;
          } else {
            break;
          }
          tryCount++;
        }

        result = coverPngToImage(result, noteImage, x, y, {
          opacity: config.fontOpacity,
        });
        flag4Draw.getRegion(new Rect(x, y, note.width, note.height)).setTo(1);
      });

      writeFile(result, fileName);
      // cv.imshow("result", result);
      // cv.waitKey();
      console.log(
        `file finish: ${fileName}, cost: ${Date.now() - startTime}ms`
      );
    } catch (e) {
      console.error(`error on file: ${fileName}, error:`, e);
    }
  }

  console.log("done");
})();
