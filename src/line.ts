// 识别五线谱的五横线

import cv, { Mat, Vec4 } from "@u4/opencv4nodejs";
import { binaryImage, getLinePoints, writeFile } from "./util";
import debug from "debug";

const log = debug("[line]");

type detectLineResult = {
  lines: Vec4[];
  gridHeight: number;
  firstLineIdx: number;
};

export const detectLine = function (input: Mat): detectLineResult {
  const image = binaryImage(input);

  // 应用HoughLinesP方法检测线段
  const minLineLength = image.cols * 0.7; // 长度至少为页宽的70%
  const maxLineGap = 0;
  let lines = image.houghLinesP(
    1,
    Math.PI / 180,
    100,
    minLineLength,
    maxLineGap
  );
  log("lines num:", lines.length);

  // 过滤出水平线段
  {
    lines = lines.filter((line) => {
      const { x1, x2, y1, y2 } = getLinePoints(line);
      const deltaY = Math.abs(y2 - y1);
      const deltaX = Math.abs(x2 - x1);
      const angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
      return angle >= 170 || angle <= 10; // 水平线段角度接近0或180度
    });
    log("horizontalLines num:", lines.length);
  }

  if (lines.length) {
    // 对距离接近的线做去重
    // 先按纵坐标排序
    lines = lines.sort((l1, l2) => {
      const { y1: l1y } = getLinePoints(l1);
      const { y1: l2y } = getLinePoints(l2);
      return l1y - l2y;
    });

    // 去重
    const minYThreshold = Math.max(Math.floor(image.rows / 200), 1); // 判断两条线是否重合的阈值
    let lastY = getLinePoints(lines[0]).y1;
    lines = lines.filter((line, idx) => {
      if (idx === 0) return true; // 首条不过滤

      const { y1 } = getLinePoints(line);
      if (y1 <= lastY + minYThreshold) {
        return false;
      } else {
        lastY = y1;
        return true;
      }
    });
    log("filter coincide line num:", lines.length);
  }

  if (lines.length < 10) {
    throw new Error("未检测到五线谱");
  }

  let firstLineIdx = 0; // 页面中五线谱的第一行的下标
  let gridHeight = 0; // 五线谱中每一格的高度
  {
    // 计算各行的间距, 找到连续4个间距相近的格子
    let lastDiff = getLinePoints(lines[1]).y1 - getLinePoints(lines[0]).y1;
    let count = 1;
    let sumDiff = lastDiff;
    for (let i = 2; i < lines.length; i++) {
      // 下两行的间距
      const delta = getLinePoints(lines[i]).y1 - getLinePoints(lines[i - 1]).y1;
      if (Math.abs(lastDiff - delta) / lastDiff <= 0.2) {
        // 误差不超过20% 则认为delta相同
        count++;
        sumDiff += delta;
      } else {
        lastDiff = delta;
        sumDiff = delta;
        count = 1;
      }

      if (count >= 4) {
        // 连续4个间距都基本相似, 则认为已找到五线谱的最后一行
        gridHeight = sumDiff / 4;
        firstLineIdx = i - 4;
        break;
      }
    }
  }

  if (!gridHeight) {
    throw new Error("gridHeight 识别失败");
  }

  log("gridHeight:", gridHeight, "firstLineIdx:", firstLineIdx);

  // debug
  // const copyImage = input.copy();
  // lines.forEach((line) => {
  //   const { x1, x2, y1, y2 } = getLinePoints(line);
  //   copyImage.drawLine(
  //     new cv.Point2(x1, y1),
  //     new cv.Point2(x2, y2),
  //     new cv.Vec3(0, 255, 0),
  //     2
  //   );
  // });
  // cv.imshow("Matched lines", copyImage);
  // cv.waitKey();

  return {
    lines,
    gridHeight,
    firstLineIdx,
  };
};
