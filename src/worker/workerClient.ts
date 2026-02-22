import { WorkerRequest, WorkerRequestTemplate } from "./workerTypes";

export class WorkerClient {
  private static id: number = 1;
  private static worker = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });
  private static pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (err: Error) => void }
  >();

  static async postMessage(workerRequestTemplate: WorkerRequestTemplate) {
    return new Promise((resolve, reject) => {
      this.pending.set(this.id, { resolve, reject });

      const request: WorkerRequest = {
        id: this.id,
        ...workerRequestTemplate,
      };

      this.id += 1;

      this.worker.postMessage(request);
    });
  }
}
