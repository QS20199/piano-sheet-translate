const opencvDir = "G:/opencv-4.8.0/opencv";

const { exec } = require("child_process");
const cmd = [
  `cross-env`,
  `OPENCV4NODEJS_DISABLE_AUTOBUILD=1`,
  `OPENCV_LIB_DIR=${opencvDir}/build/x64/vc16/lib`,
  `OPENCV_BIN_DIR=${opencvDir}/build/x64/vc16/bin`,
  `OPENCV_INCLUDE_DIR=${opencvDir}/build/include`,
  `build-opencv`,
  `--nobuild`,
  `rebuild`,
].join(" ");

console.log(`> ${cmd}`);

const { stdout, stderr } = exec(cmd);
stdout.pipe(process.stdout);
stderr.pipe(process.stderr);
