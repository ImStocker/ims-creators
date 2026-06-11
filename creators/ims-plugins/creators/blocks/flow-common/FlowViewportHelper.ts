import {
  getNodesInside,
  getRectOfNodes,
  getTransformForBounds,
  type GraphNode,
  type TransitionOptions,
  type ViewportTransform,
  type VueFlowStore,
} from '@vue-flow/core';
import { unref } from 'vue';

type ViewportChangeJob = {
  promise: Promise<boolean>;
  resolve: (res: boolean) => void;
  reject: (err: Error) => void;
  aborted: boolean;
};

export class FlowViewportHelper {
  private _flow: VueFlowStore | null = null;
  private _viewportChangeJob: ViewportChangeJob | null = null;

  private _abortCurrentViewportChangeJob() {
    if (!this._viewportChangeJob) {
      return;
    }
    this._viewportChangeJob.resolve(false);
    this._viewportChangeJob.aborted = true;
    this._viewportChangeJob = null;
  }

  get zoom(): number {
    if (!this._flow) return 1;
    return unref(this._flow.viewport).zoom;
  }

  get minZoom(): number {
    if (!this._flow) return 1;
    return unref(this._flow.minZoom);
  }

  get maxZoom(): number {
    if (!this._flow) return 1;
    return unref(this._flow.maxZoom);
  }

  setFlow(flow: VueFlowStore) {
    this._flow = flow;
  }

  async fitToAll(options?: {
    duration?: number;
    padding?: number;
    maxZoom?: number;
  }) {
    if (!this._flow) return;
    const nodes = unref(this._flow.getNodes);
    if (!nodes.length) return;
    return this.moveToNodes(nodes, {
      duration: options?.duration ?? 500,
      padding: options?.padding ?? 0.2,
      maxZoom: options?.maxZoom ?? this.maxZoom,
    });
  }

  setCenter(
    x: number,
    y: number,
    options?: { duration?: number; zoom?: number },
  ) {
    if (!this._flow) return;
    this._flow.setCenter(x, y, {
      duration: options?.duration ?? 0,
      zoom: options?.zoom ?? this.zoom,
    });
  }

  onViewportChangeStart(_e: ViewportTransform) {
    this._abortCurrentViewportChangeJob();
  }

  async moveToNodes(
    nodes: GraphNode[],
    options: TransitionOptions & {
      minZoom?: number;
      maxZoom?: number;
      padding?: number;
    },
  ) {
    if (!this._flow) {
      throw new Error('Flow is not set');
    }
    this._abortCurrentViewportChangeJob();

    const bounds = getRectOfNodes(nodes);
    const transform = getTransformForBounds(
      bounds,
      unref(this._flow.dimensions).width,
      unref(this._flow.dimensions).height,
      options.minZoom ?? this.minZoom,
      options.maxZoom ?? this.maxZoom,
      options.padding ?? 0.1,
    );

    let job_resolve!: (res: boolean) => void;
    let job_reject!: (err: Error) => void;
    const job_promise = new Promise<boolean>((resolve, reject) => {
      job_resolve = resolve;
      job_reject = reject;
    });
    const job: ViewportChangeJob = {
      aborted: false,
      promise: job_promise,
      reject: job_reject,
      resolve: job_resolve,
    };
    this._viewportChangeJob = job;

    this._flow.setViewport(transform, options).then(
      (res) => {
        job.resolve(res);
      },
      (err) => job.reject(err),
    );
    return this._viewportChangeJob.promise;
  }

  checkNodesAreVisible(nodes: GraphNode[]): boolean {
    if (!this._flow) {
      return false;
    }
    const nodesInViewport = getNodesInside(
      nodes,
      {
        x: 0,
        y: 0,
        width: unref(this._flow.dimensions).width,
        height: unref(this._flow.dimensions).height,
      },
      unref(this._flow.viewport),
    );
    return nodesInViewport.length === nodes.length;
  }
}
