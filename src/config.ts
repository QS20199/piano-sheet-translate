import fs from "fs";
import path from "path";

const appConf = fs
  .readFileSync(path.resolve(__dirname, "../app.conf"), {
    encoding: "utf-8",
  })
  .split("\n")
  .map((v) => v.trim())
  .filter(Boolean)
  .filter((v) => !v.startsWith("#"))
  .reduce((rst, v) => {
    const [key, ...value] = v.split("=");
    rst[key.trim()] = value.join("").trim();
    return rst;
  }, {} as Record<string, string>);

export const config = {
  // 五线谱升降记号是升还是降
  markRiseOrReduce: /^\-/.test(appConf["tune"]) ? "reduce" : "rise", // 升rise, 降reduce
  // 升降记号的数量
  markCount: Math.abs(Number(appConf["tune"])),

  // 音符形状匹配的阈值
  noteMatchThreshold: Number(appConf["noteMatchThreshold"]),

  fontScale: Number(appConf['fontScale']) || 0.8,
  sheetScale: Number(appConf['sheetScale']),
  fontOpacity: Number(appConf['fontOpacity']),
  files: (appConf['files'] || '').split(',').filter(Boolean),
  workerNum: Number(appConf['workerNum']) || 8,
};
