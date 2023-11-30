import cv, { Contour, Mat, Vec3, Vec4 } from "@u4/opencv4nodejs";
import path from "path";
import fs from "fs";
import { config } from "./config";
import os from "os";
import net from "net";

const platform = os.platform();

export function binaryImage(image: Mat) {
  const lowerColor = new cv.Vec3(0, 0, 0);
  const upperColor = new cv.Vec3(180, 255, 230);
  return image.cvtColor(cv.COLOR_BGR2HSV).inRange(lowerColor, upperColor);
}

export function getLinePoints(line: Vec4) {
  // 这里貌似因为坐标系的问题, 需要将x/y颠倒取值
  return {
    x1: line.w,
    y1: line.x,
    x2: line.y,
    y2: line.z,
  };
}

export function writeFile(data: Mat, fileName: string) {
  fs.mkdirSync(path.resolve(__dirname, `../output/`), {
    recursive: true,
  });
  cv.imwrite(path.resolve(__dirname, `../output/`, fileName), data);
}

export function drawContours(image: Mat, contours: Contour[]) {
  const resultImage = image.copy();
  contours.forEach((item) => {
    resultImage.drawContours([item.getPoints()], -1, new cv.Vec3(0, 255, 0), 1);
  });

  return resultImage;
}

export function generateStep(range: [number, number], splitNum: number) {
  const [range0, range1] = range;
  const diff = range1 - range0;
  const step = diff / splitNum;
  return new Array(splitNum + 1).fill("").map((_, idx) => range0 + idx * step);
}

// 给Vec3的图片叠加Vec4的png图片
export function coverPngToImage(
  bgImg: Mat,
  overlayImg: Mat,
  x: number,
  y: number,
  options?: {
    opacity?: number; // 不透明度
  }
) {
  if (bgImg.channels !== 3) throw new Error("bgImg.channels !== 3");
  if (overlayImg.channels !== 4) throw new Error("overlayImg.channels !== 4");
  if (x + overlayImg.cols > bgImg.cols) throw new Error(`叠加区域超出原图范围`);
  if (y + overlayImg.rows > bgImg.rows) throw new Error(`叠加区域超出原图范围`);

  const result = bgImg.copy();
  const alphaChannel = overlayImg.split()[3];
  const pngCvtVec3 = overlayImg.cvtColor(cv.COLOR_BGRA2BGR); // png转换为3通道的颜色

  // 将4通道PNG图片与3通道背景图片叠加
  const roi = result.getRegion(
    new cv.Rect(x, y, overlayImg.cols, overlayImg.rows)
  );

  for (let x = 0; x < overlayImg.cols; x++) {
    for (let y = 0; y < overlayImg.rows; y++) {
      if (alphaChannel.at(y, x) > 0) {
        let scaleFactor = alphaChannel.at(y, x) / 255;
        if (options?.opacity) {
          scaleFactor *= options.opacity;
        }
        const overlayPixel = (pngCvtVec3.at(y, x) as unknown as Vec3).mul(
          scaleFactor
        ) as Vec3;
        const backgroundPixel = (roi.at(y, x) as unknown as Vec3).mul(
          1 - scaleFactor
        ) as Vec3;
        const newPixel = overlayPixel.add(backgroundPixel) as Vec3;
        roi.set(y, x, newPixel);
      }
    }
  }

  return result;
}

const noteNameModels = {
  low: {} as Record<string, Mat>,
  high: {} as Record<string, Mat>,
};
// prettier-ignore
const noteNameList = ["A", "B", "C", "D", "E", "F", "G",
  "#A", "#C", "#D", "#F", "#G",
  "bB", "bD", "bE", "bG", "bA"];
noteNameList.forEach((v) => {
  noteNameModels.low[v] = cv.imread(
    path.resolve(__dirname, `../model/note-name/low/${v}.png`),
    cv.IMREAD_UNCHANGED
  );
  noteNameModels.high[v] = cv.imread(
    path.resolve(__dirname, `../model/note-name/high/${v}.png`),
    cv.IMREAD_UNCHANGED
  );
});

const noteNameModelsScaleCache: Record<number, typeof noteNameModels> = {
  1: noteNameModels,
};

export function getNoteNameModel(
  name: string,
  lowOrHigh: "low" | "high",
  scale: number
) {
  const cache = noteNameModelsScaleCache;
  if (!cache[scale]?.[lowOrHigh]?.[name]) {
    cache[scale] = cache[scale] || { low: {}, high: {} };
    const { rows, cols } = cache[1][lowOrHigh][name];
    cache[scale][lowOrHigh][name] = cache[1][lowOrHigh][name].resize(
      Math.round(rows * scale),
      Math.round(cols * scale)
    );
  }

  return cache[scale][lowOrHigh][name];
}

// 根据调号来决定某一个音是否要升半音
// 如D调的C在大调音阶中应为#C
export function mapNoteWithTone(
  noteName: string,
  tone: string,
  riseOrReduce: "rise" | "reduce"
) {
  const stdNoteList =
    riseOrReduce === "rise"
      ? ["C", "#C", "D", "#D", "E", "F", "#F", "G", "#G", "A", "#A", "B"]
      : ["C", "bD", "D", "bE", "E", "F", "bG", "G", "bA", "A", "bB", "B"];
  const offsetMap: Record<string, number> = {};
  stdNoteList.forEach((note, index) => {
    offsetMap[note] = index; // 每个音和C音的offset值(如#C到C的offset是1)
  });

  // 根据偏移量生成新的音符列表, 如G调则生成 [G, #G, ..., B, C]
  const offset = offsetMap[tone];
  const offsetNoteList = [
    ...stdNoteList.slice(offset, stdNoteList.length),
    ...stdNoteList.slice(0, offset),
  ];

  const majorScaleOffset = [2, 2, 1, 2, 2, 2, 1]; // 大调音阶中, 每个调上音相差的半音数量
  // 根据大调全半音规则, 计算出当前大调中的音是哪些音
  const currentToneNoteList: string[] = [];
  for (let offset = 0, idx = 0; idx < majorScaleOffset.length; idx++) {
    currentToneNoteList.push(offsetNoteList[offset]);
    offset += majorScaleOffset[idx];
  }

  // 与入参对比, 返回对应的值
  return currentToneNoteList.find((v) => v.includes(noteName))!;
}

export function getScaleFactor(image: Mat) {
  const imageBin = binaryImage(image);

  const scales = generateStep(
    [config.sheetScale * 0.8, config.sheetScale * 1.2],
    20
  );
  const matchMethod = cv.TM_CCORR_NORMED;

  // 用不同的缩放系数缩放模版, 查到到最接近的模版缩放比例
  const staffModel = binaryImage(
    cv.imread(path.resolve(__dirname, "../model/staff.png"))
  );
  let bestMatch: any = { maxVal: -Infinity, maxLoc: null, scaleFactor: null };
  scales.forEach((scaleFactor) => {
    const resizedStaffModel = staffModel.resize(
      Math.round(staffModel.rows * scaleFactor),
      Math.round(staffModel.cols * scaleFactor)
    );

    const result = imageBin.matchTemplate(resizedStaffModel, matchMethod);

    const minMax = result.minMaxLoc();
    const { maxVal, maxLoc } = minMax;

    if (maxVal > bestMatch.maxVal) {
      bestMatch = { maxVal, maxLoc, scaleFactor };
    }
  });

  return bestMatch.scaleFactor;
}

/** 根据升降调的数量计算出当前是什么调 */
export function calcTune(
  riseOrReduce: "rise" | "reduce", // 是升还是降的记号
  markCount: number // 升降记号的数量
) {
  const stdNoteList =
    riseOrReduce === "rise"
      ? ["C", "#C", "D", "#D", "E", "F", "#F", "G", "#G", "A", "#A", "B"]
      : ["C", "bD", "D", "bE", "E", "F", "bG", "G", "bA", "A", "bB", "B"];

  let baseIdx = 0; // C
  if (riseOrReduce === "reduce") {
    if (markCount % 2 !== 0) {
      baseIdx = 5; // F
      markCount--;
    }
    let toneIdx = baseIdx - markCount;
    if (toneIdx < 0) {
      toneIdx += 12;
    }
    return stdNoteList[toneIdx];
  } else {
    if (markCount % 2 !== 0) {
      baseIdx = 7; // G
      markCount--;
    }
    let toneIdx = baseIdx + markCount;
    if (toneIdx >= 12) {
      toneIdx -= 12;
    }
    return stdNoteList[toneIdx];
  }
}

export function getSocketPath(name: string) {
  if (platform === "win32") {
    return path.join("\\\\?\\pipe\\", __dirname, `__local_socket_${name}`);
  } else {
    return path.join(__dirname, `__local_socket_${name}`);
  }
}

/** 创建本地socket连接, 为避免socket未就绪, 这里提供重试 */
export async function connectLocalSocketWithRetry(
  socketPath: string
): Promise<net.Socket> {
  const gen = async () => {
    return new Promise<net.Socket>((resolve, reject) => {
      const client = net.createConnection(socketPath, () => {
        resolve(client);
      });
      client.on("error", (error) => {
        reject(error);
      });
    });
  };

  let count = 0;
  while (true) {
    try {
      const client = await gen();
      return client;
    } catch (e) {
      if (count > 5) {
        throw e;
      } else {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }
}
