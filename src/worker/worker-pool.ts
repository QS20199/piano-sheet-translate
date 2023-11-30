import path from "path";
import { EventEmitter } from "events";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { connectLocalSocketWithRetry, getSocketPath } from "../util";
import { config } from "../config";
import debug from "debug";

const workerNum = config.workerNum;
const bus = new EventEmitter();
const workers: ChildProcessWithoutNullStreams[] = [];
const workersIdQueue: number[] = [];
const log = debug("worker-pool");

// init worker
for (let i = 0; i < workerNum; i++) {
  const worker = spawn(`node`, [
    path.resolve(__dirname, "./note-model-calc-match.js"),
    String(i),
  ]);
  worker.stderr.on("data", (data) => {
    log(`[worker ${i} stderr]`, String(data));
  });
  worker.stdout.on("data", (data) => {
    log(`[worker ${i} stdout]`, String(data));
  });
  workers.push(worker);
  workersIdQueue.push(i);
}

async function getWorker() {
  let workerId = workersIdQueue.pop();
  if (workerId === undefined) {
    workerId = await new Promise((resolve) => {
      const handler = () => {
        if (workersIdQueue.length) {
          resolve(workersIdQueue.pop());
          bus.off("available", handler);
        }
      };
      bus.on("available", handler);
    });
  }

  const workerDone = () => {
    log(`worker ${workerId} done`);
    workersIdQueue.unshift(workerId!);
    bus.emit("available");
  };

  log(`worker ${workerId} start`);
  return {
    workerId: workerId!,
    workerDone,
  };
}

export async function workerRun(data: any) {
  const { workerId, workerDone } = await getWorker();
  const serverSocketPath = getSocketPath(`note-model-calc-match_${workerId}`);

  const serverSocket = await connectLocalSocketWithRetry(serverSocketPath);

  return new Promise((resolve, reject) => {
    let resultData = "";
    serverSocket.on("data", (data) => {
      resultData += data;
      if (resultData.endsWith("\n\n")) {
        resolve(JSON.parse(resultData));
        serverSocket.end();
      }
    });

    serverSocket.on("error", (err) => {
      reject(err);
    });

    serverSocket.on("end", workerDone);

    serverSocket.write(JSON.stringify(data) + "\n\n");
  });
}
